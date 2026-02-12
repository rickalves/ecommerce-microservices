# E-commerce Microservices com NestJS + DDD + Turbo Repo

Projeto de microserviços usando NestJS com arquitetura DDD (Domain-Driven Design), gerenciado com Turbo Repo e pnpm.

## 🎯 Funcionalidades Implementadas

- ✅ **Autenticação JWT** (Login, Register, Refresh Token)
- ✅ **Swagger UI** para documentação interativa da API
- ✅ **PostgreSQL** com TypeORM e migrações
- ✅ **RabbitMQ** para mensageria entre serviços
- ✅ **Docker Compose** para orquestração de containers
- ✅ **CORS** habilitado
- ✅ **Validação de dados** com ValidationPipe
- ✅ **Guards JWT** para proteção de rotas

## 📋 Arquitetura

### Serviços

- **API Gateway** (porta 3000) - Ponto de entrada HTTP + Autenticação JWT
- **User Service** (porta 3001) - Gerenciamento de usuários + PostgreSQL
- **Order Service** (porta 3002) - Gerenciamento de pedidos + PostgreSQL
- **Payment Service** (porta 3003) - Processamento de pagamentos + PostgreSQL + Event-driven
- **RabbitMQ** (portas 5672/15672) - Message broker para comunicação assíncrona
- **PostgreSQL Users** (porta 5432) - Banco de dados de usuários
- **PostgreSQL Orders** (porta 5433) - Banco de dados de pedidos
- **PostgreSQL Payments** (porta 5434) - Banco de dados de pagamentos

### Estrutura DDD

Cada microserviço segue a estrutura DDD:

```
service/
├── domain/           # Entidades e regras de negócio
│   ├── entities/
│   └── repositories/
├── application/      # Casos de uso
│   └── use-cases/
├── infrastructure/   # Implementações técnicas
│   └── repositories/
└── presentation/     # Controllers e DTOs
    └── controllers/
```

### Pacotes Compartilhados

- **@ecommerce/shared** - DTOs e interfaces compartilhadas

## 🚀 Instalação

### Pré-requisitos

- Node.js >= 18
- pnpm >= 10

### Passos

1. Instalar dependências:

```bash
pnpm install
```

2. Compilar pacote shared:

```bash
cd packages/shared
pnpm build
cd ../..
```

## ▶️ Executar com Docker (Recomendado)

### Construir e iniciar todos os serviços

```bash
docker-compose up --build
```

### Iniciar em background

```bash
docker-compose up -d --build
```

### Ver logs

```bash
docker-compose logs -f
```

### Parar e remover containers

```bash
docker-compose down
```

### Parar e remover containers + volumes

```bash
docker-compose down -v
```

### Serviços disponíveis após iniciar:

- 🌐 API Gateway: http://localhost:3000
- 📚 Swagger UI: http://localhost:3000/api/docs
- 🐰 RabbitMQ Management: http://localhost:15672 (guest/guest)
- 🐘 PostgreSQL Users: localhost:5432
- 🐘 PostgreSQL Orders: localhost:5433
- 🐘 PostgreSQL Payments: localhost:5434

## 📦 Scripts Disponíveis

### Desenvolvimento

```bash
# Iniciar todos os serviços em modo watch
pnpm dev

# Iniciar serviço específico
cd apps/user-service && pnpm dev
cd apps/order-service && pnpm dev
cd apps/api-gateway && pnpm dev
```

### Build

```bash
# Build de todos os projetos
pnpm build

# Build de serviço específico
cd apps/user-service && pnpm build
```

### Produção

```bash
# Iniciar todos os serviços
pnpm start
```

## 🔌 Endpoints da API

### 🔐 Autenticação (Pública)

**POST** `/auth/register` - Registrar novo usuário

```json
{
    "name": "João Silva",
    "email": "joao@email.com",
    "password": "senha123"
}
```

Resposta: `{ accessToken, refreshToken, user }`

**POST** `/auth/login` - Login de usuário

```json
{
    "email": "joao@email.com",
    "password": "senha123"
}
```

Resposta: `{ accessToken, refreshToken, user }`

**POST** `/auth/refresh` - Renovar access token

```json
{
    "refreshToken": "seu-refresh-token"
}
```

Resposta: `{ accessToken, refreshToken }`

### 👤 Users (Requer autenticação JWT)

**GET** `/users/:id` - Buscar usuário por ID

**GET** `/users` - Listar todos os usuários

### 📦 Orders (Requer autenticação JWT)

**POST** `/orders` - Criar novo pedido

```json
{
    "userId": "uuid-do-usuario",
    "items": [
        {
            "productId": "produto-1",
            "quantity": 2,
            "price": 99.9
        }
    ]
}
```

**GET** `/orders/:id` - Buscar pedido por ID

**GET** `/orders/user/:userId` - Listar pedidos de um usuário

**GET** `/orders` - Listar todos os pedidos

**PATCH** `/orders/:id/confirm` - Confirmar pedido (PENDING → CONFIRMED)

**PATCH** `/orders/:id/ship` - Enviar pedido (CONFIRMED → SHIPPED)

**PATCH** `/orders/:id/deliver` - Entregar pedido (SHIPPED → DELIVERED)

