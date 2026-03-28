# Observabilidade — Arquitetura e Implementação

Descreve a arquitetura de observabilidade adotada no projeto, as decisões técnicas e o estado atual de implementação.

> **Para uso prático (como subir, consultar traces, exemplars, etc.) veja o [Guia de Uso](../guides/observabilidade-uso.md).**

---

## Estado Atual: Implementado ✅

O stack de observabilidade está **completamente implementado e funcional** no branch `feature/tracing`. Todos os serviços exportam traces, logs e métricas para um backend unificado de telemetria.

---

## Arquitetura do Stack

```
┌──────────────────────────────────────────────────────────────────────┐
│  Serviços NestJS (api-gateway, order, payment, user)                 │
│                                                                      │
│  OTel SDK (sdk-node)  ─── AmqplibInstrumentation                    │
│       │ traces (OTLP gRPC)                                           │
│       │ logs (stdout → container logs)                               │
│       │ metrics (/metrics endpoint → Prometheus scrape)             │
└───────┼──────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│  OTel Collector Contrib           │
│  :4317 (gRPC) / :4318 (HTTP)      │
│                                   │
│  Pipelines:                       │
│  traces  → Grafana Tempo :4317    │
│  metrics → Prometheus :9090       │
│  logs    → Loki :3100 (OTLP)      │
└────────────┬──────────────────────┘
             │
   ┌─────────┼──────────┐
   ▼         ▼          ▼
Tempo      Prometheus   Loki
:3200      :9090        :3110
   └─────────┴──────────┘
             │
             ▼
         Grafana :3100
    (Tempo + Prometheus + Loki
     datasources provisionados)
```

---

## Componentes do `@ecommerce/observability`

O pacote compartilhado `packages/observability` centraliza toda a lógica de telemetria.

### `createOtelSDK(serviceName)` — Bootstrap

Factory function que inicializa o `NodeSDK` do OpenTelemetry. Importada na **primeira linha** de cada `main.ts` antes do NestJS:

```typescript
// apps/order-service/src/tracing.ts
import { createOtelSDK } from '@ecommerce/observability';

const sdk = createOtelSDK('order-service');
sdk.start();
```

Configuração do SDK:

- **Exporter:** OTLP gRPC → `otel-collector:4317`
- **Resource:** `service.name`, `service.version` (via `APP_VERSION`)
- **Auto-instrumentações:** HTTP, Express, TypeORM, NestJS, amqplib (RabbitMQ)
- **Desabilitadas:** `fs`, `dns` (muito verbosas)
- **Propagação:** W3C TraceContext + Baggage

### `TracingModule` / `TracingInterceptor`

Interceptor NestJS que cria um span filho (`ControllerName.methodName`, `SpanKind.INTERNAL`) para cada handler executado. Registrado via `APP_INTERCEPTOR` em cada módulo raiz.

### `LoggerModule` / `LoggerService`

Wrapper sobre **nestjs-pino** configurado com:

- `autoLogging: true` — loga request/response automaticamente
- Formatter que injeta `traceId` e `spanId` do OTel active span em **cada linha de log**
- Redação automática de `authorization`, `cookie`, `*.password`, `*.token`
- `pino-pretty` em desenvolvimento, JSON em produção

### `CorrelationService`

Lê `traceId` e `spanId` diretamente do `trace.getActiveSpan()` do OTel (sem AsyncLocalStorage próprio — o SDK gerencia o contexto internamente).

### `CorrelationMiddleware`

Middleware HTTP que adiciona `X-Correlation-ID` e `X-Trace-ID` nos headers de resposta usando o span OTel ativo.

### `CorrelationInterceptor`

Interceptor RPC que extrai `traceparent` do payload de eventos RabbitMQ e reconstitui o span pai via `propagation.extract()`.

### `MetricsModule` / `MetricsService`

Expõe métricas via `/metrics` em formato **OpenMetrics** (necessário para suporte a Exemplars). Registra:

- `http_request_duration_seconds` (Histogram, com Exemplars)
- `http_requests_total` (Counter, com Exemplars)
- `event_published_total`, `event_consumed_total`, `event_processing_duration_seconds`
- `consumer_lag`, `dlq_depth` (Gauges populadas pelo `RabbitMQLagCollector`)
- `orders_created_total`, `orders_failed_total`, `payments_processed_total`

### `MetricsInterceptor`

Interceptor automático que observa duração e contagem de requisições HTTP e RPC, com Exemplars vinculando cada observação ao `traceId` OTel ativo.

### `RabbitMQLagCollector`

`OnModuleInit` que faz polling da RabbitMQ Management API a cada 30s e atualiza as Gauges `consumer_lag` e `dlq_depth` por fila.

### `HealthModule` / `RabbitMQHealthIndicator`

Controller `/health` (via `@nestjs/terminus`) que verifica:

- Banco de dados PostgreSQL (TypeORM) — quando `database: true`
- RabbitMQ via Management API — verifica profundidade das filas (fail se > `maxQueueDepth`, padrão 1000)

---

## Diferenciadores de Design

### OpenMetrics para Exemplars

O registry `prom-client` é criado no modo **OpenMetrics** (`registry.setContentType(openMetricsContentType)`). Isso é obrigatório para que Histogramas e Counters suportem Exemplars. O Prometheus scrapa no formato OpenMetrics automaticamente quando o Content-Type é `application/openmetrics-text`.

### Propagação W3C em RabbitMQ

A `AmqplibInstrumentation` injeta o header `traceparent` W3C nas propriedades de cada mensagem publicada via amqplib/AMQP 0-9-1. No consumidor, o `CorrelationInterceptor` extrai esse header via `propagation.extract()` e cria o span filho com o contexto correto, mantendo a cadeia de causalidade trace → evento → trace.

### Exemplars como ponte Prometheus → Tempo

Cada observação de Histogram e Counter HTTP inclui um Exemplar com `traceId`. No Grafana, ao visualizar um histograma no modo scatter, cada ponto é um Exemplar clicável que abre o trace correspondente no Tempo — eliminando a necessidade de copiar IDs manualmente entre ferramentas.

---

## Infraestrutura (`infra/`)

| Arquivo                                   | Descrição                                                |
| ----------------------------------------- | -------------------------------------------------------- |
| `infra/otel-collector/otel-collector.yml` | Configuração do Collector: pipelines traces/metrics/logs |
| `infra/tempo/tempo.yml`                   | Tempo 2.6.1 — storage em `/var/tempo`, S3-like local     |
| `infra/loki/loki-config.yml`              | Loki — ingesta via OTLP nativo (Loki 3.x)                |
| `infra/prometheus/prometheus.yml`         | Prometheus — scrape de `/metrics` em todos os serviços   |
| `infra/grafana/provisioning/`             | Datasources Tempo, Loki, Prometheus pré-configurados     |

### Nota sobre versões fixadas

- **Tempo:** fixado em `grafana/tempo:2.6.1` — versões 2.7+ requerem Kafka para o WAL do distributor
- **Loki:** exporta logs via `otlp_http` (exporter nativo) — o exporter legado `loki` foi removido no OTel Collector 0.100+
- **OTel Collector:** `otel/opentelemetry-collector-contrib:latest` com alias corretos (`otlp_grpc` / `otlp_http` em vez dos deprecated `otlp` / `otlphttp`)

---

## Decisão Relacionada

Ver [ADR-002 — Observabilidade em Arquitetura Event-Driven](../adr/002-observabilidade-arquitetura-event-driven.md) para o racional da escolha do stack.
