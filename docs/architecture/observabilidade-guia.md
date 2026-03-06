# Guia de Uso - Observabilidade

## Logs Estruturados

### Usando o LoggerService

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@ecommerce/observability';

@Injectable()
export class MyService {
    constructor(private readonly logger: LoggerService) {}

    async doSomething(data: any) {
        // Log simples
        this.logger.info('Processing data');

        // Log com contexto
        this.logger.info('Processing order', {
            orderId: data.id,
            userId: data.userId,
            amount: data.amount,
        });

        // Log de erro com stack trace
        try {
            // código
        } catch (error) {
            this.logger.error('Failed to process order', error.stack, {
                orderId: data.id,
                error: error.message,
            });
        }

        // Log de evento de negócio
        this.logger.logEvent('order.created', {
            orderId: saved.id,
            totalAmount: saved.totalAmount,
        });

        // Log de métrica
        this.logger.logMetric('order_processing_time', duration, 'ms', {
            orderId: saved.id,
        });

        // Log de HTTP (já automático via interceptor)
        // mas pode ser manual se necessário
        this.logger.logHttp('POST', '/orders', 201, 145);
    }
}
```

### Níveis de Log

```typescript
logger.trace('Detailed debug info'); // Apenas dev
logger.debug('Debug info'); // Dev
logger.info('Normal operation'); // Prod
logger.warn('Warning condition'); // Prod
logger.error('Error occurred', trace); // Prod
logger.fatal('Fatal error'); // Prod
```

### Visualização dos Logs

**Desenvolvimento (pretty print):**

```bash
NODE_ENV=development pnpm dev

# Output colorido:
[12:34:56] INFO: Processing order
    service: "order-service"
    correlationId: "550e8400-..."
    orderId: "abc-123"
    userId: "user-456"
```

**Produçãoson):**

```bash
NODE_ENV=production pnpm start

# Output JSON:
{"level":"info","timestamp":"2026-02-11T12:34:56.789Z","service":"order-service","correlationId":"550e8400-...","orderId":"abc-123","msg":"Processing order"}
```

---

## Correlation ID

### Propagação Automática

O correlationId é propagado automaticamente em:

- **HTTP:** via header `X-Correlation-ID`
- **RabbitMQ:** via campo `correlationId` no payload

### Fornecendo CorrelationId Externo

```bash
# Cliente fornece seu próprio correlationId
curl -H "X-Correlation-ID: my-custom-id-123" \
     -H "Authorization: Bearer token" \
     http://localhost:3000/orders
```

### Acessando o CorrelationId no Código

```typescript
import { Injectable } from '@nestjs/common';
import { CorrelationService } from '@ecommerce/observability';

@Injectable()
export class MyService {
    constructor(private readonly correlationService: CorrelationService) {}

    async doSomething() {
        // Obter correlationId atual
        const correlationId = this.correlationService.getCorrelationId();
        console.log('Current correlation:', correlationId);

        // Obter contexto completo
        const context = this.correlationService.getContext();
        console.log('Context:', context);
        // { correlationId: "...", traceId: "...", userId: "...", ... }

        // Definir valor customizado no contexto
        this.correlationService.set('customField', 'customValue');

        // Obter valor do contexto
        const value = this.correlationService.get('customField');
    }
}
```

### Propagando em Eventos RabbitMQ

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CorrelationService } from '@ecommerce/observability';

@Injectable()
export class CreateOrderUseCase {
    constructor(
        @Inject('EVENT_BUS') private eventBus: ClientProxy,
        private readonly correlationService: CorrelationService
    ) {}

    async execute(dto: CreateOrderDto) {
        const order = await this.repository.create(dto);

        // Obter correlationId do contexto atual
        const correlationId = this.correlationService.getCorrelationId();

        // Emitir evento com correlationId
        this.eventBus.emit('order.created.accepted', {
            correlationId, // ✅ Propaga o ID original
            causationId: correlationId, // ✅ Para rastrear causa
            timestamp: new Date().toISOString(),
            eventType: 'order.created.accepted',
            data: {
                orderId: order.id,
                userId: order.userId,
                totalAmount: order.totalAmount,
            },
        });

        return order;
    }
}
```

