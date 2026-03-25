# Comandos para Executar o Projeto

## 1️⃣ Instalação Inicial

### Navegar para o diretório do projeto

```bash
cd ecommerce-microservices
```

### Instalar todas as dependências

```bash
pnpm install
```

### Compilar o pacote shared

```bash
cd packages/shared
pnpm build
cd ../..
```

## 2️⃣ Executar em Desenvolvimento

### Opção A: Executar todos os serviços de uma vez (Recomendado)

```bash
pnpm dev
```

### Opção B: Executar cada serviço em um terminal separado

**Terminal 1 - User Service:**

```bash
cd apps/user-service
pnpm dev
# Deve exibir: User Service is listening on port 3001
```

**Terminal 2 - Order Service:**

```bash
cd apps/order-service
pnpm dev
# Deve exibir: Order Service is listening on RabbitMQ - order_queue
```

**Terminal 3 - Payment Service:**

```bash
cd apps/payment-service
pnpm dev
# Deve exibir: Payment Service is listening on RabbitMQ - payment_queue
```

**Terminal 4 - API Gateway:**

```bash
cd apps/api-gateway
pnpm dev
# Deve exibir: API Gateway is running on http://localhost:3000
```

## 3️⃣ Testar a API

### Opção A: Usando Swagger UI (Recomendado 👍)

1. Abra o navegador e acesse: http://localhost:3000/api/docs
2. Você verá a documentação interativa da API
3. Teste o fluxo completo:

#### 1. Registrar um usuário

- Expanda **POST** `/auth/register`
- Clique em **Try it out**
- Preencha o JSON:

```json
{
    "name": "Maria Santos",
    "email": "maria@email.com",
    "password": "senha123"
}
```

- Clique em **Execute**
- Copie o `accessToken` da resposta

#### 2. Autenticar no Swagger

- Clique no botão **Authorize** 🔒 no topo da página
- Cole o `accessToken` no campo
- Clique em **Authorize**
- Agora você pode acessar endpoints protegidos!

#### 3. Testar endpoints protegidos

- Experimente **GET** `/users` para listar usuários
- Experimente **POST** `/orders` para criar pedidos
- Todos os endpoints agora usarão automaticamente seu token

### Opção B: Usando cURL

### Registrar um usuário

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Santos",
    "email": "maria@email.com",
    "password": "senha123"
  }'
```

**Resposta esperada:**

```json
{
    "id": "uuid-gerado",
    "name": "Maria Santos",
    "email": "maria@email.com",
    "password": "senha123",
    "createdAt": "2026-01-28T...",
    "updatedAt": "2026-01-28T..."
}
```

### Listar todos os usuários (requer autenticação)

```bash
curl http://localhost:3000/users \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Buscar usuário específico (requer autenticação)

```bash
curl http://localhost:3000/users/{USER_ID} \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Criar um pedido (requer autenticação)

**Importante:** Use o ID do usuário criado anteriormente!

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI" \
  -d '{
    "userId": "COLE_O_ID_DO_USUARIO_AQUI",
    "items": [
      {
        "productId": "notebook-dell",
        "quantity": 1,
        "price": 3500.00
      },
      {
        "productId": "mouse-logitech",
        "quantity": 2,
        "price": 150.00
      }
    ]
  }'
```

**Resposta esperada:**

```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "items": [...],
  "totalAmount": 3800.00,
  "status": "PENDING",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Listar todos os pedidos (requer autenticação)

```bash
curl http://localhost:3000/orders \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Listar pedidos de um usuário específico (requer autenticação)

```bash
curl http://localhost:3000/orders/user/{USER_ID} \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Buscar pedido específico (requer autenticação)

```bash
curl http://localhost:3000/orders/{ORDER_ID} \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Confirmar pedido (requer autenticação)

```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/confirm \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

Status muda de PENDING → CONFIRMED

### Enviar pedido (requer autenticação)

```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/ship \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

Status muda de CONFIRMED → SHIPPED

### Entregar pedido (requer autenticação)

