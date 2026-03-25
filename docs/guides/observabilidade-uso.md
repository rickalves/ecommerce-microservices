# Guia de Uso — Observabilidade (OTel Stack)

Este guia cobre o uso prático do stack de observabilidade implementado no projeto: traces distribuídos, logs estruturados, métricas com Exemplars e health checks.

---

## Stack de Tecnologias

| Componente         | Tecnologia                                  | Porta       |
| ------------------ | ------------------------------------------- | ----------- |
| Traces             | OpenTelemetry SDK + Grafana Tempo 2.6.1     | `3200`      |
| Logs               | nestjs-pino + Grafana Loki                  | `3110`      |
| Métricas           | prom-client (OpenMetrics) + Prometheus      | `9090`      |
| Visualização       | Grafana 11.1                                | `3100`      |
| Collector          | OTel Collector Contrib                      | `4317/4318` |

---

## 1. Subir o Stack de Observabilidade

### Apenas infra (sem recompilar as aplicações)

```bash
docker compose up -d postgres-users postgres-orders postgres-payments rabbitmq \
  prometheus grafana otel-collector tempo loki
```

### Stack completo (com serviços NestJS)

```bash
docker compose up -d
```

### Verificar se todos os containers estão saudáveis

```bash
docker compose ps
```

Os containers esperados são:

| Container       | Status  |
| --------------- | ------- |
| postgres-users  | healthy |
| postgres-orders | healthy |
| postgres-payments | healthy |
| rabbitmq        | healthy |
| otel-collector  | running |
| tempo           | running |
| loki            | running |
| prometheus      | running |
| grafana         | running |
| user-service    | running |
| order-service   | running |
| payment-service | running |
| api-gateway     | running |

---

## 2. Interfaces de Visualização

### Grafana — http://localhost:3100

- **Login:** `admin` / `admin`
- Datasources pré-configurados: **Tempo**, **Loki**, **Prometheus**

### Prometheus — http://localhost:9090

- Interface para explorar métricas brutas e construir PromQL queries

### RabbitMQ Management — http://localhost:15672

- **Login:** `guest` / `guest`
- Útil para inspecionar filas, consumer lag e mensagens mortas (DLQ)

---

## 3. Traces Distribuídos (Grafana Tempo)

### Como funciona

O OTel SDK é inicializado **antes** do NestJS em cada serviço via `import './tracing'` na primeira linha do `main.ts`. Isso garante que os patches de auto-instrumentação (HTTP, TypeORM, amqplib) estejam ativos desde o boot:

```typescript
// apps/order-service/src/main.ts
import './tracing'; // ← sempre em primeiro lugar
import { NestFactory } from '@nestjs/core';
...
```

Cada serviço exporta spans via OTLP gRPC (`otel-collector:4317`) → collector roteia para Tempo.

### Propagação de contexto

- **HTTP:** W3C `traceparent` header é propagado automaticamente pelo `fetch`/`axios` auto-instrumentation
- **RabbitMQ:** `AmqplibInstrumentation` injeta o contexto W3C nas propriedades da mensagem AMQP
- **Entre microserviços:** o `CorrelationInterceptor` extrai `traceparent` do payload RPC e recria o span filho no contexto correto

### Abrindo um trace no Grafana

1. Acesse **Grafana → Explore**
2. Selecione datasource **Tempo**
3. Use **TraceQL** ou cole um `traceId` diretamente
4. Exemplo: `{ resource.service.name = "order-service" } | select(span.http.method, span.http.route)`

### Obtendo o traceId de uma requisição

Toda resposta HTTP inclui o header `X-Trace-ID`:

```bash
curl -s -I -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"...","items":[...]}' | grep -i x-trace
# X-Trace-ID: 73f3d90da76ee85a6575a96fff532a7a
```

---

## 4. Logs Estruturados (Grafana Loki)

### Correlação automática

O `LoggerModule` (nestjs-pino) injeta automaticamente `traceId` e `spanId` do OTel active span em **cada log** emitido dentro de um request. Isso permite ir de um log diretamente ao trace correspondente no Grafana.

### Usando o LoggerService

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@ecommerce/observability';

