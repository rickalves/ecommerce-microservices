# ADR 003: Comunicação Síncrona vs Assíncrona em Microserviços

**Data:** 2026-02-17
**Status:** Proposto
**Contexto:** Definir quando usar comunicação síncrona (RPC) vs assíncrona (eventos)

---

## Contexto

O sistema possui 4 microserviços que se comunicam via RabbitMQ. Atualmente existe uma mistura de comunicação síncrona (`send()`) e assíncrona (`emit()`), mas precisamos definir claramente quando usar cada uma para otimizar performance e manter consistência.

### Situação Atual

```typescript
// API Gateway -> Order Service (via RabbitMQ)

// ✅ Queries - Síncronas (send)
GET /orders/:id → orderService.send('order.get', id)
GET /orders/user/:userId → orderService.send('order.get_by_user', userId)

// ✅ Commands - Assíncronas (emit)
POST /orders → orderService.emit('order.created', data)
PATCH /orders/:id/confirm → orderService.emit('order.confirm', id)
PATCH /orders/:id/cancel → orderService.emit('order.cancel', id)
```

---

## Decisão

### Pattern CQRS Simplificado

Adotaremos **Command Query Responsibility Segregation (CQRS)** de forma pragmática:

#### 📖 QUERIES (Leitura) - Comunicação SÍNCRONA

**Quando usar:**
- ✅ Buscar dados existentes (GET)
- ✅ Cliente precisa da resposta imediatamente
- ✅ Validações em tempo real
- ✅ Não envolve múltiplos serviços

**Protocolo:** `send()` com RabbitMQ (request-response) ou HTTP direto

**Exemplos:**
```typescript
// ✅ Consultar status de pedido
GET /orders/:id → return orderService.send('order.get', id)

// ✅ Listar pedidos do usuário
GET /orders/user/:userId → return orderService.send('order.get_by_user', userId)

// ✅ Consultar status de pagamento
GET /payments/:id → return paymentService.send('payment.get', id)

// ✅ Verificar saldo disponível
GET /users/:id/balance → return userService.send('user.get_balance', id)
```

**Vantagens:**
- Cliente recebe resposta imediata
- Mais simples de debugar
- UX melhor (sem loading eterno)

**Desvantagens:**
- Acoplamento temporal (serviço precisa estar UP)
- Latência de rede somada
- Pode criar cascatas de falhas



#### ⚡ COMMANDS (Escrita) - Comunicação ASSÍNCRONA

**Quando usar:**
- ✅ Criar/Atualizar/Deletar dados (POST/PUT/PATCH/DELETE)
- ✅ Operações que envolvem múltiplos serviços
- ✅ Workflows distribuídos (saga patterns)
- ✅ Cliente não precisa de resposta imediata
- ✅ Background processing

**Protocolo:** `emit()` com RabbitMQ (fire-and-forget) + eventos de domínio

**Exemplos:**
```typescript
// ✅ Criar pedido (envolve validação de estoque, reserva de produto)
POST /orders → orderService.emit('order.created', data)
  ↓
  → payment.service escuta 'order.created'
  → inventory.service escuta 'order.created'
  → notification.service escuta 'order.created'

// ✅ Processar pagamento (envolve gateway externo, retry, webhook)
POST /payments → paymentService.emit('payment.create', data)
  ↓
  → order.service escuta 'payment.completed'

// ✅ Cancelar pedido (reembolso + notificação + auditoria)
PATCH /orders/:id/cancel → orderService.emit('order.cancel', id)
  ↓
  → payment.service escuta 'order.cancelled' (refund)
  → inventory.service escuta 'order.cancelled' (restore stock)
  → notification.service escuta 'order.cancelled' (email)
```

**Vantagens:**
- Desacoplamento temporal (serviços podem estar offline temporariamente)
- Alta escalabilidade (fila absorve picos)
- Retries automáticos (DLQ)
- Performance melhor para cliente (resposta HTTP imediata)

**Desvantagens:**
- Eventual consistency (status pode estar temporariamente inconsistente)
- Mais complexo de debugar (rastreamento distribuído necessário)
- Cliente precisa polling ou webhooks para saber resultado



---

## Performance: RPC via RabbitMQ vs REST Direto

### Benchmark Comparativo