```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/deliver \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

Status muda de SHIPPED → DELIVERED

### Cancelar pedido (requer autenticação)

```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/cancel \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

**Nota:** Pedidos entregues não podem ser cancelados!

### Criar pagamento manualmente (requer autenticação)

```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI" \
  -d '{
    "orderId": "ORDER_ID_AQUI",
    "amount": 299.90,
    "method": "CREDIT_CARD"
  }'
```

**Nota:** Normalmente o pagamento é criado automaticamente quando um pedido é aceito via evento `order.created.accepted`.

### Buscar pagamento por ID (requer autenticação)

```bash
curl http://localhost:3000/payments/{PAYMENT_ID} \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Buscar pagamento de um pedido (requer autenticação)

```bash
curl http://localhost:3000/payments/order/{ORDER_ID} \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Listar pagamentos de um usuário (requer autenticação)

```bash
curl http://localhost:3000/payments/user/{USER_ID} \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Listar todos os pagamentos (requer autenticação)

```bash
curl http://localhost:3000/payments \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### Reembolsar pagamento (requer autenticação)

```bash
curl -X PATCH http://localhost:3000/payments/{PAYMENT_ID}/refund \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

## 4️⃣ Build para Produção

### Build de todos os projetos

```bash
pnpm build
```

### Executar em produção

```bash
pnpm start
```

## 5️⃣ Fluxo de Teste Completo

```bash
# 1. Criar usuário
RESPONSE=$(curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@test.com",
    "password": "senha123"
  }')

USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Usuário criado com ID: $USER_ID"

# 2. Criar pedido
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"items\": [
      {
        \"productId\": \"prod-1\",
        \"quantity\": 2,
        \"price\": 100.00
      }
    ]
  }")