### Criando Contexto Filho

```typescript
// Para eventos derivados, manter correlationId mas definir causationId
const childContext = this.correlationService.createChildContext({
    eventType: 'payment.initiated',
});

console.log(childContext);
// {
//   correlationId: "550e8400-...", // mesmo ID
//   causationId: "550e8400-...",   // ID do evento pai
//   eventType: "payment.initiated"
// }
```

---

## Health Checks

### Endpoints Disponíveis

**1. Health Check Geral** (`/health`)

```bash
curl http://localhost:3000/health

# Response:
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    }
  }
}
```

**2. Readiness Probe** (`/health/ready`)

```bash
curl http://localhost:3000/health/ready

# Verifica se o serviço está pronto para receber tráfego
# Inclui verificação de DB e outras dependências
```

**3. Liveness Probe** (`/health/live`)

```bash
curl http://localhost:3000/health/live

# Response:
{
  "status": "ok",
  "timestamp": "2026-02-11T12:34:56.789Z"
}
```

### Configurando no Kubernetes

```yaml
apiVersion: v1
kind: Pod
metadata:
    name: api-gateway
spec:
    containers:
        - name: api-gateway
          image: ecommerce/api-gateway:latest
          ports:
              - containerPort: 3000
          livenessProbe:
              httpGet:
                  path: /health/live
                  port: 3000
              initialDelaySeconds: 30
              periodSeconds: 10
          readinessProbe:
              httpGet:
                  path: /health/ready
                  port: 3000
              initialDelaySeconds: 5
              periodSeconds: 5
```

### Adicionando Checks Customizados

```typescript
import { Controller, Get } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    TypeOrmHealthIndicator,
    MicroserviceHealthIndicator,
    MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Transport } from '@nestjs/microservices';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private db: TypeOrmHealthIndicator,
        private microservice: MicroserviceHealthIndicator,
        private memory: MemoryHealthIndicator
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            // Database check
            () => this.db.pingCheck('database', { timeout: 300 }),

            // RabbitMQ check
            () =>
                this.microservice.pingCheck('rabbitmq', {
                    transport: Transport.RMQ,
                    options: {
                        urls: [process.env.RMQ_URL || 'amqp://rabbitmq:5672'],
                    },
                    timeout: 3000,
                }),

            // Memory check
            () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
            () => this.memory.checkRSS('memory_rss', 200 * 1024 * 1024), // 200MB
        ]);
    }
}
```

---

## Troubleshooting

### Problema: Logs não têm correlationId

**Causa:** O contexto não foi propagado corretamente.

**Solução:**

1. Verificar se `CorrelationMiddleware` está aplicado (HTTP)
2. Verificar se `CorrelationInterceptor` está registrado (RabbitMQ)
3. Verificar se eventos incluem `correlationId` no payload

### Problema: CorrelationId diferente em cada serviço

**Causa:** Cada serviço está gerando seu próprio ID.

**Solução:**

```typescript
// ❌ ERRADO
this.eventBus.emit('event', {
    correlationId: uuid(), // Gera novo ID!
    data: order,
});

// ✅ CORRETO
const correlationId = this.correlationService.getCorrelationId();
this.eventBus.emit('event', {
    correlationId, // Usa ID do contexto
    data: order,
});
```

### Problema: Logs não aparecem em desenvolvimento

**Causa:** Nível de log muito restritivo.

**Solução:**

```bash
# Definir nível de log
LOG_LEVEL=debug pnpm dev
```

### Problema: Health check retorna 503

**Causa:** Dependência (DB, RabbitMQ) não está acessível.

**Solução:**

