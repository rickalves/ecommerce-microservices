# Plano de Implementação — Observabilidade v2 (OpenTelemetry)

**Branch:** `feature/tracing`  
**Data:** Março 2026  
**Objetivo:** Substituir o `AsyncLocalStorage` manual por OpenTelemetry SDK, adicionando tracing distribuído real, log aggregation com Loki e dashboards unificados no Grafana.

---

## Visão Geral das Fases

```
Fase 1 ─── OTel SDK Core              (packages/observability)
Fase 2 ─── nestjs-pino + OTel logs    (packages/observability)
Fase 3 ─── RabbitMQ context propagation  (packages/observability)
Fase 4 ─── Métricas EDA + Exemplars   (packages/observability)
Fase 5 ─── Infra: Loki + Tempo + Collector  (docker-compose + infra/)
Fase 6 ─── Tracing per-service bootstrap   (apps/*)
Fase 7 ─── Health: consumer lag check (packages/observability)
Fase 8 ─── Grafana dashboards unificados   (infra/grafana)
```

---

## Fase 1 — OTel SDK Core no pacote `@ecommerce/observability`

### 1.1 Dependências novas

Arquivo: `packages/observability/package.json`

```diff
+ "@opentelemetry/sdk-node": "^0.57.0",
+ "@opentelemetry/api": "^1.9.0",
+ "@opentelemetry/auto-instrumentations-node": "^0.56.0",
+ "@opentelemetry/exporter-trace-otlp-grpc": "^0.57.0",
+ "@opentelemetry/resources": "^1.30.0",
+ "@opentelemetry/semantic-conventions": "^1.30.0",
+ "@opentelemetry/instrumentation-amqplib": "^0.46.0",
+ "nestjs-pino": "^4.3.0",
+ "pino-http": "^10.0.0"   (já existe, manter)
```

### 1.2 Novo módulo `tracing/`

Criar `packages/observability/src/tracing/tracing.ts`  
_(arquivo importado ANTES de qualquer outro — inicializa o SDK)_

```typescript
// packages/observability/src/tracing/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';

export function createOtelSDK(serviceName: string): NodeSDK {
  return new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: process.env.APP_VERSION ?? '1.0.0',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4317',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },  // muito verboso
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
      new AmqplibInstrumentation(),  // auto-instrumenta RabbitMQ publish/consume
    ],
  });
}
```

### 1.3 Refatorar `CorrelationService` — remover `AsyncLocalStorage`

Arquivo: `packages/observability/src/context/correlation.service.ts`

**Antes:** usa `AsyncLocalStorage<CorrelationContext>` para armazenar e recuperar contexto.  
**Depois:** delega para o OTel active span. O OTel SDK já usa `AsyncLocalStorage` internamente — não duplicar.

```typescript
// packages/observability/src/context/correlation.service.ts — NOVO
import { Injectable } from '@nestjs/common';
import { trace, context, SpanContext } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationService {
  // API pública mantida idêntica para evitar breaking changes nos serviços

  getCorrelationId(): string | undefined {
    // correlationId é mapeado ao traceId do span ativo
    return this.getActiveSpanContext()?.traceId;
  }

  getTraceId(): string | undefined {
    return this.getActiveSpanContext()?.traceId;
  }

  getSpanId(): string | undefined {
    return this.getActiveSpanContext()?.spanId;
  }

  getContext() {
    const spanCtx = this.getActiveSpanContext();
    if (!spanCtx) return undefined;
    return {
      correlationId: spanCtx.traceId,
      traceId: spanCtx.traceId,
      spanId: spanCtx.spanId,
    };
  }

  // Mantido apenas para compatibilidade com CorrelationMiddleware
  generateCorrelationId(): string {
    return uuidv4();
  }

  private getActiveSpanContext(): SpanContext | undefined {
    const span = trace.getActiveSpan();
    if (!span) return undefined;
    const ctx = span.spanContext();
    // isValid garante que não é um "NonRecordingSpan"
    return ctx.traceId !== '00000000000000000000000000000000' ? ctx : undefined;
  }
}
```

### 1.4 Refatorar `CorrelationMiddleware` — usar W3C Propagation API

Arquivo: `packages/observability/src/context/correlation.middleware.ts`

