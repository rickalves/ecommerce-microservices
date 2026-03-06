# ADR 002: Implementação de Observabilidade em Arquitetura Event-Driven

**Data:** 2026-02-11
**Status:** Proposto
**Autores:** Equipe de Arquitetura
**Decisores:** Tech Lead, Arquiteto de Software

---

## Contexto

O sistema de e-commerce baseado em microserviços utiliza arquitetura Event-Driven com RabbitMQ para comunicação assíncrona entre serviços (Order Service, Payment Service, User Service). A arquitetura atual apresenta as seguintes características:

### Estado Atual

**Arquitetura:**

- 4 microserviços: API Gateway, User Service, Order Service, Payment Service
- Stack: NestJS + TypeScript + PostgreSQL + RabbitMQ
- Padrão: Domain-Driven Design (DDD) + Event-Driven Architecture (EDA)
- Comunicação: HTTP (Gateway) + TCP + RabbitMQ (eventos assíncronos)

**Lacunas Críticas em Observabilidade:**

1. **Logs:** Apenas `console.log()` sem estruturação ou contexto
2. **Métricas:** Sem coleta de métricas de negócio ou infraestrutura
3. **Traces:** Sem rastreamento distribuído cross-service
4. **CorrelationId:** Implementado parcialmente, mas não propagado corretamente (cada serviço gera seu próprio ID)
5. **Alertas:** Sem sistema de alertas ou SLOs definidos
6. **Health Checks:** Sem endpoints de saúde para monitoramento

### Problemas Identificados

- **Debugging lento:** Impossível rastrear requisições end-to-end
- **Falta de visibilidade:** Não sabemos onde os eventos falham no fluxo
- **Sem proatividade:** Descobrimos problemas apenas quando usuários reportam
- **Troubleshooting complexo:** Logs dispersos sem correlação entre serviços
- **Performance desconhecida:** Sem métricas de latência P95/P99 ou throughput

### Requisitos de Negócio

- Tempo médio de resolução de incidentes < 30 minutos
- Disponibilidade > 99.5% para serviços críticos (Order, Payment)
- Rastreabilidade completa de transações financeiras (compliance PCI-DSS)
- Capacidade de auditoria end-to-end para suporte a disputas

---

## Decisão

Implementaremos uma **stack de observabilidade completa e vendor-agnostic** baseada em OpenTelemetry, seguindo os três pilares da observabilidade (Logs, Métricas, Traces) com propagação de contexto garantida.

### Stack Escolhida

| Pilar             | Tecnologia                 | Justificativa                                                                                  |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| **Logs**          | Pino                       | Mais performático para Node.js (3x mais rápido que Winston), suporte nativo a JSON estruturado |
| **Métricas**      | OpenTelemetry + Prometheus | Padrão da indústria CNCF, pull-based, excelente para séries temporais                          |
| **Traces**        | OpenTelemetry + Jaeger     | Vendor-agnostic, suporte nativo W3C Trace Context, UI intuitiva                                |
| **Dashboards**    | Grafana                    | Open-source, integração nativa com Prometheus/Jaeger, altamente customizável                   |
| **Health Checks** | @nestjs/terminus           | Integração nativa NestJS, suporte a múltiplas dependências                                     |

### Arquitetura de Observabilidade

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CorrelationMiddleware: Gera/Extrai correlationId        │   │
│  │ TracingInterceptor: Cria root span + W3C traceparent    │   │
│  │ LoggerInterceptor: Log estruturado com contexto         │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ X-Correlation-ID, traceparent
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Microserviços (Order, Payment, User)          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ AsyncLocalStorage: Context propagation thread-local        │ │
│  │ RabbitMQInterceptor: Extrai correlationId de mensagens    │ │
│  │ SpanDecorator: Cria spans para use cases + eventos        │ │
│  │ MetricsService: Coleta métricas de negócio + infra        │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────┬──────────────────────┘
                         │                  │
                         ▼                  ▼
              ┌──────────────────┐  ┌──────────────────┐
              │   Prometheus      │  │      Jaeger      │
              │   (Métricas)      │  │     (Traces)     │
              └─────────┬─────────┘  └────────┬─────────┘
                        │                     │
                        └──────────┬──────────┘
                                   ▼
                          ┌─────────────────┐
                          │     Grafana     │
                          │   (Dashboards)  │
                          └─────────────────┘
