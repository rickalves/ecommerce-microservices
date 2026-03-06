# Guia de Teste: HTTP Direto vs RabbitMQ

Este guia explica como testar a nova arquitetura que separa **Queries (HTTP síncrono)** de **Commands (RabbitMQ assíncrono)**.

## 📋 Mudanças Implementadas

### Arquitetura Antes vs Depois

**ANTES (Tudo via RabbitMQ):**

```
API Gateway → RabbitMQ RPC → Order Service
             (15-30ms)
```

**DEPOIS (HTTP para Queries, RabbitMQ para Commands):**

```
QUERIES:  API Gateway → HTTP → Order Service (5-15ms) ⚡ 2-3x mais rápido
COMMANDS: API Gateway → RabbitMQ → Order Service (15-30ms)
```

### Endpoints Atualizados

#### Order Service

**Queries (HTTP Síncrono) - NOVO:**

- `GET /orders/:id` - Buscar pedido por ID
- `GET /orders/user/:userId` - Buscar pedidos por usuário
- `GET /orders` - Listar todos os pedidos

**Commands (RabbitMQ Assíncrono) - Mantido:**

- `POST /orders` - Criar pedido
- `PATCH /orders/:id/confirm` - Confirmar pedido
- `PATCH /orders/:id/ship` - Enviar pedido
- `PATCH /orders/:id/deliver` - Entregar pedido
- `PATCH /orders/:id/cancel` - Cancelar pedido

#### Payment Service

**Queries (HTTP Síncrono) - NOVO:**

- `GET /payments/:id` - Buscar pagamento por ID
- `GET /payments/order/:orderId` - Buscar pagamento por pedido
- `GET /payments/user/:userId` - Buscar pagamentos por usuário
- `GET /payments` - Listar todos os pagamentos

**Commands (RabbitMQ Assíncrono) - Mantido:**

- `POST /payments` - Criar pagamento
- `PATCH /payments/:id/refund` - Reembolsar pagamento

---

## 🧪 Testando a Nova Arquitetura

### 1. Verificar Build

```bash
# API Gateway precisa do @nestjs/axios
cd apps/api-gateway
pnpm add @nestjs/axios

# Verificar se compila
cd ../..
pnpm run build
```

### 2. Iniciar os Serviços

```bash
# Com Docker Compose
docker-compose up -d

# Aguardar inicialização (verificar logs)
docker-compose logs -f order-service
docker-compose logs -f payment-service
docker-compose logs -f api-gateway
```

### 3. Testar Queries (HTTP Direto)

**3.1. Listar Orders (HTTP):**

```bash
# Via API Gateway → HTTP → Order Service
curl -X GET "http://localhost:3000/orders" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Tempo esperado: 5-15ms
```

**3.2. Buscar Order por ID (HTTP):**

```bash
curl -X GET "http://localhost:3000/orders/ORDER_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Tempo esperado: 5-15ms
```

**3.3. Listar Payments (HTTP):**

```bash
curl -X GET "http://localhost:3000/payments" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Tempo esperado: 5-15ms
```

**3.4. Buscar Payment por Order (HTTP):**

```bash
curl -X GET "http://localhost:3000/payments/order/ORDER_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Tempo esperado: 5-15ms
```

### 4. Testar Commands (RabbitMQ Assíncrono)

**4.1. Criar Order (RabbitMQ):**

```bash
curl -X POST "http://localhost:3000/orders" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "product-123",
        "quantity": 2,
        "unitPrice": 50.00
      }
    ],
    "totalAmount": 100.00
  }'

# Resposta esperada:
# {
#   "status": "accepted",
#   "message": "Order creation request accepted"
# }

# Tempo esperado: 2-5ms (apenas aceita na fila)
```

**4.2. Confirmar Order (RabbitMQ):**

```bash
curl -X PATCH "http://localhost:3000/orders/ORDER_ID/confirm" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Resposta esperada:
# {
#   "status": "accepted",
#   "message": "Confirm order request accepted"
# }
```

**4.3. Criar Payment (RabbitMQ):**

```bash
curl -X POST "http://localhost:3000/payments" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID",
    "amount": 100.00,
    "method": "CREDIT_CARD"
  }'

# Resposta esperada:
# {
#   "status": "accepted",
#   "message": "Payment creation request accepted"
# }
```

---

## 🔍 Verificando a Comunicação

### Ver Logs da API Gateway