**Antes:** extrai `x-correlation-id` manualmente e chama `correlationService.run()`.  
**Depois:** o OTel `HttpInstrumentation` (já dentro do `getNodeAutoInstrumentations`) injeta automaticamente o span e extrai o `traceparent` dos headers. O middleware torna-se apenas passthrough para adicionar o header `X-Correlation-ID` na resposta.

```typescript
// packages/observability/src/context/correlation.middleware.ts — SIMPLIFICADO
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace } from '@opentelemetry/api';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // OTel HttpInstrumentation já criou o span e propagou o traceparent.
    // Apenas expõe o traceId como X-Correlation-ID para clientes externos.
    const span = trace.getActiveSpan();
    if (span) {
      const traceId = span.spanContext().traceId;
      res.setHeader('X-Correlation-ID', traceId);
      res.setHeader('X-Trace-ID', traceId);
    }
    next();
  }
}
```

### 1.5 Refatorar `CorrelationInterceptor` — extrair W3C context do payload AMQP

Arquivo: `packages/observability/src/context/correlation.interceptor.ts`

**Antes:** lê `correlationId/traceId/spanId` do corpo do evento e chama `correlationService.run()`.  
**Depois:** o `AmqplibInstrumentation` já extrai o `traceparent` dos headers AMQP automaticamente. Para o caso de payloads legados (sem headers AMQP instrumentados), criar um span filho manual a partir do `traceId` do payload.

```typescript
// packages/observability/src/context/correlation.interceptor.ts — NOVO
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { trace, context, propagation, SpanKind } from '@opentelemetry/api';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<any> {
    if (executionContext.getType() !== 'rpc') {
      return next.handle();
    }

    const data = executionContext.switchToRpc().getData();
    const tracer = trace.getTracer('correlation-interceptor');

    // Tenta extrair contexto W3C do campo traceparent do payload (legado)
    const carrier: Record<string, string> = {};
    if (data?.traceparent) carrier['traceparent'] = data.traceparent;
    if (data?.traceId) carrier['traceparent'] = `00-${data.traceId}-${data.spanId ?? '0000000000000000'}-01`;

    const parentCtx = Object.keys(carrier).length
      ? propagation.extract(context.active(), carrier)
      : context.active();

    const eventType = data?.eventType ?? 'rpc.message';

    return new Observable((subscriber) => {
      tracer.startActiveSpan(
        `consume ${eventType}`,
        { kind: SpanKind.CONSUMER },
        parentCtx,
        (span) => {
          if (data?.correlationId) span.setAttribute('messaging.correlation_id', data.correlationId);
          if (data?.eventType) span.setAttribute('messaging.operation', data.eventType);

          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => {
              span.recordException(err);
              span.end();
              subscriber.error(err);
            },
            complete: () => {
              span.end();
              subscriber.complete();
            },
          });
        }
      );
    });
  }
}
```

---

## Fase 2 — Pino + nestjs-pino com serializer OTel

### 2.1 Atualizar `LoggerService` — injetar traceId/spanId do span ativo

Arquivo: `packages/observability/src/logger/logger.service.ts`

**Mudança:** trocar o `buildContext()` manual por um formatter Pino que lê o span ativo do OTel via `@opentelemetry/api`.

```typescript
// Adicionar no construtor do pino, dentro do logger.service.ts
formatters: {
  log(obj: Record<string, unknown>) {
    const span = trace.getActiveSpan();
    if (!span) return obj;
    const ctx = span.spanContext();
    return {
      ...obj,
      traceId: ctx.traceId,
      spanId: ctx.spanId,
    };
  },
},
```

Isso garante que **todo log** emitido dentro de um request (HTTP ou AMQP) tenha automaticamente `traceId` e `spanId` sem chamada manual.

### 2.2 Criar `LoggerModule` com nestjs-pino

Arquivo: `packages/observability/src/logger/logger.module.ts`

**Antes:** `LoggerModule.forRoot({ serviceName })` registra apenas `LoggerService`.  
**Depois:** também configura o `LoggerModule` do `nestjs-pino` para interceptação automática de HTTP com pino-http.