```

---

## Plano de Implementação

### Fase 1: Fundação - Logs Estruturados e CorrelationId (Semana 1-2)

#### 1.1 Criar Pacote Compartilhado `packages/observability`

**Estrutura:**

```
packages/observability/
├── src/
│   ├── logger/
│   │   ├── logger.service.ts          # Wrapper Pino com redact
│   │   ├── logger.interceptor.ts      # Auto-inject context
│   │   ├── logger.module.ts
│   │   └── types.ts
│   ├── context/
│   │   ├── correlation.service.ts     # AsyncLocalStorage
│   │   ├── correlation.middleware.ts  # HTTP
│   │   ├── correlation.interceptor.ts # RabbitMQ
│   │   └── types.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

#### 1.2 LoggerService - Campos Padrão

```typescript
interface LogContext {
    timestamp: string; // ISO 8601
    level: string; // info, warn, error, debug
    service: string; // order-service, payment-service
    correlationId: string; // UUID propagado
    traceId?: string; // OpenTelemetry trace ID
    spanId?: string; // OpenTelemetry span ID
    userId?: string; // User context (quando disponível)
    environment: string; // dev, staging, prod
    message: string; // Log message
    [key: string]: any; // Campos customizados
}
```

**Configuração:**

- Desenvolvimento: Formato pretty com cores
- Produção: JSON estruturado com redact de dados sensíveis
- Redact automático: `password`, `token`, `authorization`, `cpf`, `creditCard`

#### 1.3 CorrelationService - Propagação Garantida

**Regras de Propagação:**

1. **HTTP (API Gateway):**
    - Extrair `X-Correlation-ID` header se existir
    - Caso contrário, gerar UUID v4
    - Propagar em todos os request headers downstream

2. **RabbitMQ (Eventos):**
    - Incluir `correlationId` no payload de todos os eventos
    - Extrair no consumidor via interceptor
    - Armazenar em AsyncLocalStorage para acesso thread-local

3. **Spans (OpenTelemetry):**
    - Adicionar `correlationId` como span attribute
    - Permitir busca no Jaeger por correlation ID

**Formato de Evento Padronizado:**

```typescript
interface BaseEvent<T> {
    version: string; // "v1"
    correlationId: string; // UUID propagado
    causationId?: string; // ID do evento que causou este
    traceId: string; // OpenTelemetry trace ID
    spanId: string; // OpenTelemetry span ID
    timestamp: string; // ISO 8601
    service: string; // Nome do serviço produtor
    eventType: string; // "order.created"
    data: T; // Payload específico
    metadata?: Record<string, any>; // userId, tenantId, etc
}
```

#### 1.4 Dependências

```bash
# Logger
pnpm add -w pino pino-pretty pino-http

# Tracing & Metrics
pnpm add -w @opentelemetry/sdk-node
pnpm add -w @opentelemetry/auto-instrumentations-node
pnpm add -w @opentelemetry/exporter-prometheus
pnpm add -w @opentelemetry/exporter-jaeger
pnpm add -w @opentelemetry/instrumentation-http
pnpm add -w @opentelemetry/instrumentation-nestjs-core
pnpm add -w @opentelemetry/instrumentation-typeorm
pnpm add -w @opentelemetry/instrumentation-amqplib

# Health checks
pnpm add -w @nestjs/terminus @nestjs/axios
```

---

### Fase 2: Rastreamento Distribuído (Semana 2-3)

#### 2.1 Configurar OpenTelemetry SDK

**Arquivo:** `packages/observability/src/tracing/tracer.ts`

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