| Métrica | RPC (RabbitMQ) | REST (HTTP) | Diferença |
|---------|---------------|-------------|-----------|
| Latência média | 15-30ms | 5-15ms | HTTP 2x mais rápido |
| Throughput | 3,000 req/s | 10,000 req/s | HTTP 3x maior |
| Overhead | Alto (serialização, fila) | Baixo (direto) | - |
| Resiliência | Alta (retries automáticos) | Média (circuit breaker manual) | - |

### 🎯 Recomendação: Híbrido

```
┌─────────────────────────────────────────────────┐
│              API Gateway (HTTP)                 │
└─────────────────────────────────────────────────┘
         │                           │
         ▼ (REST HTTP)               ▼ (RabbitMQ Events)
    ┌─────────┐                 ┌─────────┐
    │ QUERIES │                 │ COMMANDS│
    │ (Sync)  │                 │ (Async) │
    └─────────┘                 └─────────┘
         │                           │
         ▼                           ▼
┌──────────────────────────────────────────────────┐
│       Microserviços (Order, Payment, User)       │
│                                                  │
│  ┌────────────────┐  ┌──────────────────────┐   │
│  │ HTTP Controller│  │ RabbitMQ Handlers    │   │
│  │ (REST API)     │  │ (Event Handlers)     │   │
│  │                │  │                      │   │
│  │ GET /orders    │  │ @EventPattern(...)   │   │
│  │ GET /payments  │  │ @MessagePattern(...) │   │
│  └────────────────┘  └──────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**Implementação:**

```typescript
// API Gateway app.module.ts - Usar ambos
ClientsModule.register([
  // REST HTTP para queries
  {
    name: 'ORDER_SERVICE_HTTP',
    transport: Transport.TCP,
    options: {
      host: 'order-service',
      port: 3002,
    },
  },
  // RabbitMQ para commands
  {
    name: 'ORDER_SERVICE_EVENTS',
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://rabbitmq:5672'],
      queue: 'order_queue',
    },
  },
])
```

```typescript
// API Gateway orders.controller.ts
@Controller('orders')
export class OrdersController {
  constructor(
    @Inject('ORDER_SERVICE_HTTP') private httpClient: ClientProxy,
    @Inject('ORDER_SERVICE_EVENTS') private eventClient: ClientProxy,
  ) {}

  // ✅ Query - Síncrono via HTTP/TCP
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return firstValueFrom(
      this.httpClient.send('order.get', id)
    );
  }

  // ✅ Command - Assíncrono via RabbitMQ
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    this.eventClient.emit('order.created', dto);
    return {
      status: 'accepted',
      message: 'Order is being processed'
    };
  }
}
```

---

## Consulta de Status: Pattern Recomendado

### Problema: "Como ver ordens criadas e seu status?"

**❌ Anti-pattern: Emitir evento e esperar**
```typescript
// NÃO FAÇA ISSO
@Get(':id/status')
async getStatus(@Param('id') id: string) {
  // Emitir evento e tentar ouvir resposta
  this.orderService.emit('order.get_status', id); // ❌ Errado
  // Como receber a resposta? 🤔
}
```

**✅ Pattern correto: Endpoint HTTP síncrono**
```typescript
// Order Service - Expor endpoint HTTP direto
@Controller('orders')
export class OrderController {
  @Get(':id')
  async getOrder(@Param('id') id: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne(id);
    if (!order) throw new NotFoundException();
    return order;
  }

  @Get()
  async listOrders(@Query('userId') userId?: string) {
    if (userId) {
      return this.orderRepository.findByUserId(userId);
    }
    return this.orderRepository.findAll();
  }
}
```

**✅ Alternative: RPC via RabbitMQ com send()**
```typescript
// Se já usa RabbitMQ, pode usar send() para request-response
@MessagePattern('order.get') // Responde com reply
async getOrder(id: string): Promise<OrderResponseDto> {
  const order = await this.orderRepository.findOne(id);
  if (!order) throw new RpcException('Order not found');
  return order;
}

// API Gateway
@Get(':id')
async getOrder(@Param('id') id: string) {
  return firstValueFrom(
    this.orderService.send('order.get', id) // Aguarda resposta
  );
}
```

---

## Pattern: Eventual Consistency com Polling

Para operações assíncronas que o cliente precisa acompanhar:

### 1. Client Polling (Mais Simples)

```typescript
// Cliente cria pedido
POST /orders
Response: {
  orderId: "abc123",
  status: "processing"
}

