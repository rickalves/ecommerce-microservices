# E-commerce Microservices com NestJS + DDD + Turbo Repo

Projeto de microserviços usando NestJS com arquitetura DDD (Domain-Driven Design), gerenciado com Turbo Repo e pnpm.

## 📋 Arquitetura

### Serviços

- **API Gateway** (porta 3000) - Ponto de entrada HTTP
- **User Service** (porta 3001) - Gerenciamento de usuários
- **Order Service** (porta 3002) - Gerenciamento de pedidos

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
```

## ▶️ Executar com Docker

### Construir e iniciar (com docker-compose)

```bash
docker-compose up --build
```

### Iniciar em background

```bash
docker-compose up -d --build
```

### Parar e remover

```bash
docker-compose down
```

### Observação

- Se os Dockerfiles dependerem de `packages/shared` compilado, execute `pnpm build` em `packages/shared` antes de construir as imagens.

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

### Users

**POST** `/users`

```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "senha123"
}
```

**GET** `/users/:id`

**GET** `/users`

### Orders

**POST** `/orders`

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

**GET** `/orders/:id`

**GET** `/orders/user/:userId`

**GET** `/orders`

**PATCH** `/orders/:id/confirm`

**PATCH** `/orders/:id/ship`

**PATCH** `/orders/:id/deliver`

**PATCH** `/orders/:id/cancel`

## 🧪 Testando a API

### 1. Criar um usuário

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Santos",
    "email": "maria@email.com",
    "password": "senha123"
  }'
```

### 2. Listar usuários

```bash
curl http://localhost:3000/users
```

### 3. Criar um pedido

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
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

## 📝 Próximos Passos

- [x] Dockerizar os serviços
- [ ] Adicionar testes unitários e E2E
- [ ] Implementar CI/CD
- [ ] Adicionar banco de dados (PostgreSQL/MongoDB)
- [ ] Implementar autenticação JWT
- [ ] Implementar circuit breaker
- [ ] Adicionar logging e monitoring
- [ ] Implementar event-driven communication