export function initTracing(serviceName: string) {
    const jaegerExporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
    });

    const sdk = new NodeSDK({
        resource: new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
            [SemanticResourceAttributes.SERVICE_VERSION]:
                process.env.npm_package_version || '1.0.0',
            [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
                process.env.NODE_ENV || 'development',
        }),
        spanProcessor: new BatchSpanProcessor(jaegerExporter),
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-http': {
                    enabled: true,
                    ignoreIncomingPaths: ['/health', '/metrics'],
                },
                '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
                '@opentelemetry/instrumentation-typeorm': { enabled: true },
                '@opentelemetry/instrumentation-amqplib': { enabled: true },
            }),
        ],
    });

    sdk.start();

    process.on('SIGTERM', () => {
        sdk.shutdown().finally(() => process.exit(0));
    });
}
```

#### 2.2 Integração em `main.ts` de cada serviço

```typescript
// apps/order-service/src/main.ts
import { initTracing } from '@ecommerce/observability';

// IMPORTANTE: Inicializar ANTES de qualquer import do NestJS
initTracing('order-service');

import { NestFactory } from '@nestjs/core';
// ...
```

#### 2.3 Decorator para Spans Customizados

```typescript
// packages/observability/src/tracing/span.decorator.ts
import { trace } from '@opentelemetry/api';

export function WithSpan(name?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const spanName = name || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            const tracer = trace.getTracer('default');
            return tracer.startActiveSpan(spanName, async (span) => {
                try {
                    const result = await originalMethod.apply(this, args);
                    span.setStatus({ code: SpanStatusCode.OK });
                    return result;
                } catch (error) {
                    span.recordException(error);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
                    throw error;
                } finally {
                    span.end();
                }
            });
        };

        return descriptor;
    };
}
```

**Uso nos Use Cases:**

```typescript
// apps/order-service/src/application/use-cases/create-order.use-case.ts
import { WithSpan } from '@ecommerce/observability';

export class CreateOrderUseCase {
    @WithSpan('CreateOrderUseCase.execute')
    async execute(dto: CreateOrderDto): Promise<Order> {
        // lógica existente
    }
}
```

#### 2.4 Propagação W3C Trace Context em RabbitMQ

**Interceptor:**

```typescript
// packages/observability/src/tracing/rabbitmq-tracing.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { trace, context, propagation } from '@opentelemetry/api';
import { Observable } from 'rxjs';

@Injectable()
export class RabbitMQTracingInterceptor implements NestInterceptor {
    intercept(executionContext: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = executionContext.switchToRpc();
        const data = ctx.getData();

        // Extrair contexto de trace do payload
        if (data.traceContext) {
            const extractedContext = propagation.extract(context.active(), data.traceContext);
            return context.with(extractedContext, () => next.handle());
        }

        return next.handle();
    }
}
```

**Injeção no Produtor:**

```typescript
// Ao emitir evento, incluir trace context
const span = trace.getActiveSpan();
const traceContext = {};
propagation.inject(context.active(), traceContext);

this.eventBus.emit('order.created', {
    correlationId: order.id,
    traceContext,
    data: order,
});
```

#### 2.5 Docker Compose - Jaeger

```yaml
# docker-compose.yml
services:
    jaeger:
        image: jaegertracing/all-in-one:1.51
        container_name: ecommerce-jaeger
        ports:
            - '16686:16686' # Jaeger UI
            - '14268:14268' # Jaeger collector HTTP
            - '14250:14250' # Jaeger collector gRPC
            - '6831:6831/udp' # Jaeger agent
        environment:
            COLLECTOR_ZIPKIN_HOST_PORT: ':9411'
            COLLECTOR_OTLP_ENABLED: 'true'
        networks:
            - ecommerce-network
