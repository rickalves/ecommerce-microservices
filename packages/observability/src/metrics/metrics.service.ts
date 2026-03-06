import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export interface MetricsModuleOptions {
    serviceName: string;
    collectDefaultMetrics?: boolean;
}

@Injectable()
export class MetricsService {
    private readonly registry: Registry;

    // HTTP metrics
    readonly httpRequestDuration: Histogram<string>;
    readonly httpRequestsTotal: Counter<string>;

    // Event / messaging metrics
    readonly eventPublishedTotal: Counter<string>;
    readonly eventConsumedTotal: Counter<string>;
    readonly eventProcessingDuration: Histogram<string>;

    // Business metrics
    readonly ordersCreatedTotal: Counter<string>;
    readonly ordersFailedTotal: Counter<string>;
    readonly paymentsProcessedTotal: Counter<string>;

    constructor(private readonly options: MetricsModuleOptions) {
        this.registry = new Registry();
        this.registry.setDefaultLabels({ service: options.serviceName });

        if (options.collectDefaultMetrics !== false) {
            collectDefaultMetrics({ register: this.registry });
        }

        this.httpRequestDuration = new Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duração das requisições HTTP em segundos',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            registers: [this.registry],
        });

        this.httpRequestsTotal = new Counter({
            name: 'http_requests_total',
            help: 'Total de requisições HTTP',
            labelNames: ['method', 'route', 'status_code'],
            registers: [this.registry],
        });

        this.eventPublishedTotal = new Counter({
            name: 'event_published_total',
            help: 'Total de eventos publicados no RabbitMQ',
            labelNames: ['event_type'],
            registers: [this.registry],
        });

        this.eventConsumedTotal = new Counter({
            name: 'event_consumed_total',
            help: 'Total de eventos consumidos do RabbitMQ',
            labelNames: ['event_type', 'status'],
            registers: [this.registry],
        });

        this.eventProcessingDuration = new Histogram({
            name: 'event_processing_duration_seconds',
            help: 'Duração do processamento de eventos em segundos',
            labelNames: ['event_type'],
            buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
            registers: [this.registry],
        });

        this.ordersCreatedTotal = new Counter({
            name: 'orders_created_total',
            help: 'Total de pedidos criados com sucesso',
            registers: [this.registry],
        });

        this.ordersFailedTotal = new Counter({
            name: 'orders_failed_total',
            help: 'Total de falhas na criação de pedidos',
            registers: [this.registry],
        });

        this.paymentsProcessedTotal = new Counter({
            name: 'payments_processed_total',
            help: 'Total de pagamentos processados',
            labelNames: ['status'],
            registers: [this.registry],
        });
    }

    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }

    getContentType(): string {
        return this.registry.contentType;
    }
}