```typescript
// packages/observability/src/logger/logger.module.ts
import { Module, DynamicModule } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { LoggerService } from './logger.service';

export interface LoggerModuleOptions {
  serviceName: string;
}

@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          pinoHttp: {
            level: process.env.LOG_LEVEL ?? 'info',
            autoLogging: true,
            customProps: (req) => ({
              service: options.serviceName,
              correlationId: req.headers['x-correlation-id'],
            }),
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            transport: process.env.NODE_ENV !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }
              : undefined,
          },
        }),
      ],
      providers: [
        { provide: 'LOGGER_OPTIONS', useValue: options },
        LoggerService,
      ],
      exports: [LoggerService, PinoLoggerModule],
    };
  }
}
```

---

## Fase 3 — Propagação de contexto em eventos RabbitMQ

O `AmqplibInstrumentation` (adicionado na Fase 1) já injeta automaticamente o `traceparent` nos headers das mensagens AMQP no nível do protocolo. Porém como os serviços usam `@nestjs/microservices` (Transport.RMQ), que é um wrapper sobre amqplib, o resultado é:

- **Publishers (emit):** span criado automaticamente com `messaging.operation = publish`.  
- **Consumers (@MessagePattern/@EventPattern):** span criado automaticamente com `messaging.operation = receive`.

### 3.1 Adicionar `TracingInterceptor` para spans de processamento

Este interceptor cria um **span filho explícito** por handler, fornecendo granularidade para ver quanto tempo cada `UseCase` leva dentro do span de "receive":