```

---

### Fase 3: Métricas e Prometheus (Semana 3-4)

#### 3.1 MetricsService - Coletor Centralizado

```typescript
// packages/observability/src/metrics/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
    private readonly registry: Registry;

    // Contadores
    public readonly eventPublishedCounter: Counter;
    public readonly eventConsumedCounter: Counter;
    public readonly eventFailedCounter: Counter;

    // Histogramas
    public readonly eventProcessingDuration: Histogram;
    public readonly httpRequestDuration: Histogram;
    public readonly dbQueryDuration: Histogram;

    // Gauges
    public readonly queueDepth: Gauge;
    public readonly activeConnections: Gauge;

    constructor() {
        this.registry = new Registry();

        // Event publishing
        this.eventPublishedCounter = new Counter({
            name: 'event_published_total',
            help: 'Total de eventos publicados',
            labelNames: ['service', 'event_type'],
            registers: [this.registry],
        });

        // Event consumption
        this.eventConsumedCounter = new Counter({
            name: 'event_consumed_total',
            help: 'Total de eventos consumidos',
            labelNames: ['service', 'event_type', 'status'],
            registers: [this.registry],
        });

        // Event failures
        this.eventFailedCounter = new Counter({
            name: 'event_failed_total',
            help: 'Total de eventos falhados',
            labelNames: ['service', 'event_type', 'reason'],
            registers: [this.registry],
        });

        // Processing duration
        this.eventProcessingDuration = new Histogram({
            name: 'event_processing_duration_seconds',
            help: 'Duração do processamento de eventos',
            labelNames: ['service', 'event_type'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
            registers: [this.registry],
        });

        // HTTP requests
        this.httpRequestDuration = new Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duração de requisições HTTP',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
            registers: [this.registry],
        });

        // Queue depth
        this.queueDepth = new Gauge({
            name: 'rabbitmq_queue_depth',
            help: 'Número de mensagens na fila',
            labelNames: ['queue_name'],
            registers: [this.registry],
        });
    }

    getMetrics(): Promise<string> {
        return this.registry.metrics();
    }
}
```

#### 3.2 Endpoint `/metrics` em cada serviço

```typescript
// packages/observability/src/metrics/metrics.controller.ts
import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
    constructor(private readonly metricsService: MetricsService) {}

    @Get('metrics')
    async getMetrics(): Promise<string> {
        return this.metricsService.getMetrics();
    }
}
```

#### 3.3 Instrumentação Automática de Eventos

```typescript
// packages/observability/src/metrics/event-metrics.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class EventMetricsInterceptor implements NestInterceptor {
    constructor(
        private readonly metrics: MetricsService,
        private readonly serviceName: string
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const pattern = context.switchToRpc().getContext().pattern;
        const eventType = typeof pattern === 'string' ? pattern : pattern.cmd;

        const startTime = Date.now();

        return next.handle().pipe(
            tap(() => {
                const duration = (Date.now() - startTime) / 1000;
                this.metrics.eventConsumedCounter.inc({
                    service: this.serviceName,
                    event_type: eventType,
                    status: 'success',
                });
                this.metrics.eventProcessingDuration.observe(
                    { service: this.serviceName, event_type: eventType },
                    duration
                );
            }),
            catchError((error) => {
                this.metrics.eventFailedCounter.inc({
                    service: this.serviceName,
                    event_type: eventType,
                    reason: error.constructor.name,
                });
                throw error;
            })
        );
    }
}
```

#### 3.4 Prometheus Configuration

```yaml
# observability/prometheus/prometheus.yml
global:
    scrape_interval: 15s
    evaluation_interval: 15s

scrape_configs:
    - job_name: 'api-gateway'
      static_configs:
          - targets: ['api-gateway:3000']
      metrics_path: '/metrics'

    - job_name: 'order-service'
      static_configs:
          - targets: ['order-service:3002']
      metrics_path: '/metrics'

    - job_name: 'payment-service'
      static_configs:
          - targets: ['payment-service:3003']
      metrics_path: '/metrics'

    - job_name: 'user-service'
      static_configs:
          - targets: ['user-service:3001']
      metrics_path: '/metrics'

    - job_name: 'rabbitmq'
      static_configs:
          - targets: ['rabbitmq:15692']