**PATCH** `/orders/:id/cancel` - Cancelar pedido (exceto DELIVERED)

### 💳 Payments (Requer autenticação JWT)

**POST** `/payments` - Criar novo pagamento

```json
{
    "orderId": "uuid-do-pedido",
    "amount": 299.90,
    "method": "CREDIT_CARD"
}
```

**GET** `/payments/:id` - Buscar pagamento por ID

**GET** `/payments/order/:orderId` - Buscar pagamento de um pedido

**GET** `/payments/user/:userId` - Listar pagamentos de um usuário

**GET** `/payments` - Listar todos os pagamentos

**PATCH** `/payments/:id/refund` - Reembolsar pagamento

**Fluxo automático:** Quando um pedido é aceito (`order.created.accepted`), o Payment Service cria automaticamente um pagamento e processa. Após processamento, eventos são publicados (`payment.completed` ou `payment.failed`) e o Order Service atualiza o status do pedido automaticamente.

### 📚 Documentação

**Swagger UI:** http://localhost:3000/api/docs

- Documentação interativa de todos os endpoints
- Testar APIs diretamente pelo navegador
- Esquemas de dados e validações
- Suporte para autenticação Bearer Token

**Documentação Técnica:**
- [Arquitetura](./docs/ARQUITETURA.md) - Visão geral da arquitetura do sistema
- [Comandos](./docs/COMANDOS.md) - Guia de comandos úteis
- [Exemplos](./docs/EXEMPLOS.md) - Exemplos práticos de uso
- [Diagramas C4](./docs/) - Diagramas de arquitetura (Context, Container, Component)
- [ADRs](./docs/adr/) - Architecture Decision Records (decisões arquiteturais)

## 🧪 Testando a API

### Opção 1: Usando Swagger UI (Recomendado)

1. Acesse http://localhost:3000/api/docs
2. Registre um usuário em `/auth/register`
3. Copie o `accessToken` da resposta
4. Clique em **Authorize** no topo da página
5. Cole o token e teste os endpoints protegidos

### Opção 2: Usando cURL

### 1. Registrar um usuário

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Santos",
    "email": "maria@email.com",
    "password": "senha123"
  }'
```

Resposta inclui `accessToken` e `refreshToken`.

### 2. Fazer login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@email.com",
    "password": "senha123"
  }'
```

### 3. Listar usuários (com autenticação)

```bash
curl http://localhost:3000/users \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI"
```

### 4. Criar um pedido (com autenticação)

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI" \
  -d '{
    "userId": "COLE_O_ID_DO_USUARIO_AQUI",
    "items": [
      {
        "productId": "produto-1",
        "quantity": 2,
        "price": 50.00
      },
      {
        "productId": "produto-2",
        "quantity": 1,
        "price": 100.00
      }
    ]
  }'
```

### 4. Confirmar pedido

```bash
curl -X PATCH http://localhost:3000/orders/ID_DO_PEDIDO/confirm
```

## 🏗️ Estrutura do Projeto

```
ecommerce-microservices/
├── apps/
│   ├── api-gateway/       # Gateway HTTP
│   ├── user-service/      # Microserviço de usuários
│   └── order-service/     # Microserviço de pedidos
├── packages/
│   └── shared/            # Código compartilhado
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 🎯 Conceitos Implementados

### Domain-Driven Design (DDD)

- **Entities**: Objetos com identidade única (User, Order)
- **Value Objects**: Objetos sem identidade (OrderItem)
- **Repositories**: Abstração de persistência
- **Use Cases**: Lógica de aplicação isolada

### Microserviços

- Comunicação TCP entre serviços
- API Gateway como ponto de entrada
- Serviços independentes e desacoplados

### Turbo Repo

- Build cache inteligente
- Execução paralela de tarefas
- Gerenciamento de monorepo

## �️ Banco de Dados e Migrações

### Executar migrações (PostgreSQL)

```bash
# User Service
cd apps/user-service
pnpm migration:run
cd ../..

# Order Service
cd apps/order-service
pnpm migration:run
cd ../..

# Payment Service
cd apps/payment-service
pnpm migration:run
cd ../..
```

### Gerar nova migração

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

### Reverter última migração

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

### Conectar ao banco via psql

```bash
# Database Users
docker exec -it postgres-users psql -U user_service -d users_db

# Database Orders
docker exec -it postgres-orders psql -U order_service -d orders_db

# Database Payments
docker exec -it postgres-payments psql -U payment_service -d payments_db
```

## 📝 Próximos Passos

- [x] Dockerizar os serviços
- [x] Adicionar banco de dados PostgreSQL com TypeORM
- [x] Implementar autenticação JWT completa
- [x] Adicionar Swagger UI para documentação
- [x] Configurar RabbitMQ para mensageria
- [x] Implementar event-driven communication com RabbitMQ
- [x] Implementar testes unitários e E2E
- [x] Implementar CI/CD com GitHub Actions
- [x] Implementar circuit breaker
- [ ] Implementar observabilidade completa (logs estruturados, métricas, traces) - Ver [ADR-001](./docs/adr/001-observabilidade-arquitetura-event-driven.md)
- [ ] Adicionar rate limiting
- [ ] Implementar health checks com @nestjs/terminus
- [ ] Adicionar versionamento de APIs e eventos