@Injectable()
export class CreateOrderUseCase {
    constructor(private readonly logger: LoggerService) {}

    async execute(dto: CreateOrderDto) {
        // Log com contexto estruturado
        this.logger.info('Creating order', { userId: dto.userId, itemCount: dto.items.length });

        try {
            const order = await this.repository.save(dto);
            this.logger.logEvent('order.created', { orderId: order.id, totalAmount: order.totalAmount });
            return order;
        } catch (error) {
            this.logger.error('Failed to create order', error.stack, { userId: dto.userId });
            throw error;
        }
    }
}
```

### Níveis de log disponíveis

```typescript
logger.trace('Detalhe de debug profundo');  // só em dev
logger.debug('Debug info');
logger.info('Operação normal');
logger.warn('Aviso');
logger.error('Erro', error.stack, { context });
logger.fatal('Erro fatal');
logger.logEvent('order.created', { orderId });  // log de evento de negócio
logger.logMetric('order_processing_time', ms, 'ms', { orderId }); // log de métrica
```

### Consultando logs no Grafana

1. **Grafana → Explore → Loki**
2. Exemplos de queries LogQL:

```logql
# Todos os logs do order-service
{service="order-service"}

# Logs de erro em qualquer serviço
{service=~".+"} |= "ERROR"

# Logs de um trace específico (navegando a partir do Tempo)
{service="payment-service"} | json | traceId="73f3d90da76ee85a6575a96fff532a7a"

# Logs de erro com stack trace
{service="payment-service"} | json | level="error"
```

3. No painel de traces do Tempo, clique em **"Logs for this span"** para navegar automaticamente para os logs correlacionados no Loki.

---

## 5. Métricas com Exemplars (Prometheus + Grafana)

### Métricas expostas por serviço

Cada serviço expõe métricas em `/metrics` no formato **OpenMetrics** (necessário para Exemplars).

| Métrica                             | Tipo      | Labels                               | Descrição                            |
| ----------------------------------- | --------- | ------------------------------------ | ------------------------------------ |
| `http_request_duration_seconds`     | Histogram | `method`, `route`, `status_code`     | Latência das requisições HTTP        |
| `http_requests_total`               | Counter   | `method`, `route`, `status_code`     | Total de requisições HTTP            |
| `event_published_total`             | Counter   | `event_type`                         | Eventos publicados no RabbitMQ       |
| `event_consumed_total`              | Counter   | `event_type`, `status`               | Eventos consumidos do RabbitMQ       |
| `event_processing_duration_seconds` | Histogram | `event_type`                         | Duração do processamento de eventos  |
| `consumer_lag`                      | Gauge     | `queue`                              | Mensagens pendentes por fila         |
| `dlq_depth`                         | Gauge     | `queue`                              | Profundidade das DLQs                |
| `orders_created_total`              | Counter   | `service`                            | Pedidos criados                      |
| `orders_failed_total`               | Counter   | `service`                            | Pedidos com falha                    |
| `payments_processed_total`          | Counter   | `service`                            | Pagamentos processados               |

### Exemplars — navegando de métrica para trace

Histogramas e Counters HTTP incluem **Exemplars** com o `traceId` OTel. Para visualizar:

1. **Grafana → Explore → Prometheus**
2. Execute uma query de histograma:
   ```promql
   histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="api-gateway"}[5m]))
   ```
3. Clique no ícone de **barra de dispersão (scatter)** na visualização
4. Os pontos no gráfico são os Exemplars — clique em um ponto para abrir o trace correspondente no Tempo

### Consultando métricas brutas via endpoint

```bash
# Métricas do API Gateway (formato OpenMetrics)
curl -H "Accept: application/openmetrics-text" http://localhost:3000/metrics

# Métricas do Order Service
curl -H "Accept: application/openmetrics-text" http://localhost:3002/metrics
```

---

## 6. Health Checks

Todos os serviços expõem `/health` com verificação de banco de dados e RabbitMQ.

### Verificar todos os serviços

```bash
curl http://localhost:3000/health  # api-gateway
curl http://localhost:3001/health  # user-service
curl http://localhost:3002/health  # order-service
curl http://localhost:3003/health  # payment-service
```

### Resposta esperada (saudável)

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "rabbitmq": { "status": "up", "queues": 4, "maxMessages": 0 }
  },
  "error": {},
  "details": { ... }
}
```