```

#### 3.5 Docker Compose - Prometheus & Grafana

```yaml
# docker-compose.yml
services:
    prometheus:
        image: prom/prometheus:v2.48.0
        container_name: ecommerce-prometheus
        volumes:
            - ./observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
            - ./observability/prometheus/alerting.rules.yml:/etc/prometheus/alerting.rules.yml
            - prometheus-data:/prometheus
        command:
            - '--config.file=/etc/prometheus/prometheus.yml'
            - '--storage.tsdb.path=/prometheus'
            - '--web.console.libraries=/etc/prometheus/console_libraries'
            - '--web.console.templates=/etc/prometheus/consoles'
            - '--web.enable-lifecycle'
        ports:
            - '9090:9090'
        networks:
            - ecommerce-network

    grafana:
        image: grafana/grafana:10.2.2
        container_name: ecommerce-grafana
        environment:
            - GF_SECURITY_ADMIN_USER=admin
            - GF_SECURITY_ADMIN_PASSWORD=admin
            - GF_USERS_ALLOW_SIGN_UP=false
        volumes:
            - ./observability/grafana/provisioning:/etc/grafana/provisioning
            - ./observability/grafana/dashboards:/var/lib/grafana/dashboards
            - grafana-data:/var/lib/grafana
        ports:
            - '3300:3000'
        depends_on:
            - prometheus
        networks:
            - ecommerce-network

volumes:
    prometheus-data:
    grafana-data:
```

---

### Fase 4: Health Checks e Resiliência (Semana 4-5)

#### 4.1 Health Check Controller

```typescript
// packages/observability/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    TypeOrmHealthIndicator,
    MicroserviceHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: TypeOrmHealthIndicator,
        private microservice: MicroserviceHealthIndicator
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.db.pingCheck('database'),
            () =>
                this.microservice.pingCheck('rabbitmq', {
                    transport: Transport.RMQ,
                    options: {
                        urls: [process.env.RABBITMQ_URL],
                    },
                }),
        ]);
    }

    @Get('ready')
    @HealthCheck()
    ready() {
        // Readiness: serviço está pronto para receber tráfego
        return this.health.check([
            () => this.db.pingCheck('database'),
            () => this.microservice.pingCheck('rabbitmq'),
        ]);
    }

    @Get('live')
    @HealthCheck()
    live() {
        // Liveness: serviço está vivo (não travado)
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
}
```

#### 4.2 Alertas Prometheus

```yaml
# observability/prometheus/alerting.rules.yml
groups:
    - name: microservices_alerts
      interval: 30s
      rules:
          # Alta taxa de erro
          - alert: HighEventErrorRate
            expr: |
                (rate(event_failed_total[5m]) / rate(event_consumed_total[5m])) > 0.05
            for: 5m
            labels:
                severity: warning
            annotations:
                summary: 'Alta taxa de erro em eventos - {{ $labels.service }}'
                description: 'Serviço {{ $labels.service }} com {{ $value | humanizePercentage }} de eventos falhando'

          # Latência alta
          - alert: HighEventProcessingLatency
            expr: |
                histogram_quantile(0.95, rate(event_processing_duration_seconds_bucket[5m])) > 2
            for: 10m
            labels:
                severity: warning
            annotations:
                summary: 'Latência alta no processamento - {{ $labels.service }}'
                description: 'P95 de {{ $value }}s no serviço {{ $labels.service }}'

          # Fila com backlog
          - alert: HighQueueDepth
            expr: rabbitmq_queue_depth > 1000
            for: 15m
            labels:
                severity: warning
            annotations:
                summary: 'Fila {{ $labels.queue_name }} com backlog alto'
                description: '{{ $value }} mensagens acumuladas'

          # Serviço indisponível
          - alert: ServiceDown
            expr: up == 0
            for: 2m
            labels:
                severity: critical
            annotations:
                summary: 'Serviço {{ $labels.job }} está DOWN'
                description: 'O serviço não está respondendo há mais de 2 minutos'

          # Taxa de sucesso baixa
          - alert: LowSuccessRate
            expr: |
                (
                  sum(rate(event_consumed_total{status="success"}[5m])) by (service)
                  /
                  sum(rate(event_consumed_total[5m])) by (service)
                ) < 0.95
            for: 10m
            labels:
                severity: critical
            annotations:
                summary: 'Taxa de sucesso baixa - {{ $labels.service }}'
                description: 'Apenas {{ $value | humanizePercentage }} de sucesso'