// Cliente consulta status periodicamente
GET /orders/abc123
Response: {
  orderId: "abc123",
  status: "completed",
  paymentStatus: "paid",
  shippingStatus: "shipped"
}
```

**Frontend:**
```typescript
async function createAndTrackOrder(orderData) {
  // 1. Criar pedido (async)
  const { orderId } = await api.post('/orders', orderData);

  // 2. Polling até completar
  let order;
  do {
    await sleep(2000); // espera 2s
    order = await api.get(`/orders/${orderId}`);
  } while (order.status === 'processing');

  return order;
}
```

### 2. WebSocket/SSE (Mais Elegante)

```typescript
// Order Service - Emitir evento quando status muda
@EventPattern('payment.completed')
async handlePaymentCompleted(data: PaymentCompletedEvent) {
  const order = await this.updateOrderStatus(data.orderId, 'paid');

  // Notificar cliente via WebSocket
  this.websocketGateway.emit(`order.${order.id}.updated`, order);
}

// Frontend - Escutar mudanças
socket.on(`order.${orderId}.updated`, (order) => {
  console.log('Order status updated:', order.status);
  updateUI(order);
});
```

### 3. Webhook (Para integrações B2B)

```typescript
// Cliente fornece webhook URL
POST /orders
Body: {
  items: [...],
  webhookUrl: "https://client.com/webhooks/order-updates"
}

// Order Service - Chamar webhook quando status muda
@EventPattern('payment.completed')
async handlePaymentCompleted(data: PaymentCompletedEvent) {
  const order = await this.updateOrderStatus(data.orderId, 'paid');

  // POST para webhook do cliente
  await this.httpService.post(order.webhookUrl, {
    orderId: order.id,
    status: order.status,
    timestamp: new Date(),
  });
}
```

---

## Quando EVITAR Assíncrono

### ❌ Casos onde assíncrono NÃO é ideal:

1. **Login/Autenticação**
```typescript
// ❌ Errado - User precisa de token AGORA
POST /auth/login → userService.emit('user.login', credentials)

// ✅ Correto - Resposta síncrona
POST /auth/login → return userService.send('user.login', credentials)
```

2. **Validações que bloqueiam a operação**
```typescript
// ❌ Errado - Precisa saber se cartão é válido antes de prosseguir
POST /payments → paymentService.emit('payment.validate_card', card)

// ✅ Correto - Validar síncrono
const isValid = await paymentService.send('payment.validate_card', card);
if (!isValid) throw new BadRequestException('Invalid card');
```

3. **Reads simples (GET)**
```typescript
// ❌ Nunca faça isso
GET /orders/:id → orderService.emit('order.get', id) // Como recebe resposta?

// ✅ Sempre síncrono
GET /orders/:id → return orderService.send('order.get', id)
```

---

## Trade-offs: Consistência vs Performance

### Strong Consistency (Síncrono)

```typescript
// ✅ Garantia de consistência imediata
@Post()
async createOrderSync(@Body() dto: CreateOrderDto) {
  // 1. Validar estoque
  const hasStock = await this.inventoryService.send('check_stock', dto.items);
  if (!hasStock) throw new BadRequestException('Out of stock');

  // 2. Criar pedido
  const order = await this.orderService.send('order.create', dto);

  // 3. Reservar estoque
  await this.inventoryService.send('reserve_stock', order.items);

  // Cliente recebe pedido completo
  return order;
}
```

**Problemas:**
- 🐌 Latência somada (network calls sequenciais)
- 💥 Falha em qualquer serviço quebra toda a operação
- 🔗 Alto acoplamento

### Eventual Consistency (Assíncrono)

```typescript
// ⚡ Performance alta, consistência eventual
@Post()
async createOrderAsync(@Body() dto: CreateOrderDto) {
  // 1. Aceitar pedido imediatamente
  this.orderService.emit('order.created', dto);

  // Cliente recebe resposta rápida
  return {
    status: 'pending',
    message: 'Order is being processed'
  };

  // Background:
  // → Inventory Service valida estoque
  // → Se OK: Payment Service processa
  // → Se NOK: Order Service cancela + notifica cliente
}
```

**Vantagens:**
- ⚡ Resposta instantânea ao cliente
- 🔄 Retries automáticos se serviço cair
- 📈 Alta escalabilidade

**Problemas:**
- ⏰ Status temporariamente inconsistente
- 🤔 Cliente precisa polling ou webhook
- 🧩 Mais complexo de debugar

---

## Recomendação Final

### Orders Service

```typescript
// ✅ HTTP/TCP para queries (síncrono)
@Controller('orders')
export class OrderController {
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  @Get()
  async listOrders(@Query('userId') userId?: string) {
    return userId
      ? this.orderService.findByUserId(userId)
      : this.orderService.findAll();
  }
}