1. Verificar se containers estão rodando: `docker-compose ps`
2. Verificar logs do serviço: `docker-compose logs service-name`
3. Verificar conectividade: `docker-compose exec service-name ping database`

---

## Boas Práticas

### 1. Sempre Use Contexto nos Logs

```typescript
// ❌ EVITE
logger.info('Order created');

// ✅ PREFIRA
logger.info('Order created', {
    orderId: order.id,
    userId: order.userId,
    amount: order.totalAmount,
});
```

### 2. Propague CorrelationId em Todos os Eventos

```typescript
// ✅ Sempre incluir
this.eventBus.emit('event', {
  correlationId: this.correlationService.getCorrelationId(),
  causationId: parentEventId, // opcional
  timestamp: new Date().toISOString(),
  eventType: 'order.created',
  data: { ... },
});
```

### 3. Use Níveis Adequados

- **debug/trace:** Informações detalhadas apenas para desenvolvimento
- **info:** Operações normais (criação, atualização, etc.)
- **warn:** Condições anormais mas recuperáveis
- **error:** Erros que precisam atenção
- **fatal:** Erros críticos que impedem o serviço de funcionar

### 4. Não Logue Dados Sensíveis

```typescript
// ❌ EVITE
logger.info('User login', {
    email: user.email,
    password: user.password, // NUNCA!
});

// ✅ PREFIRA
logger.info('User login', {
    userId: user.id,
    email: user.email,
    // password é automaticamente redacted
});
```

### 5. Use LogEvent para Eventos de Negócio

```typescript
// Para eventos importantes de negócio
logger.logEvent('order.paid', {
    orderId: order.id,
    amount: order.totalAmount,
    paymentMethod: 'credit_card',
});
```

---

## Queries Úteis (Grepping Logs)

### Buscar por CorrelationId

```bash
# Desenvolvimento
pnpm dev | grep "550e8400-e29b-41d4-a716-446655440000"

# Produção (logs JSON)
cat logs/app.log | jq 'select(.correlationId == "550e8400-e29b-41d4-a716-446655440000")'
```

### Buscar Erros

```bash
# Desenvolvimento
pnpm dev | grep "ERROR"

# Produção
cat logs/app.log | jq 'select(.level == "error")'
```

### Buscar por Serviço

```bash
cat logs/app.log | jq 'select(.service == "order-service")'
```

### Buscar Eventos de Negócio

```bash
cat logs/app.log | jq 'select(.eventType != null)'
```

---

## Exemplo End-to-End

### Cenário: Criar Pedido e Processar Pagamento

```bash
# 1. Cliente faz request com correlationId customizado
curl -X POST http://localhost:3000/orders \
  -H "X-Correlation-ID: test-order-789" \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "items": [{ "productId": "prod-456", "quantity": 2, "price": 99.90 }]
  }'
```

**Logs Esperados (correlationId = "test-order-789"):**

```
[API Gateway]
→ Incoming request: POST /orders (correlationId: test-order-789)

[Order Service]
→ RPC received: order.create (correlationId: test-order-789)
→ Event: order.created.accepted (correlationId: test-order-789)

[Payment Service]
→ RPC received: order.created.accepted (correlationId: test-order-789)
→ Event: payment.initiated (correlationId: test-order-789)
→ Event: payment.completed (correlationId: test-order-789)

[Order Service]
→ RPC received: payment.completed (correlationId: test-order-789)
→ Order status updated to CONFIRMED (correlationId: test-order-789)

[API Gateway]
→ Response: 201 Created (correlationId: test-order-789)
```

**Rastreamento:** Buscar por `test-order-789` em todos os logs permite ver o fluxo completo! ✅

---

## Referências

- [ADR-002](../adr/002-observabilidade-arquitetura-event-driven.md) - Decisão arquitetural completa
- [Fase 1 — Resumo](./fase1-resumo.md) - Resumo da implementação
- [Pino Documentation](https://getpino.io/)
- [NestJS Terminus](https://docs.nestjs.com/recipes/terminus)