```

#### 4.3 Dead Letter Queue (DLQ)

```typescript
// packages/observability/src/resilience/dlq.config.ts
export const DLQ_CONFIG = {
    exchanges: {
        main: 'main_exchange',
        dlx: 'dead_letter_exchange',
    },
    queues: {
        order_events: {
            name: 'order_events',
            dlq: 'order_events.dlq',
            options: {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': 'dead_letter_exchange',
                    'x-dead-letter-routing-key': 'order_events.dlq',
                    'x-message-ttl': 60000, // 1 minuto
                },
            },
        },
        payment_events: {
            name: 'payment_events',
            dlq: 'payment_events.dlq',
            options: {
                durable: true,
                arguments: {
                    'x-dead-letter-exchange': 'dead_letter_exchange',
                    'x-dead-letter-routing-key': 'payment_events.dlq',
                    'x-message-ttl': 60000,
                },
            },
        },
    },
};
```

#### 4.4 Retry com Backoff Exponencial

```typescript
// packages/observability/src/resilience/retry.decorator.ts
import { Logger } from '@nestjs/common';

interface RetryOptions {
    maxAttempts?: number;
    backoffMs?: number;
    backoffMultiplier?: number;
    onRetry?: (error: Error, attempt: number) => void;
}

export function Retry(options: RetryOptions = {}) {
    const { maxAttempts = 3, backoffMs = 1000, backoffMultiplier = 2, onRetry } = options;

    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const logger = new Logger(target.constructor.name);

        descriptor.value = async function (...args: any[]) {
            let lastError: Error;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    lastError = error;

                    if (attempt === maxAttempts) {
                        logger.error(
                            `Failed after ${maxAttempts} attempts: ${propertyKey}`,
                            error.stack
                        );
                        throw error;
                    }

                    const delay = backoffMs * Math.pow(backoffMultiplier, attempt - 1);
                    logger.warn(
                        `Retry ${attempt}/${maxAttempts} for ${propertyKey} after ${delay}ms`
                    );

                    if (onRetry) {
                        onRetry(error, attempt);
                    }

                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }

            throw lastError;
        };

        return descriptor;
    };
}
```

**Uso:**

```typescript
@EventPattern('payment.completed')
@Retry({ maxAttempts: 3, backoffMs: 2000 })
async handlePaymentCompleted(data: any) {
  // lógica que pode falhar temporariamente
}
```

---

### Fase 5: Dashboards e SLOs (Semana 5)

#### 5.1 Service Level Objectives (SLOs)

```yaml
# observability/slos.yml
services:
    order-service:
        slo:
            availability: 99.5% # 3.6 horas de downtime por mês
            latency_p95: 500ms
            latency_p99: 1000ms
            error_rate: 1%
        sli:
            - name: availability
              query: up{job="order-service"}
            - name: latency_p95
              query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
            - name: error_rate
              query: rate(event_failed_total[5m]) / rate(event_consumed_total[5m])

    payment-service:
        slo:
            availability: 99.9% # 43 minutos de downtime por mês
            latency_p95: 300ms
            latency_p99: 800ms
            error_rate: 0.5%
        sli:
            - name: availability
              query: up{job="payment-service"}
            - name: latency_p95
              query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
            - name: error_rate
              query: rate(event_failed_total[5m]) / rate(event_consumed_total[5m])
```

#### 5.2 Grafana Dashboards

**Dashboard 1: Visão Geral (Overview)**

- Taxa de eventos publicados/consumidos (req/s)
- Latência P50/P95/P99 por serviço
- Taxa de erro global
- Disponibilidade por serviço
- Queue depth RabbitMQ

**Dashboard 2: Order Service**

- Throughput de pedidos (criados/confirmados/cancelados)
- Duração dos use cases
- Taxa de sucesso por operação
- Dependências (DB, RabbitMQ)

**Dashboard 3: Payment Service**

- Throughput de pagamentos (iniciados/completados/falhados)
- Taxa de sucesso de pagamentos
- Latência de processamento
- Métricas de refund

**Dashboard 4: RabbitMQ**

- Mensagens publicadas/consumidas
- Queue depth por fila
- Consumer lag
- DLQ depth

**Dashboard 5: Infraestrutura**

- CPU/Memória por serviço
- Connections ativas (DB + RabbitMQ)
- Disk I/O
- Network throughput

#### 5.3 Arquivo de Provisionamento Grafana

```yaml
# observability/grafana/provisioning/datasources/datasources.yml
apiVersion: 1
datasources:
    - name: Prometheus
      type: prometheus
      access: proxy
      url: http://prometheus:9090
      isDefault: true
      editable: false

    - name: Jaeger
      type: jaeger
      access: proxy
      url: http://jaeger:16686
      editable: false