```bash
docker-compose logs api-gateway | grep -i "http\|rabbitmq"
```

**Você deve ver:**

- `✅ HTTP GET para queries` → chamadas HTTP diretas
- `⚡ EMIT para commands` → eventos RabbitMQ

### Ver Logs do Order Service

```bash
docker-compose logs order-service
```

**Você deve ver:**

- `Received HTTP GET /orders/:id` → requisições HTTP
- `Received event: order.created` → eventos RabbitMQ

### Ver Logs do Payment Service

```bash
docker-compose logs payment-service
```

**Você deve ver:**

- `Received HTTP GET /payments/:id` → requisições HTTP
- `Received event: payment.create` → eventos RabbitMQ

---

## 📊 Benchmark de Performance (Esperado)

| Operação          | Protocolo           | Latência Antes | Latência Depois | Melhoria |
| ----------------- | ------------------- | -------------- | --------------- | -------- |
| GET /orders/:id   | RabbitMQ RPC → HTTP | 20-30ms        | 5-15ms          | ⚡ 2-3x  |
| GET /payments/:id | RabbitMQ RPC → HTTP | 20-30ms        | 5-15ms          | ⚡ 2-3x  |
| POST /orders      | RabbitMQ (mantido)  | 15-30ms        | 15-30ms         | -        |
| POST /payments    | RabbitMQ (mantido)  | 15-30ms        | 15-30ms         | -        |

---

## 🐛 Troubleshooting

### Erro: `Cannot GET http://order-service:3002/orders`

**Causa:** Order Service não está expondo o HTTP controller.

**Solução:**

1. Verificar se `OrderHttpController` está registrado no `order.module.ts`
2. Verificar se a porta 3002 está listening: `docker-compose ps`
3. Verificar logs: `docker-compose logs order-service`

### Erro: `ECONNREFUSED` no API Gateway

**Causa:** API Gateway não consegue conectar ao Order/Payment Service via HTTP.

**Solução:**

1. Verificar se os serviços estão na mesma rede Docker:
    ```bash
    docker network inspect ecommerce-microservices_default
    ```
2. Verificar variáveis de ambiente:
    ```bash
    ORDER_SERVICE_URL=http://order-service:3002
    PAYMENT_SERVICE_URL=http://payment-service:3003
    ```

### Erro: `Module not found: @nestjs/axios`

**Causa:** Dependência não instalada.

**Solução:**

```bash
cd apps/api-gateway
pnpm add @nestjs/axios
```

### Commands não estão processando

**Causa:** RabbitMQ não está recebendo os eventos.

**Solução:**

1. Verificar se RabbitMQ está rodando:
    ```bash
    docker-compose ps rabbitmq
    ```
2. Acessar RabbitMQ Management: http://localhost:15672 (guest/guest)
3. Verificar se as filas `order_queue` e `payment_queue` existem
4. Ver se há mensagens na fila

---

## ✅ Checklist de Verificação

- [ ] Build completo sem erros: `pnpm run build`
- [ ] Todos os serviços UP: `docker-compose ps`
- [ ] GET /orders funciona via HTTP
- [ ] GET /payments funciona via HTTP
- [ ] POST /orders aceita via RabbitMQ
- [ ] POST /payments aceita via RabbitMQ
- [ ] Logs mostram "HTTP GET" para queries
- [ ] Logs mostram "Event received" para commands
- [ ] RabbitMQ Management mostra filas criadas
- [ ] Performance de queries melhorou (medido com curl -w '%{time_total}\n')

---

## 🚀 Próximos Passos

1. **Métricas:** Adicionar Prometheus para medir latência real:

    ```typescript
    const httpDuration = new Histogram({
        name: 'http_request_duration_seconds',
        help: 'Duration of HTTP requests',
        labelNames: ['method', 'route'],
    });
    ```

2. **Circuit Breaker:** Adicionar Resilience4j ou similar para falhas HTTP

3. **Cache:** Adicionar Redis para queries frequentes:

    ```typescript
    @Get(':id')
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(30)
    async getOrder(@Param('id') id: string) { ... }
    ```

4. **Retry Policy:** Configurar retry automático para falhas HTTP temporárias

---

## 📚 Documentação de Referência

- ADR 002: `docs/adr/002-comunicacao-sincrona-vs-assincrona.md`
- NestJS HTTP Module: https://docs.nestjs.com/techniques/http-module
- CQRS Pattern: https://martinfowler.com/bliki/CQRS.html