O `RabbitMQHealthIndicator` verifica profundidade de filas via RabbitMQ Management API — reporta `down` se qualquer fila ultrapassar 1000 mensagens (configurável via `maxQueueDepth`).

---

## 7. Investigando Falhas com o Stack Completo

### Exemplo: rastrear uma falha de pagamento

```bash
# 1. Criar um pedido
TOKEN="seu-jwt-token"
ORDER=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"<UUID>","items":[{"productId":"prod-1","quantity":1,"price":100}]}')

ORDER_ID=$(echo $ORDER | jq -r '.id')
echo "Order: $ORDER_ID"

# 2. Capturar o traceId do header de resposta
TRACE_ID=$(curl -sI -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"<UUID>","items":[...]}' | grep -i x-trace-id | awk '{print $2}' | tr -d '\r')

echo "traceId: $TRACE_ID"

# 3. Buscar o trace no Tempo
# Acesse: http://localhost:3100 → Explore → Tempo → cole o traceId

# 4. Buscar logs do trace no Loki
# Query LogQL: {service=~".+"} | json | traceId="$TRACE_ID"
```

### Navegação completa (Metrics → Trace → Logs)

```
Prometheus: percentil 99 sobe  →  identificar pico no Exemplar
     ↓
Tempo: abrir o traceId do Exemplar  →  ver span com erro
     ↓
Loki: clicar "Logs for this span"  →  ver stack trace completo
```

---

## 8. Adicionando Métricas de Negócio em um Serviço

Injete `MetricsService` onde necessário e use os contadores/histogramas pré-definidos:

```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService } from '@ecommerce/observability';

@Injectable()
export class ProcessPaymentUseCase {
    constructor(private readonly metrics: MetricsService) {}

    async execute(dto: ProcessPaymentDto) {
        const start = Date.now();
        try {
            // ...lógica de pagamento...
            this.metrics.paymentsProcessedTotal.inc({ service: 'payment-service' });
            this.metrics.eventPublishedTotal.inc({ event_type: 'payment.completed' });
        } finally {
            this.metrics.eventProcessingDuration.observe(
                { event_type: 'payment.process' },
                (Date.now() - start) / 1000
            );
        }
    }
}
```

---

## 9. Adicionando Spans Customizados

Para cobrir lógica de negócio que não é auto-instrumentada:

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('payment-service');

await tracer.startActiveSpan('PaymentGateway.charge', async (span) => {
    try {
        span.setAttribute('payment.amount', amount);
        span.setAttribute('payment.method', method);
        const result = await gateway.charge(amount);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
    } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
    } finally {
        span.end();
    }
});
```

---

## 10. Variáveis de Ambiente

Cada serviço NestJS suporta as seguintes variáveis para controlar a observabilidade:

| Variável                        | Padrão                          | Descrição                                   |
| ------------------------------- | ------------------------------- | ------------------------------------------- |
| `OTEL_SERVICE_NAME`             | (obrigatório)                   | Nome do serviço nos traces e métricas       |
| `OTEL_EXPORTER_OTLP_ENDPOINT`   | `http://otel-collector:4317`    | Endereço gRPC do OTel Collector             |
| `OTEL_PROPAGATORS`              | `tracecontext,baggage`          | Propagadores W3C ativos                     |
| `LOG_LEVEL`                     | `debug` (dev) / `info` (prod)  | Nível mínimo de log                         |
| `NODE_ENV`                      | `development`                   | `production` desativa pino-pretty           |
| `RABBITMQ_MGMT_URL`             | `http://rabbitmq:15672`         | URL da Management API do RabbitMQ           |
| `RABBITMQ_USER`                 | `guest`                         | Usuário da Management API                   |
| `RABBITMQ_PASS`                 | `guest`                         | Senha da Management API                     |
| `APP_VERSION`                   | `1.0.0`                         | Versão exibida nos recursos OTel            |
