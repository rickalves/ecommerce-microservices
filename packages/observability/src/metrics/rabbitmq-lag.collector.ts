import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MetricsService } from './metrics.service';

/**
 * Coleta métricas de profundidade de filas RabbitMQ via Management API
 * a cada 30s e atualiza as Gauges de consumer lag e DLQ depth.
 */
@Injectable()
export class RabbitMQLagCollector implements OnModuleInit {
    private readonly mgmtUrl: string;
    private readonly user: string;
    private readonly pass: string;

    constructor(
        private readonly http: HttpService,
        private readonly metrics: MetricsService
    ) {
        this.mgmtUrl = process.env.RABBITMQ_MGMT_URL ?? 'http://rabbitmq:15672';
        this.user = process.env.RABBITMQ_USER ?? 'guest';
        this.pass = process.env.RABBITMQ_PASS ?? 'guest';
    }

    onModuleInit() {
        // Primeira coleta imediata, depois a cada 30s
        void this.collect();
        setInterval(() => void this.collect(), 30_000);
    }

    private async collect(): Promise<void> {
        try {
            const { data } = await this.http.axiosRef.get<RabbitMQQueue[]>(
                `${this.mgmtUrl}/api/queues`,
                {
                    auth: { username: this.user, password: this.pass },
                    timeout: 5000,
                }
            );

            for (const q of data) {
                const messages = q.messages ?? 0;

                // Atualiza lag geral por fila
                this.metrics.consumerLag.set({ queue: q.name }, messages);

                // Filas DLQ têm profundidade separada
                if (q.name.endsWith('.dlq') || q.name.endsWith('-dlq')) {
                    this.metrics.dlqDepth.set({ queue: q.name }, messages);
                }
            }
        } catch {
            // Coleta é best-effort — não propaga erro para não derrubar o serviço
        }
    }
}

interface RabbitMQQueue {
    name: string;
    messages?: number;
    messages_ready?: number;
    messages_unacknowledged?: number;
}