// ✅ RabbitMQ para commands (assíncrono)
@Controller()
export class OrderEventHandler {
  @EventPattern('order.created')
  async handleOrderCreated(@Payload() data: CreateOrderDto) {
    const order = await this.orderService.create(data);
    this.eventBus.emit('order.created', order); // propagar
  }

  @EventPattern('order.cancel')
  async handleOrderCancel(@Payload() orderId: string) {
    await this.orderService.cancel(orderId);
    this.eventBus.emit('order.cancelled', { orderId });
  }
}
```

### Payment Service

```typescript
// ✅ HTTP para queries
@Controller('payments')
export class PaymentController {
  @Get(':id')
  async getPayment(@Param('id') id: string) {
    return this.paymentService.findById(id);
  }

  @Get('order/:orderId')
  async getPaymentByOrder(@Param('orderId') orderId: string) {
    return this.paymentService.findByOrderId(orderId);
  }
}

// ✅ RabbitMQ para processamento (assíncrono)
@Controller()
export class PaymentEventHandler {
  @EventPattern('payment.create')
  async handlePaymentCreate(@Payload() data: CreatePaymentDto) {
    const payment = await this.paymentService.process(data);

    if (payment.status === 'completed') {
      this.eventBus.emit('payment.completed', payment);
    } else {
      this.eventBus.emit('payment.failed', payment);
    }
  }

  @EventPattern('order.cancelled')
  async handleOrderCancelled(@Payload() data: { orderId: string }) {
    await this.paymentService.refund(data.orderId);
    this.eventBus.emit('payment.refunded', data);
  }
}
```

---

## Observabilidade (Critical!)

Com comunicação assíncrona, observabilidade é **OBRIGATÓRIA**:

### 1. Correlation ID
```typescript
// Propagar ID através de todos eventos
interface BaseEvent {
  correlationId: string; // UUID único por requisição
  timestamp: string;
  eventType: string;
}

// Rastrear toda a cadeia
POST /orders (correlationId: abc-123)
  → order.created (correlationId: abc-123)
    → payment.create (correlationId: abc-123)
      → payment.completed (correlationId: abc-123)
        → order.confirmed (correlationId: abc-123)
```

### 2. Distributed Tracing
- Jaeger para visualizar fluxo completo
- Span por cada operação
- Ver onde está o gargalo

### 3. Métricas
```typescript
// Medir latência de processamento assíncrono
histogram.observe({
  event: 'order.created',
  duration: endTime - startTime
});

// Taxa de erro
counter.inc({
  event: 'payment.failed',
  reason: error.message
});
```

---

## Checklist de Implementação

### Queries (Síncronas)
- [ ] Expor endpoints HTTP REST em cada microserviço
- [ ] API Gateway chama via HTTP direto (ou TCP)
- [ ] Timeout configurado (ex: 5s)
- [ ] Circuit breaker para falhas
- [ ] Cache para queries frequentes (Redis)

### Commands (Assíncronas)
- [ ] Emitir eventos via RabbitMQ
- [ ] Propagar `correlationId` em todos eventos
- [ ] Dead Letter Queue (DLQ) configurada
- [ ] Retries com backoff exponencial
- [ ] Idempotência nos handlers
- [ ] Métricas de processamento

### Observabilidade
- [ ] Correlation ID em todos logs e eventos
- [ ] Traces distribuídos (Jaeger)
- [ ] Métricas de latência P95/P99
- [ ] Alertas para eventos falhados
- [ ] Dashboard de fluxo de eventos

---

## Referências

1. **CQRS Pattern**: https://martinfowler.com/bliki/CQRS.html
2. **Eventual Consistency**: https://www.allthingsdistributed.com/2008/12/eventually_consistent.html
3. **NestJS Microservices**: https://docs.nestjs.com/microservices/basics
4. **Saga Pattern**: https://microservices.io/patterns/data/saga.html

---

**Status:** PROPOSTO - Aguardando validação e implementação incremental