ORDER_ID=$(echo $ORDER_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Pedido criado com ID: $ORDER_ID"

# 3. Confirmar pedido
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/confirm | jq
echo "Pedido confirmado!"

# 4. Enviar pedido
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/ship | jq
echo "Pedido enviado!"

# 5. Entregar pedido
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/deliver | jq
echo "Pedido entregue!"

# 6. Listar pedidos do usuário
curl -s http://localhost:3000/orders/user/$USER_ID | jq
```

## 6️⃣ Usando ferramentas visuais

### Swagger UI (Integrado - Recomendado) 🌟

Acesse: http://localhost:3000/api/docs

**Vantagens:**

- ✅ Já está configurado no projeto
- ✅ Documentação sempre atualizada
- ✅ Suporte nativo para autenticação JWT
- ✅ Testar diretamente no navegador
- ✅ Ver esquemas de dados e validações

**Como usar:**

1. Acesse /api/docs
2. Use `/auth/register` ou `/auth/login`
3. Copie o `accessToken`
4. Clique em **Authorize** 🔒
5. Cole o token
6. Teste todos os endpoints!

### Postman / Insomnia

Se preferir usar ferramentas externas:

**POST** `http://localhost:3000/auth/register`

```json
{
    "name": "Teste User",
    "email": "teste@email.com",
    "password": "senha123"
}
```

**Configurar Auth:**

- Type: Bearer Token
- Token: (cole o accessToken da resposta)

**POST** `http://localhost:3000/orders`

```json
{
    "userId": "{{userId}}",
    "items": [
        {
            "productId": "produto-1",
            "quantity": 1,
            "price": 99.9
        }
    ]
}
```

## 7️⃣ Troubleshooting

### Erro: "Cannot find module '@ecommerce/shared'"

```bash
cd packages/shared
pnpm build
```

### Erro de porta em uso

```bash
# Encontrar processo na porta 3000, 3001 ou 3002
lsof -i :3000
lsof -i :3001
lsof -i :3002

# Matar processo
kill -9 {PID}
```

### Limpar cache do Turbo

```bash
rm -rf .turbo
rm -rf node_modules
pnpm install
```

## 8️⃣ Banco de Dados PostgreSQL

### Iniciar bancos de dados

Os serviços agora usam PostgreSQL para persistência de dados. Cada serviço tem sua própria instância de banco de dados:

- **postgres-users** (porta 5432): banco de dados do User Service
- **postgres-orders** (porta 5433): banco de dados do Order Service
- **postgres-payments** (porta 5434): banco de dados do Payment Service

```bash
# Iniciar apenas os bancos de dados
docker-compose up -d postgres-users postgres-orders postgres-payments

# Verificar status dos containers
docker ps --filter "name=postgres"
```

### Executar migrações

As migrações são necessárias para criar as tabelas no banco de dados:

```bash
# Executar migrações do User Service
cd apps/user-service
pnpm migration:run
cd ../..

# Executar migrações do Order Service
cd apps/order-service
pnpm migration:run
cd ../..

# Executar migrações do Payment Service
cd apps/payment-service
pnpm migration:run
cd ../..
```

### Gerar novas migrações

Quando você modificar as entidades (adicionar campos, etc.), gere uma nova migração:

```bash
# User Service
cd apps/user-service
pnpm migration:generate NomeDaMigracao
cd ../..

# Order Service
cd apps/order-service
pnpm migration:generate NomeDaMigracao
cd ../..

# Payment Service
cd apps/payment-service
pnpm migration:generate NomeDaMigracao
cd ../..
```

**Nota:** As migrações são geradas em `src/infrastructure/database/migrations/`. Toda a implementação do TypeORM/PostgreSQL está isolada em `infrastructure/database/` para respeitar a arquitetura DDD.

### Reverter migrações

```bash
# User Service
cd apps/user-service
pnpm migration:revert
cd ../..

# Order Service
cd apps/order-service
pnpm migration:revert
cd ../..

# Payment Service
cd apps/payment-service
pnpm migration:revert
cd ../..
```

### Conectar ao banco de dados

```bash
# User Service Database
docker exec -it postgres-users psql -U user_service -d users_db

# Order Service Database
docker exec -it postgres-orders psql -U order_service -d orders_db

# Payment Service Database
docker exec -it postgres-payments psql -U payment_service -d payments_db
```

### Acessar RabbitMQ Management UI

Acesse: http://localhost:15672

- **Usuário:** guest
- **Senha:** guest

**O que você pode fazer:**

- Ver mensagens em filas
- Monitorar exchanges
- Ver conexões ativas
- Visualizar métricas de performance

### Comandos úteis do PostgreSQL

Dentro do psql:

```sql
-- Listar tabelas
\dt

-- Ver estrutura de uma tabela
\d users
\d orders

-- Consultar dados
SELECT * FROM users;
SELECT * FROM orders;

-- Sair do psql
\q
```

### Configuração de ambiente

Os serviços usam variáveis de ambiente para conexão com o banco:

**User Service (.env):**

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user_service
DB_PASSWORD=user_service_pass
DB_DATABASE=users_db
```

**Order Service (.env):**

```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=order_service
DB_PASSWORD=order_service_pass
DB_DATABASE=orders_db
```

## 9️⃣ Observabilidade (OTel Stack)

### Subir apenas infraestrutura de telemetria

```bash
docker compose up -d postgres-users postgres-orders postgres-payments rabbitmq \
  prometheus grafana otel-collector tempo loki
```

### Verificar saúde de todos os serviços

```bash
curl http://localhost:3000/health   # api-gateway
curl http://localhost:3001/health   # user-service
curl http://localhost:3002/health   # order-service
curl http://localhost:3003/health   # payment-service
```

### Ver métricas brutas (formato OpenMetrics)

```bash
curl -H "Accept: application/openmetrics-text" http://localhost:3000/metrics
curl -H "Accept: application/openmetrics-text" http://localhost:3002/metrics
```

### Acessar interfaces de visualização

| Interface       | URL                     | Credenciais    |
| --------------- | ----------------------- | -------------- |
| Grafana         | http://localhost:3100   | admin / admin  |
| Prometheus      | http://localhost:9090   | —              |
| RabbitMQ Mgmt   | http://localhost:15672  | guest / guest  |
| Tempo HTTP API  | http://localhost:3200   | —              |

### Buscar trace por ID (via Tempo API)

```bash
curl "http://localhost:3200/api/traces/<traceId>"
```

### Ver variáveis de ambiente OTel configuradas

```bash
docker compose exec order-service env | grep OTEL
```

### Logs de um serviço com traceId visível

```bash
# Exibe logs JSON com traceId/spanId injetados pelo nestjs-pino
docker compose logs --tail=50 payment-service | grep traceId
```

> Para mais detalhes sobre o stack de observabilidade, consulte o [Guia de Uso de Observabilidade](./observabilidade-uso.md).

## 1️⃣1️⃣ Outbox Pattern

### Inspecionar tabela outbox no order-service

```bash
docker exec postgres-orders psql -U order_service -d orders_db \
  -c "SELECT event_type, status, attempts, created_at, published_at \
      FROM outbox ORDER BY created_at DESC LIMIT 20;"
```

### Inspecionar tabela outbox no payment-service

```bash
docker exec postgres-payments psql -U payment_service -d payments_db \
  -c "SELECT event_type, status, attempts, created_at, published_at \
      FROM outbox ORDER BY created_at DESC LIMIT 20;"
```

### Verificar eventos com falha permanente (FAILED)

```bash
# order-service
docker exec postgres-orders psql -U order_service -d orders_db \
  -c "SELECT id, event_type, attempts, last_error FROM outbox WHERE status = 'FAILED';"

# payment-service
docker exec postgres-payments psql -U payment_service -d payments_db \
  -c "SELECT id, event_type, attempts, last_error FROM outbox WHERE status = 'FAILED';"
```

### Ver logs do OutboxProcessor em tempo real

```bash
docker compose logs -f order-service | grep -i outbox
docker compose logs -f payment-service | grep -i outbox
```

### Consultar estatísticas de publicação

```bash
# Contagem por status e tipo de evento
docker exec postgres-orders psql -U order_service -d orders_db \
  -c "SELECT event_type, status, COUNT(*) FROM outbox GROUP BY event_type, status ORDER BY event_type;"
```

> Para mais detalhes sobre a arquitetura do Outbox Pattern, consulte [outbox-pattern.md](../architecture/outbox-pattern.md).

## 🔟 Próximos Passos

- ✅ ~~Adicionar banco de dados PostgreSQL~~ (Implementado!)
- ✅ ~~Implementar autenticação JWT~~ (Implementado!)
- ✅ ~~Adicionar Swagger UI~~ (Implementado!)
- ✅ ~~Configurar RabbitMQ~~ (Implementado!)
- ✅ ~~Adicionar logging centralizado~~ (Implementado com nestjs-pino + Loki!)
- ✅ ~~Implementar distributed tracing~~ (Implementado com OTel + Tempo!)
- ✅ ~~Implementar Outbox Pattern~~ (Implementado! Garantia transacional em order-service e payment-service)
- ⏳ Adicionar testes automatizados (unit + E2E)
- ⏳ Implementar circuit breaker
- ⏳ Implementar rate limiting

## 🔟 Executar com Docker

### Pré-requisitos

- Docker e Docker Compose instalados
- Recomenda-se compilar `packages/shared` antes de construir as imagens, caso os Dockerfiles dependam de artefatos compilados

### Construir e subir todos os serviços

```bash
docker-compose up --build
```

### Construir e subir em background

```bash
docker-compose up -d --build
```

### Ver logs

```bash
docker-compose logs --follow
```

### Parar e remover containers

```bash
docker-compose down
```

### Rebuild e subir um serviço específico

```bash
docker-compose build user-service
docker-compose up -d user-service
```

### Construir imagem manualmente (exemplo: user-service)

```bash
# No diretório raiz do repositório
docker build -t ecommerce-user-service:dev -f apps/user-service/Dockerfile .
```

### Observações

- Se os Dockerfiles copiarem artefatos compilados do pacote `packages/shared`, execute:

```bash
cd packages/shared && pnpm build && cd ../..
```

- Se as portas estiverem em uso, pare os containers ou ajuste as portas em `docker-compose.yml`.