Criar: `packages/observability/src/tracing/tracing.interceptor.ts`

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const tracer = trace.getTracer('nestjs-handler');
    const controllerName = ctx.getClass().name;
    const handlerName = ctx.getHandler().name;
    const spanName = `${controllerName}.${handlerName}`;

    return new Observable((subscriber) => {
      tracer.startActiveSpan(spanName, { kind: SpanKind.INTERNAL }, (span) => {
        next.handle().pipe(
          tap(() => { span.setStatus({ code: SpanStatusCode.OK }); span.end(); }),
          catchError((err) => {
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            span.end();
            throw err;
          }),
        ).subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
```

### 3.2 Criar `TracingModule`

Criar: `packages/observability/src/tracing/tracing.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TracingInterceptor } from './tracing.interceptor';

@Module({
  providers: [TracingInterceptor],
  exports: [TracingInterceptor],
})
export class TracingModule {}
```

### 3.3 Atualizar `index.ts` do pacote

```typescript
// Adicionar ao packages/observability/src/index.ts
export * from './tracing/tracing';
export * from './tracing/tracing.interceptor';
export * from './tracing/tracing.module';
```

---

## Fase 4 — Métricas EDA: consumer lag + Exemplars

### 4.1 Adicionar métricas de fila ao `MetricsService`

Arquivo: `packages/observability/src/metrics/metrics.service.ts`

**Adicionar:**

```typescript
// Dead Letter Queue depth (RabbitMQ)
readonly dlqDepth: Gauge<string>;
readonly consumerLag: Gauge<string>;  // mensagens pendentes por fila

// No constructor:
this.dlqDepth = new Gauge({
  name: 'rabbitmq_dlq_depth',
  help: 'Número de mensagens na Dead Letter Queue',
  labelNames: ['queue'],
  registers: [this.registry],
});

this.consumerLag = new Gauge({
  name: 'rabbitmq_consumer_lag_messages',
  help: 'Mensagens pendentes (não processadas) por fila',
  labelNames: ['queue'],
  registers: [this.registry],
});
```

### 4.2 Adicionar Exemplars para correlação Métricas ↔ Traces

Arquivo: `packages/observability/src/metrics/metrics.interceptor.ts`

```typescript
// No método record() do handleHttp:
import { trace } from '@opentelemetry/api';

const activeSpan = trace.getActiveSpan();
const exemplarLabels = activeSpan
  ? { traceId: activeSpan.spanContext().traceId, ...labels }
  : labels;

this.metrics.httpRequestDuration.observe(exemplarLabels, duration);
```

> ⚠️ Exemplars requerem `prom-client >= 14.x` e Prometheus `>= 2.43` com `--enable-feature=exemplar-storage`. Verificar versão no `docker-compose.yml` (atual: `v2.53.0` ✅).

### 4.3 Consumer lag via RabbitMQ Management API

Criar: `packages/observability/src/metrics/rabbitmq-lag.collector.ts`

```typescript
// Polling da RabbitMQ Management API a cada 30s para atualizar a Gauge
import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MetricsService } from './metrics.service';

@Injectable()
export class RabbitMQLagCollector implements OnModuleInit {
  private readonly mgmtUrl = process.env.RABBITMQ_MGMT_URL ?? 'http://rabbitmq:15672';
  private readonly user = process.env.RABBITMQ_USER ?? 'guest';
  private readonly pass = process.env.RABBITMQ_PASS ?? 'guest';

  constructor(
    private readonly http: HttpService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit() {
    setInterval(() => this.collect(), 30_000);
  }

  private async collect() {
    try {
      const { data } = await this.http.axiosRef.get(`${this.mgmtUrl}/api/queues`, {
        auth: { username: this.user, password: this.pass },
      });
      for (const q of data) {
        this.metrics.consumerLag.set({ queue: q.name }, q.messages ?? 0);
        const dlqMatch = q.name.match(/\.dlq$/i);
        if (dlqMatch) {
          this.metrics.dlqDepth.set({ queue: q.name }, q.messages ?? 0);
        }
      }
    } catch {
      // não propaga erro — coleta é best-effort
    }
  }
}
```

---

## Fase 5 — Infraestrutura: Loki + Tempo + OTel Collector

### 5.1 OTel Collector

Criar: `infra/otel-collector/otel-collector.yml`

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 512
  memory_limiter:
    check_interval: 1s
    limit_mib: 256

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write
  loki:
    endpoint: http://loki:3100/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [loki]
```

### 5.2 Grafana Tempo

Criar: `infra/tempo/tempo.yml`

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks
    wal:
      path: /tmp/tempo/wal

compactor:
  compaction:
    block_retention: 48h
```

### 5.3 Grafana Loki

Criar: `infra/loki/loki-config.yml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: loki_index_
        period: 24h

storage_config:
  tsdb_shipper:
    active_index_directory: /loki/tsdb-index
    cache_location: /loki/tsdb-cache
  filesystem:
    directory: /loki/chunks

limits_config:
  allow_structured_metadata: true

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100
```

### 5.4 Atualizar `docker-compose.yml` — adicionar os 3 novos serviços

No arquivo `docker-compose.yml`, adicionar na **Camada 4: Observabilidade**, após o serviço `grafana`:

```yaml
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.115.0
    container_name: otel-collector
    ports:
      - '4317:4317'   # OTLP gRPC
      - '4318:4318'   # OTLP HTTP
      - '8888:8888'   # collector internal metrics
    volumes:
      - ./infra/otel-collector/otel-collector.yml:/etc/otelcol-contrib/config.yaml:ro
    depends_on:
      - prometheus
      - loki
      - tempo

  tempo:
    image: grafana/tempo:2.6.0
    container_name: tempo
    command: ['-config.file=/etc/tempo.yml']
    ports:
      - '3200:3200'   # Tempo UI / query
    volumes:
      - ./infra/tempo/tempo.yml:/etc/tempo.yml:ro
      - tempo_data:/tmp/tempo

  loki:
    image: grafana/loki:3.2.0
    container_name: loki
    ports:
      - '3100:3100'
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./infra/loki/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
```

E em `volumes:`, adicionar:

```yaml
  tempo_data:
  loki_data:
```

Atualizar o serviço `grafana` para adicionar as novas dependências:

```yaml
  grafana:
    depends_on:
      - prometheus
      - loki      # adicionar
      - tempo     # adicionar
```

### 5.5 Adicionar datasources Loki e Tempo no Grafana

Criar: `infra/grafana/provisioning/datasources/loki.yml`

```yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    uid: loki
    url: http://loki:3100
    access: proxy
    jsonData:
      derivedFields:
        - name: TraceID
          matcherRegex: '"traceId":"(\w+)"'
          url: '$${__value.raw}'
          datasourceUid: tempo
```

Criar: `infra/grafana/provisioning/datasources/tempo.yml`

```yaml
apiVersion: 1
datasources:
  - name: Tempo
    type: tempo
    uid: tempo
    url: http://tempo:3200
    access: proxy
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        filterByTraceID: true
      tracesToMetrics:
        datasourceUid: prometheus
        queries:
          - name: 'Request rate'
            query: 'rate(http_requests_total{service="$__tags{service.name}"}[5m])'
      serviceMap:
        datasourceUid: prometheus
      nodeGraph:
        enabled: true
```

---

## Fase 6 — Inicialização do OTel por serviço

**Regra crítica:** o OTel SDK deve ser inicializado **antes** de qualquer `import` que carregue módulos Node.js (http, amqplib, pg, etc.) — caso contrário a auto-instrumentação não funciona.

### 6.1 Criar `tracing.ts` em cada serviço

Criar em cada `apps/*/src/tracing.ts`:

```typescript
// apps/api-gateway/src/tracing.ts
import { createOtelSDK } from '@ecommerce/observability';

const sdk = createOtelSDK(process.env.SERVICE_NAME ?? 'api-gateway');
sdk.start();

process.on('SIGTERM', () => sdk.shutdown().catch(console.error));
process.on('SIGINT', () => sdk.shutdown().catch(console.error));
```

Serviços e seus `SERVICE_NAME`:
- `api-gateway`
- `order-service`
- `payment-service`
- `user-service`

### 6.2 Atualizar `main.ts` de cada serviço — primeira linha

```typescript
// apps/api-gateway/src/main.ts  ← primeira linha, antes de tudo
import './tracing';

import { NestFactory } from '@nestjs/core';
// ... resto do arquivo sem alterações
```

Repetir para `order-service`, `payment-service` e `user-service`.

### 6.3 Adicionar variáveis de ambiente por serviço no `docker-compose.yml`

```yaml
# Em cada serviço:
environment:
  - SERVICE_NAME=order-service          # nome do serviço no Tempo
  - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
  - OTEL_SERVICE_NAME=order-service
  - OTEL_PROPAGATORS=tracecontext,baggage
```

### 6.4 Registrar `TracingInterceptor` como `APP_INTERCEPTOR` em cada módulo

Em cada `*.module.ts` (api-gateway, order-service, payment-service, user-service):

```typescript
// Adicionar ao providers[], junto com LoggerInterceptor e MetricsInterceptor:
import { TracingModule, TracingInterceptor } from '@ecommerce/observability';

providers: [
  { provide: APP_INTERCEPTOR, useClass: LoggerInterceptor },
  { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  { provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor },
  { provide: APP_INTERCEPTOR, useClass: TracingInterceptor },  // ← novo
],
imports: [
  TracingModule,  // ← novo
  // ...
]
```

---

## Fase 7 — Health: consumer lag check

### 7.1 Criar `RabbitMQHealthIndicator`

Criar: `packages/observability/src/health/rabbitmq-health.indicator.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { HttpService } from '@nestjs/axios';

export interface RabbitMQHealthOptions {
  maxQueueDepth?: number;       // padrão: 1000
  queues?: string[];            // filas a monitorar (default: todas)
}

@Injectable()
export class RabbitMQHealthIndicator extends HealthIndicator {
  private readonly mgmtUrl = process.env.RABBITMQ_MGMT_URL ?? 'http://rabbitmq:15672';
  private readonly user = process.env.RABBITMQ_USER ?? 'guest';
  private readonly pass = process.env.RABBITMQ_PASS ?? 'guest';

  constructor(private readonly http: HttpService) {
    super();
  }

  async checkQueues(
    key: string,
    options: RabbitMQHealthOptions = {}
  ): Promise<HealthIndicatorResult> {
    const maxDepth = options.maxQueueDepth ?? 1000;
    try {
      const { data } = await this.http.axiosRef.get(`${this.mgmtUrl}/api/queues`, {
        auth: { username: this.user, password: this.pass },
        timeout: 3000,
      });

      const filtered = options.queues
        ? data.filter((q: any) => options.queues!.includes(q.name))
        : data;

      const overloaded = filtered.filter((q: any) => q.messages > maxDepth);

      if (overloaded.length > 0) {
        const details = Object.fromEntries(
          overloaded.map((q: any) => [q.name, { messages: q.messages, maxDepth }])
        );
        throw new HealthCheckError('RabbitMQ queues overloaded', this.getStatus(key, false, details));
      }

      return this.getStatus(key, true, {
        queues: filtered.length,
        maxMessages: Math.max(...filtered.map((q: any) => q.messages ?? 0), 0),
      });
    } catch (err) {
      if (err instanceof HealthCheckError) throw err;
      throw new HealthCheckError('RabbitMQ unreachable', this.getStatus(key, false, { error: err.message }));
    }
  }
}
```

### 7.2 Expor o indicador no `HealthModule`

Atualizar `packages/observability/src/health/health.module.ts` para exportar o novo indicador.

### 7.3 Usar no `HealthController` dos serviços com fila

Atualizar `packages/observability/src/health/health.controller.ts`:

```typescript
@Get('ready')
@HealthCheck()
async ready(): Promise<HealthCheckResult> {
  const checks = [];
  if (this.options.database) {
    checks.push(() => this.db.pingCheck('database', { timeout: 300 }));
  }
  if (this.options.rabbitmq) {
    checks.push(() => this.rmq.checkQueues('rabbitmq', { maxQueueDepth: 1000 }));
  }
  return this.health.check(checks);
}
```

---

## Fase 8 — Dashboards Grafana unificados

### 8.1 Atualizar dashboard existente `microservices.json`

**Adicionar painéis:**

1. **Traces por serviço** (datasource: Tempo) — lista de traces recentes com search por `service.name`
2. **Service Map** (datasource: Tempo + `nodeGraph: enabled`) — grafo de dependências automático
3. **Logs** (datasource: Loki) — stream de logs filtrado por `service`, com link para trace via `traceId`
4. **DLQ Depth** (datasource: Prometheus) — Gauge da métrica `rabbitmq_dlq_depth`
5. **Consumer Lag** (datasource: Prometheus) — Time series de `rabbitmq_consumer_lag_messages`

### 8.2 Criar dashboard `traces.json`

Dashboard dedicado ao tracing com:
- Scatter plot de latência por span (P50/P95/P99)
- Lista de traces com erro (status = ERROR)
- Drill-down: clicar num trace abre o Tempo UI com waterfall view
- Exemplars: pontos no gráfico de latência clicáveis que abrem o trace correspondente

### 8.3 Criar dashboard `logs.json`

Dashboard dedicado a logs com:
- Volume de logs por nível (info/warn/error) por serviço
- Stream ao vivo de logs de erro
- Campo `traceId` linkado ao Tempo (configurado via `derivedFields` no datasource Loki)

---

## Sequência de execução

```
┌─────────────────────────────────────┐
│ 1. pnpm add (packages/observability)│  Fase 1.1
│ 2. Refatorar CorrelationService     │  Fase 1.3
│ 3. Refatorar CorrelationMiddleware  │  Fase 1.4
│ 4. Refatorar CorrelationInterceptor │  Fase 1.5
│ 5. Criar tracing/tracing.ts         │  Fase 1.2
│ 6. Criar TracingInterceptor         │  Fase 3.1
│ 7. Criar TracingModule              │  Fase 3.2
│ 8. Atualizar LoggerService (otel)   │  Fase 2.1
│ 9. Atualizar LoggerModule (nestjs-pino) │ Fase 2.2
│ 10. Adicionar métricas EDA          │  Fase 4.1
│ 11. Adicionar Exemplars             │  Fase 4.2
│ 12. Criar RabbitMQLagCollector      │  Fase 4.3
│ 13. Criar RabbitMQHealthIndicator   │  Fase 7.1–7.2
│ 14. Atualizar index.ts              │  Fase 3.3
│ 15. Build + checar erros TS         │  Validação
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ 16. Criar tracing.ts por serviço    │  Fase 6.1
│ 17. Atualizar main.ts (import first)│  Fase 6.2
│ 18. Atualizar *.module.ts           │  Fase 6.3–6.4
│ 19. Adicionar envs no docker-compose│  Fase 6.3
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ 20. Criar infra/otel-collector/     │  Fase 5.1
│ 21. Criar infra/tempo/              │  Fase 5.2
│ 22. Criar infra/loki/               │  Fase 5.3
│ 23. Atualizar docker-compose.yml    │  Fase 5.4
│ 24. Criar datasources Loki + Tempo  │  Fase 5.5
│ 25. Atualizar/criar dashboards      │  Fase 8
└─────────────────────────────────────┘
```

---

## Checklist de validação por fase

### Fase 1–3 (OTel SDK + CorrelationService)
- [ ] `pnpm build` no pacote `@ecommerce/observability` sem erros TS
- [ ] Nenhum `AsyncLocalStorage` restante em `correlation.service.ts`
- [ ] `CorrelationService.getTraceId()` retorna o traceId do OTel active span
- [ ] `CorrelationInterceptor` cria span filho em handlers RPC

### Fase 2 (Pino)
- [ ] Logs emitidos em formato JSON em produção
- [ ] Campos `traceId` e `spanId` presentes nos logs quando há span ativo
- [ ] Redact funcionando para `password`, `token`, `cpf`

### Fase 4 (Métricas)
- [ ] `GET /metrics` de qualquer serviço retorna `rabbitmq_consumer_lag_messages`
- [ ] `GET /metrics` retorna `rabbitmq_dlq_depth`
- [ ] Histogramas retornam Exemplars com `traceId`

### Fase 5 (Infra)
- [ ] `docker-compose up` sobe sem erros
- [ ] OTel Collector acessível em `localhost:4317`
- [ ] Tempo UI acessível em `http://localhost:3200`
- [ ] Loki acessível em `http://localhost:3100`
- [ ] Grafana mostra 4 datasources: Prometheus, Loki, Tempo + Alertmanager

### Fase 6 (Serviços)
- [ ] `import './tracing'` é a primeira linha de TODOS os `main.ts`
- [ ] Ao fazer `POST /orders`, um trace aparece no Tempo com spans:
  - `POST /orders` (api-gateway)
  - `CreateOrderUseCase.execute` (order-service)
  - `publish order.created.accepted` (order-service → RabbitMQ)
  - `consume order.created.accepted` (payment-service)
- [ ] O `traceId` aparece no log do api-gateway E no log do order-service para o mesmo request

### Fase 7 (Health)
- [ ] `GET /health/ready` no order-service retorna status das filas RabbitMQ
- [ ] Com DLQ com > 1000 mensagens, `/health/ready` retorna `503`

### Fase 8 (Dashboards)
- [ ] Dashboard "Traces" exibe waterfall por serviço
- [ ] Clicar em um Exemplar no painel de latência abre o trace no Tempo
- [ ] Clicar em `traceId` nos logs (Loki) abre o trace no Tempo

---

## Dependências e versões fixadas

| Pacote | Versão | Notas |
|---|---|---|
| `@opentelemetry/sdk-node` | `^0.57.0` | NestJS compatible |
| `@opentelemetry/api` | `^1.9.0` | já é peerDep transitiva |
| `@opentelemetry/auto-instrumentations-node` | `^0.56.0` | inclui http, pg, amqplib |
| `@opentelemetry/exporter-trace-otlp-grpc` | `^0.57.0` | exporta para OTel Collector |
| `@opentelemetry/instrumentation-amqplib` | `^0.46.0` | RabbitMQ auto-instrumentação |
| `nestjs-pino` | `^4.3.0` | integração pino-http com NestJS |
| `otel/opentelemetry-collector-contrib` | `0.115.0` | Docker image |
| `grafana/tempo` | `2.6.0` | Docker image |
| `grafana/loki` | `3.2.0` | Docker image |

---

## Breaking changes e estratégia de migração

| O que quebra | Como tratar |
|---|---|
| `CorrelationService.run()` removido | Usado apenas internamente no `CorrelationMiddleware` e `CorrelationInterceptor` — ambos refatorados na Fase 1 |
| `CorrelationContext` interface removida | Não exportada para os serviços — apenas usada internamente |
| `correlationId` nos logs muda de UUID v4 para formato OTel traceId (hex 32 chars) | Formato mais rico — nenhum impacto funcional | 
| `getCorrelationId()` retorna `traceId` OTel | Comportamento equivalente — é o identificador único do request |

Nenhum breaking change nos `apps/*` — a API pública do `@ecommerce/observability` é mantida.
