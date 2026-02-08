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
# Deve exibir: Order Service is listening on port 3002
```

**Terminal 3 - API Gateway:**

```bash
cd apps/api-gateway
pnpm dev
# Deve exibir: API Gateway is running on http://localhost:3000
```

## 3️⃣ Testar a API

### Criar um usuário

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

### Listar todos os usuários

```bash
curl http://localhost:3000/users
```

### Buscar usuário específico

```bash
curl http://localhost:3000/users/{USER_ID}
```

### Criar um pedido

**Importante:** Use o ID do usuário criado anteriormente!

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
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

### Listar todos os pedidos

```bash
curl http://localhost:3000/orders
```

### Listar pedidos de um usuário específico

```bash
curl http://localhost:3000/orders/user/{USER_ID}
```

### Buscar pedido específico

```bash
curl http://localhost:3000/orders/{ORDER_ID}
```

### Confirmar pedido

```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/confirm
```

Status muda de PENDING → CONFIRMED

### Enviar pedido

```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/ship
```

Status muda de CONFIRMED → SHIPPED

### Entregar pedido

```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/deliver
```

Status muda de SHIPPED → DELIVERED

### Cancelar pedido

```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/cancel
```

**Nota:** Pedidos entregues não podem ser cancelados!

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

### Postman / Insomnia

Importe a seguinte collection:

**POST** `http://localhost:3000/users`

```json
{
    "name": "Teste User",
    "email": "teste@email.com",
    "password": "senha123"
}
```

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

```bash
# Iniciar apenas os bancos de dados
docker-compose up -d postgres-users postgres-orders

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
```

### Conectar ao banco de dados

```bash
# User Service Database
docker exec -it postgres-users psql -U user_service -d users_db

# Order Service Database
docker exec -it postgres-orders psql -U order_service -d orders_db
```

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

## 9️⃣ Próximos Passos

- ✅ ~~Adicionar banco de dados PostgreSQL~~ (Implementado!)
- Implementar autenticação JWT
- Adicionar testes automatizados
- Implementar event-driven architecture
- Adicionar API documentation (Swagger)

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
