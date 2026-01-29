# Guia Passo a Passo - Criação do Projeto

## 📚 Passo 1: Configuração Inicial do Monorepo

### 1.1 Criar diretório do projeto
```bash
mkdir ecommerce-microservices
cd ecommerce-microservices
```

### 1.2 Inicializar projeto com pnpm
```bash
pnpm init
```

### 1.3 Criar estrutura de diretórios
```bash
mkdir -p apps packages
```

### 1.4 Criar arquivos de configuração do Turbo Repo

**package.json** (raiz):
- Define workspaces
- Scripts para turbo
- Dependências de desenvolvimento

**turbo.json**:
- Pipeline de builds
- Configuração de cache
- Dependências entre projetos

**pnpm-workspace.yaml**:
- Define workspaces do pnpm
- Lista apps/* e packages/*

## 📦 Passo 2: Criar Pacote Compartilhado

### 2.1 Criar estrutura
```bash
mkdir -p packages/shared/src/{domain,dtos}
cd packages/shared
```

### 2.2 Criar package.json
- Nome: @ecommerce/shared
- Dependências: class-validator, class-transformer
- Scripts: build, dev

### 2.3 Criar tsconfig.json
- Configurar compilação TypeScript
- Gerar declarations (.d.ts)

### 2.4 Criar DTOs
- **create-user.dto.ts**: Validações para criação de usuário
- **create-order.dto.ts**: Validações para criação de pedido

### 2.5 Criar interfaces de domínio
- **user.interface.ts**: Contrato do usuário
- **order.interface.ts**: Contrato do pedido + enum de status

### 2.6 Criar index.ts
- Exportar todos os DTOs e interfaces

### 2.7 Compilar pacote
```bash
pnpm build
```

## 👤 Passo 3: Criar User Service (Microserviço de Usuários)

### 3.1 Criar estrutura DDD
```bash
mkdir -p apps/user-service/src/{domain,application,infrastructure,presentation}
```

### 3.2 Configurar projeto NestJS
- **package.json**: Dependências do NestJS + @ecommerce/shared
- **nest-cli.json**: Configuração CLI
- **tsconfig.json**: Configuração TypeScript

### 3.3 Camada de Domínio

**domain/entities/user.entity.ts**:
- Classe User com propriedades
- Métodos de negócio (updateName, updateEmail)
- Factory method (create)

**domain/repositories/user.repository.interface.ts**:
- Interface IUserRepository
- Métodos: save, findById, findByEmail, findAll, delete
- Symbol para injeção de dependência

### 3.4 Camada de Aplicação

**application/use-cases/create-user.use-case.ts**:
- Validar email único
- Criar entidade User
- Salvar no repositório

**application/use-cases/get-user.use-case.ts**:
- Buscar usuário por ID
- Listar todos os usuários

### 3.5 Camada de Infraestrutura

**infrastructure/repositories/in-memory-user.repository.ts**:
- Implementar IUserRepository
- Usar Map para armazenamento em memória
- Implementar todos os métodos

### 3.6 Camada de Apresentação

**presentation/controllers/user.controller.ts**:
- Controller do NestJS
- Message patterns para comunicação TCP
- Injetar use cases

### 3.7 Módulo e Bootstrap

**user.module.ts**:
- Registrar controller
- Registrar use cases
- Prover repositório com injeção de dependência

**main.ts**:
- Criar microserviço NestJS
- Configurar transporte TCP na porta 3001
- Iniciar serviço

## 📦 Passo 4: Criar Order Service (Microserviço de Pedidos)

### 4.1 Criar estrutura DDD
```bash
mkdir -p apps/order-service/src/{domain,application,infrastructure,presentation}
```

### 4.2 Configurar projeto NestJS
- Similar ao User Service
- Porta: 3002

### 4.3 Camada de Domínio

**domain/entities/order.entity.ts**:
- Classe Order com propriedades
- Métodos de negócio (confirm, cancel, ship, deliver)
- Factory method calculando totalAmount
- Validações de transição de estado

**domain/repositories/order.repository.interface.ts**:
- Interface IOrderRepository
- Métodos específicos: findByUserId

### 4.4 Camada de Aplicação

**application/use-cases/create-order.use-case.ts**:
- Criar pedido com itens
- Calcular total automaticamente

**application/use-cases/get-order.use-case.ts**:
- Buscar por ID
- Buscar por usuário
- Listar todos

**application/use-cases/update-order-status.use-case.ts**:
- Confirmar pedido
- Enviar pedido
- Entregar pedido
- Cancelar pedido

### 4.5 Camada de Infraestrutura

**infrastructure/repositories/in-memory-order.repository.ts**:
- Implementação em memória
- Filtro por userId

### 4.6 Camada de Apresentação

**presentation/controllers/order.controller.ts**:
- Message patterns para CRUD
- Message patterns para alteração de status

### 4.7 Módulo e Bootstrap

**order.module.ts**:
- Registrar todos os providers

**main.ts**:
- TCP na porta 3002

## 🌐 Passo 5: Criar API Gateway

### 5.1 Criar estrutura
```bash
mkdir -p apps/api-gateway/src/{users,orders}
```

### 5.2 Configurar projeto NestJS
- Aplicação HTTP (não microserviço)

### 5.3 Configurar clientes de microserviços

**app.module.ts**:
- ClientsModule.register
- Registrar USER_SERVICE (porta 3001)
- Registrar ORDER_SERVICE (porta 3002)

### 5.4 Criar controllers HTTP

**users/users.controller.ts**:
- Endpoints REST para usuários
- POST /users
- GET /users/:id
- GET /users
- Comunicar com User Service via TCP

**orders/orders.controller.ts**:
- Endpoints REST para pedidos
- POST /orders
- GET /orders/:id
- GET /orders/user/:userId
- PATCH /orders/:id/confirm
- PATCH /orders/:id/ship
- PATCH /orders/:id/deliver
- PATCH /orders/:id/cancel
- Comunicar com Order Service via TCP

### 5.5 Configurar validação global

**main.ts**:
- ValidationPipe global
- CORS habilitado
- Porta 3000

## 🚀 Passo 6: Executar o Projeto

### 6.1 Instalar todas as dependências
```bash
# Na raiz do projeto
pnpm install
```

### 6.2 Compilar pacote shared
```bash
cd packages/shared
pnpm build
cd ../..
```

### 6.3 Opção 1: Executar todos os serviços simultaneamente
```bash
pnpm dev
```

### 6.4 Opção 2: Executar serviços individualmente

**Terminal 1 - User Service:**
```bash
cd apps/user-service
pnpm dev
```

**Terminal 2 - Order Service:**
```bash
cd apps/order-service
pnpm dev
```

**Terminal 3 - API Gateway:**
```bash
cd apps/api-gateway
pnpm dev
```

## 🧪 Passo 7: Testar a API

### 7.1 Criar usuário
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@email.com",
    "password": "senha123"
  }'
```

Resposta:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "João Silva",
  "email": "joao@email.com",
  "createdAt": "2026-01-28T...",
  "updatedAt": "2026-01-28T..."
}
```

### 7.2 Listar usuários
```bash
curl http://localhost:3000/users
```

### 7.3 Criar pedido
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "items": [
      {
        "productId": "prod-1",
        "quantity": 2,
        "price": 50.00
      }
    ]
  }'
```

### 7.4 Confirmar pedido
```bash
curl -X PATCH http://localhost:3000/orders/{ORDER_ID}/confirm
```

### 7.5 Listar pedidos do usuário
```bash
curl http://localhost:3000/orders/user/{USER_ID}
```

## 📊 Estrutura Final

```
ecommerce-microservices/
├── apps/
│   ├── api-gateway/
│   │   ├── src/
│   │   │   ├── users/
│   │   │   │   └── users.controller.ts
│   │   │   ├── orders/
│   │   │   │   └── orders.controller.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── user-service/
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── user.entity.ts
│   │   │   │   └── repositories/
│   │   │   │       └── user.repository.interface.ts
│   │   │   ├── application/
│   │   │   │   └── use-cases/
│   │   │   │       ├── create-user.use-case.ts
│   │   │   │       └── get-user.use-case.ts
│   │   │   ├── infrastructure/
│   │   │   │   └── repositories/
│   │   │   │       └── in-memory-user.repository.ts
│   │   │   ├── presentation/
│   │   │   │   └── controllers/
│   │   │   │       └── user.controller.ts
│   │   │   ├── user.module.ts
│   │   │   └── main.ts
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── order-service/
│       ├── src/
│       │   ├── domain/
│       │   │   ├── entities/
│       │   │   │   └── order.entity.ts
│       │   │   └── repositories/
│       │   │       └── order.repository.interface.ts
│       │   ├── application/
│       │   │   └── use-cases/
│       │   │       ├── create-order.use-case.ts
│       │   │       ├── get-order.use-case.ts
│       │   │       └── update-order-status.use-case.ts
│       │   ├── infrastructure/
│       │   │   └── repositories/
│       │   │       └── in-memory-order.repository.ts
│       │   ├── presentation/
│       │   │   └── controllers/
│       │   │       └── order.controller.ts
│       │   ├── order.module.ts
│       │   └── main.ts
│       ├── nest-cli.json
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── domain/
│       │   │   ├── user.interface.ts
│       │   │   └── order.interface.ts
│       │   ├── dtos/
│       │   │   ├── create-user.dto.ts
│       │   │   └── create-order.dto.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

## ✅ Checklist de Validação

- [ ] Turbo Repo configurado
- [ ] pnpm workspace funcionando
- [ ] Pacote shared compilado
- [ ] User Service rodando na porta 3001
- [ ] Order Service rodando na porta 3002
- [ ] API Gateway rodando na porta 3000
- [ ] Criar usuário via API Gateway
- [ ] Listar usuários via API Gateway
- [ ] Criar pedido via API Gateway
- [ ] Alterar status do pedido
- [ ] Listar pedidos do usuário