```

```yaml
# observability/grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
    - name: 'Default'
      orgId: 1
      folder: ''
      type: file
      disableDeletion: false
      updateIntervalSeconds: 10
      allowUiUpdates: true
      options:
          path: /var/lib/grafana/dashboards
```

---

## Consequências

### Positivas

1. **Rastreabilidade End-to-End:** Qualquer requisição pode ser rastreada do Gateway até o último evento
2. **Debugging Acelerado:** Logs estruturados com contexto reduzem MTTR (Mean Time To Resolution)
3. **Proatividade:** Alertas permitem detectar problemas antes de afetar usuários
4. **Performance Visibility:** Métricas P95/P99 identificam gargalos reais
5. **Compliance:** Auditoria completa de transações financeiras (PCI-DSS)
6. **Vendor-Agnostic:** OpenTelemetry permite migrar entre backends (Jaeger → Datadog → Lightstep)
7. **Developer Experience:** Logs estruturados facilitam desenvolvimento local
8. **Cost Efficiency:** Stack open-source reduz custos vs. soluções SaaS

### Negativas

1. **Overhead de Performance:**
    - Logs: ~5-10ms por request adicional
    - Traces: ~2-5ms por span
    - Métricas: ~1-2ms por operação
    - **Mitigação:** Sampling de traces em produção (10-20%)

2. **Complexidade Operacional:**
    - 3 novos serviços para gerenciar (Prometheus, Jaeger, Grafana)
    - **Mitigação:** Helm charts e automação de deploy

3. **Storage:**
    - Prometheus: ~1-2GB/dia por serviço
    - Jaeger: ~500MB-1GB/dia com sampling
    - **Mitigação:** Retenção de 15 dias (Prometheus) e 7 dias (Jaeger)

4. **Curva de Aprendizado:**
    - Time precisa aprender PromQL e Grafana
    - **Mitigação:** Treinamento + dashboards pré-configurados

5. **Custo de Desenvolvimento:**
    - ~3-5 semanas para implementação completa
    - **Mitigação:** Implementação incremental (priorizando ordem de valor)

---

## Alternativas Consideradas

### Alternativa 1: SaaS Completo (Datadog, New Relic)

**Prós:**

- Setup mais rápido (< 1 semana)
- Suporte técnico incluso
- Features avançadas (APM, Synthetic Monitoring)

**Contras:**

- Custo elevado (~$500-1000/mês para 4 serviços)
- Vendor lock-in
- Dados sensíveis enviados para terceiros

**Decisão:** Rejeitado devido a custo e vendor lock-in.

---

### Alternativa 2: ELK Stack (Elasticsearch, Logstash, Kibana)

**Prós:**

- Stack madura e amplamente utilizada
- Kibana oferece excelente UI para logs

**Contras:**

- Elasticsearch pesado (>2GB RAM por instância)
- Não resolve traces nativamente
- Complexidade de configuração/tuning
- Custo de infraestrutura maior

**Decisão:** Rejeitado devido a overhead de infra.

---

### Alternativa 3: Winston + Grafana Loki

**Prós:**

- Loki mais leve que Elasticsearch
- Integração nativa com Grafana

**Contras:**

- Winston mais lento que Pino
- Loki sem features avançadas de search

**Decisão:** Parcialmente aceito: usamos Grafana, mas com Pino ao invés de Winston.

---

### Alternativa 4: Apenas Logs (sem Traces)

**Prós:**

- Implementação mais rápida (~2 semanas)
- Menor overhead de performance

**Contras:**

- Impossível visualizar fluxo completo de requisições distribuídas
- Debugging de latência muito difícil

**Decisão:** Rejeitado. Traces são críticos para arquitetura distribuída.

---

## Métricas de Sucesso

Após 3 meses da implementação completa, esperamos:

1. **MTTR (Mean Time To Resolution):** Redução de 60 min → 20 min
2. **MTTD (Mean Time To Detection):** Redução de 30 min → 5 min
3. **Incident Postmortems:** 100% com traces completos anexados
4. **SLO Compliance:**
    - Order Service: 99.5%+ de disponibilidade
    - Payment Service: 99.9%+ de disponibilidade
5. **Developer Satisfaction:** >80% de aprovação em survey interno
6. **Zero Blind Spots:** Todo evento crítico com trace e log

---

## Checklist de Implementação

### Fase 1: Fundação (Semana 1-2)

- [ ] Criar pacote `packages/observability`
- [ ] Implementar `LoggerService` com Pino
- [ ] Implementar `CorrelationService` com AsyncLocalStorage
- [ ] Criar middleware HTTP de correlação
- [ ] Criar interceptor RabbitMQ de correlação
- [ ] Integrar em API Gateway
- [ ] Integrar em Order Service
- [ ] Integrar em Payment Service
- [ ] Integrar em User Service
- [ ] Substituir todos `console.log()` por `LoggerService`

### Fase 2: Tracing (Semana 2-3)

- [ ] Instalar dependências OpenTelemetry
- [ ] Criar `tracer.ts` com configuração base
- [ ] Inicializar tracing em `main.ts` de cada serviço
- [ ] Criar decorator `@WithSpan`
- [ ] Instrumentar use cases críticos
- [ ] Implementar propagação W3C em RabbitMQ
- [ ] Adicionar Jaeger ao `docker-compose.yml`
- [ ] Validar traces end-to-end no Jaeger UI

### Fase 3: Métricas (Semana 3-4)

- [ ] Implementar `MetricsService`
- [ ] Criar endpoint `/metrics` em cada serviço
- [ ] Criar interceptor de métricas de eventos
- [ ] Adicionar métricas customizadas de negócio
- [ ] Configurar Prometheus (`prometheus.yml`)
- [ ] Adicionar Prometheus ao `docker-compose.yml`
- [ ] Adicionar Grafana ao `docker-compose.yml`
- [ ] Validar scraping no Prometheus UI

### Fase 4: Resiliência (Semana 4-5)

- [ ] Implementar Health Checks com Terminus
- [ ] Configurar readiness/liveness probes
- [ ] Criar `alerting.rules.yml`
- [ ] Configurar DLQ para todas as filas
- [ ] Implementar decorator `@Retry`
- [ ] Adicionar retry em eventos críticos
- [ ] Testar cenários de falha

### Fase 5: Dashboards (Semana 5)

- [ ] Definir SLOs por serviço
- [ ] Criar dashboard "Overview"
- [ ] Criar dashboard "Order Service"
- [ ] Criar dashboard "Payment Service"
- [ ] Criar dashboard "RabbitMQ"
- [ ] Criar dashboard "Infraestrutura"
- [ ] Configurar provisionamento automático de datasources
- [ ] Validar alertas funcionando

### Fase 6: Documentação e Treinamento

- [ ] Criar runbook de troubleshooting
- [ ] Documentar queries PromQL úteis
- [ ] Criar guia de uso de Jaeger
- [ ] Treinar time em observabilidade
- [ ] Criar processo de incident response

---

## Referências

1. **OpenTelemetry:** https://opentelemetry.io/docs/instrumentation/js/
2. **Pino Logger:** https://getpino.io/
3. **Prometheus Best Practices:** https://prometheus.io/docs/practices/naming/
4. **Jaeger Architecture:** https://www.jaegertracing.io/docs/1.51/architecture/
5. **W3C Trace Context:** https://www.w3.org/TR/trace-context/
6. **Google SRE Book - Observability:** https://sre.google/sre-book/monitoring-distributed-systems/
7. **NestJS Terminus:** https://docs.nestjs.com/recipes/terminus
8. **RabbitMQ Monitoring:** https://www.rabbitmq.com/monitoring.html

---

## Revisões

| Versão | Data       | Autor                 | Alterações      |
| ------ | ---------- | --------------------- | --------------- |
| 1.0    | 2026-02-11 | Equipe de Arquitetura | Criação inicial |

---

**Status Final:** PROPOSTO - Aguardando aprovação do Tech Lead e início da implementação.
