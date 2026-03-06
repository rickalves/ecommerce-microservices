# Arquitetura do Sistema

## 📐 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE HTTP                            │
│                    (Browser / Postman / cURL)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ HTTP REST
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                                   │
│                      (Porta 3000 - HTTP)                             │
│                                                                      │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │    Auth      │  │    Users    │  │   Orders     │  │ Payments │ │
│  │ Controller + │  │ Controller  │  │  Controller  │  │Controller│ │
│  │ JWT Service  │  └─────────────┘  └──────────────┘  └──────────┘ │
│  └──────────────┘          Swagger UI: /api/docs                    │
└─────────────┬──────────────────┬─────────────────┬───────────────────┘
              │                  │                 │
              │ TCP              │ RMQ             │ RMQ
              │                  │                 │
    ┌─────────▼──────┐  ┌────────▼────────┐  ┌────▼───────────┐
    │ USER SERVICE   │  │ ORDER SERVICE   │  │ PAYMENT SERVICE│
    │ (Porta 3001)   │  │ (Porta 3002)    │  │ (Porta 3003)   │
    │   [DDD]        │  │   [DDD + RMQ]   │  │ [DDD + RMQ]    │
    └────────┬───────┘  └────────┬────────┘  └────┬───────────┘
             │                   │                 │
             │ PostgreSQL        │ PostgreSQL      │ PostgreSQL
             │                   │                 │
    ┌────────▼────────┐  ┌───────▼────────┐  ┌────▼───────────┐
    │ POSTGRES-USERS  │  │ POSTGRES-ORDERS│  │POSTGRES-PAYMENTS│
    │  (Porta 5432)   │  │  (Porta 5433)  │  │  (Porta 5434)  │
    │   users_db      │  │   orders_db    │  │  payments_db   │
    └─────────────────┘  └───────┬────────┘  └────┬───────────┘
                                 │                 │
                                 │     AMQP        │
                                 └────────┬────────┘
                                          │
                               ┌──────────▼──────────┐
                               │     RABBITMQ        │
                               │ (Porta 5672/15672)  │
                               │  Message Broker     │
                               │                     │
                               │ ┌─────────────────┐ │
                               │ │ order.created   │ │
                               │ │ order.accepted  │ │
                               │ │ order.cancelled │ │
                               │ │ payment.completed│ │
                               │ │ payment.failed  │ │
                               │ └─────────────────┘ │
                               └─────────────────────┘

Event Flow:
1. Order Created → Payment Service (process payment)
2. Payment Completed/Failed → Order Service (update status)
```

## 🏗️ Estrutura DDD por Camada

### 1. PRESENTATION (Apresentação)

```
Responsabilidade: Interface com o mundo externo
- Controllers (MessagePattern para TCP)
- DTOs de entrada/saída
- Validações de entrada
```

### 2. APPLICATION (Aplicação)

```
Responsabilidade: Orquestração de casos de uso
- Use Cases (CreateUser, GetUser, etc.)
- Lógica de aplicação
- Coordenação de operações
```

### 3. DOMAIN (Domínio)

```
Responsabilidade: Regras de negócio puras
- Entities (User, Order)
- Value Objects (OrderItem)
- Repository Interfaces
- Lógica de negócio
```

### 4. INFRASTRUCTURE (Infraestrutura)

```
Responsabilidade: Implementações técnicas
- Repository Implementations (TypeORM)
- Banco de dados PostgreSQL
- Entities TypeORM (mapeamento ORM)
- Migrações do banco de dados
- Serviços externos
- Configurações
```

## 🔄 Fluxo de Comunicação

### Autenticar Usuário (JWT)

```
1. Cliente → POST /auth/register ou /auth/login
2. API Gateway → AuthController
3. AuthController → AuthService
4. AuthService → USER_SERVICE.send('create_user' ou 'validate_user')
5. User Service → CreateUserUseCase ou ValidateUserUseCase
6. UseCase → UserRepository → PostgreSQL
7. AuthService → Gera accessToken e refreshToken (JWT)
8. Resposta com tokens e dados do usuário
```

### Acessar Rota Protegida

```
1. Cliente → GET /users (com Authorization: Bearer <token>)
2. API Gateway → JwtAuthGuard intercepta
3. JwtAuthGuard → Valida token JWT
4. Se válido → JwtStrategy extrai payload
5. Continua com a requisição normalmente
6. Se inválido → Retorna 401 Unauthorized
```

### Criar Usuário

```
1. Cliente → POST /users
2. API Gateway → Users Controller
3. Users Controller → USER_SERVICE.send('create_user')
4. User Service → UserController (TCP)
5. UserController → CreateUserUseCase
6. CreateUserUseCase → TypeOrmUserRepository
7. TypeOrmUserRepository → PostgreSQL (users_db)
8. Resposta volta pela cadeia inversa
```

### Criar Pedido

```
1. Cliente → POST /orders
2. API Gateway → Orders Controller
3. Orders Controller → ORDER_SERVICE.send('create_order')
4. Order Service → OrderController (RMQ)
5. OrderController → CreateOrderUseCase
6. CreateOrderUseCase → Order.create() (Entity)
7. Order Entity → Calcula totalAmount
8. TypeOrmOrderRepository → PostgreSQL (orders_db)
9. UseCase → Publica evento 'order.created.accepted' no RabbitMQ
10. Resposta volta pela cadeia inversa
```

### Processar Pagamento (Event-Driven)

```
1. Order Service → Publica 'order.created.accepted' no RabbitMQ
2. Payment Service → Escuta evento 'order.created.accepted'
3. PaymentController → ProcessPaymentUseCase
4. ProcessPaymentUseCase → Payment.create() (Entity)
5. Payment Entity → Simula processamento (90% success rate)
6. TypeOrmPaymentRepository → PostgreSQL (payments_db)
7. UseCase → Publica 'payment.completed' ou 'payment.failed'
8. Order Service → Escuta evento de pagamento
   - payment.completed → Confirma pedido (Status CONFIRMED)
   - payment.failed → Cancela pedido (Status CANCELLED)
```

## 📦 Estrutura de Pacotes

```
monorepo/
│
├── apps/                          # Aplicações
│   ├── api-gateway/              # Gateway HTTP
│   ├── user-service/             # Microserviço de usuários
│   ├── order-service/            # Microserviço de pedidos
│   └── payment-service/          # Microserviço de pagamentos
│
└── packages/                      # Código compartilhado
    └── shared/                   # DTOs e Interfaces
```

## 🎯 Princípios Aplicados

### DDD (Domain-Driven Design)

- **Entities**: Objetos com identidade (User, Order)
- **Value Objects**: Objetos imutáveis (OrderItem)
- **Repositories**: Abstração de persistência
- **Use Cases**: Casos de uso da aplicação
- **Separation of Concerns**: Cada camada tem uma responsabilidade

### Segurança

- **JWT (JSON Web Tokens)**: Autenticação stateless
- **Access Token**: Token de curta duração para acesso a recursos
- **Refresh Token**: Token de longa duração para renovar access token
- **bcrypt**: Hash de senhas para segurança
- **Guards**: Proteção de rotas no API Gateway
- **Decorators**: @Public() para rotas públicas, @CurrentUser() para obter usuário

### Microserviços

- **Independência**: Cada serviço pode ser deployado separadamente
- **Comunicação Síncrona (TCP)**: API Gateway ↔ Microserviços para requisições/respostas imediatas
- **Comunicação Assíncrona (AMQP)**: Order Service → RabbitMQ → Outros serviços para eventos
- **API Gateway**: Ponto único de entrada + Autenticação centralizada JWT
- **Bounded Contexts**: Cada serviço tem seu contexto delimitado e base de dados independente
- **Event-Driven Architecture**: Eventos de domínio publicados no RabbitMQ
- **Message Broker (RabbitMQ)**:
    - Garante entrega de mensagens
    - Permite múltiplos consumidores
    - Desacopla serviços produtores e consumidores
    - Persistência de mensagens para resiliência

### Documentação

- **Swagger/OpenAPI**: Documentação interativa automática
- **API Docs**: Interface web para testar endpoints
- **Bearer Auth**: Suporte para autenticação JWT no Swagger
- **DTOs documentados**: Esquemas de dados detalhados

### Clean Architecture

- **Dependency Rule**: Dependências apontam para dentro
- **Domain no centro**: Regras de negócio isoladas
- **Infrastructure na borda**: Detalhes técnicos isolados
- **Testabilidade**: Fácil de testar cada camada

## 🔌 Portas e Protocolos

```
┌─────────────────┴────────────┴────────────┴──────────────────────┐
│   Serviço       │ Porta│ Protocolo  │   Descrição              │
├─────────────────┼──────┼────────────┼──────────────────────────┤
│ API Gateway     │ 3000 │   HTTP     │ REST API + JWT           │
│ Swagger UI      │ 3000 │   HTTP     │ /api/docs                │
│ User Service    │ 3001 │   TCP      │ Microserviço             │
│ Order Service   │ 3002 │   RMQ      │ Microserviço + Events    │
│ Payment Service │ 3003 │   RMQ      │ Microserviço + Events    │
│ RabbitMQ        │ 5672 │   AMQP     │ Message Broker           │
│ RabbitMQ UI     │15672 │   HTTP     │ Management Console       │
│ Postgres Users  │ 5432 │ PostgreSQL │ DB do User Service       │
│ Postgres Orders │ 5433 │ PostgreSQL │ DB do Order Service      │
│ Postgres Payments│5434 │ PostgreSQL │ DB do Payment Service    │
└─────────────────┴──────┴────────────┴──────────────────────────┘
```

## 🗂️ Entidades e Relacionamentos

```
┌─────────────────┐
│      USER       │
├─────────────────┤
│ - id            │
│ - name          │
│ - email (único) │
│ - password      │
│ - createdAt     │
│ - updatedAt     │
└────────┬────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────┐
│      ORDER      │
├─────────────────┤
│ - id            │
│ - userId        │
│ - items[]       │
│ - totalAmount   │
│ - status        │
│ - createdAt     │
│ - updatedAt     │
└────────┬────────┘
         │
         │ 1:1
         │
         ▼
┌─────────────────┐
│    PAYMENT      │
├─────────────────┤
│ - id            │
│ - orderId       │
│ - userId        │
│ - amount        │
│ - status        │
│ - method        │
│ - transactionId │
│ - createdAt     │
│ - updatedAt     │
└─────────────────┘

Order Status Enum:
- PENDING
- CONFIRMED (após payment.completed)
- SHIPPED
- DELIVERED
- CANCELLED (após payment.failed)

Payment Status Enum:
- PENDING
- PROCESSING
- COMPLETED
- FAILED
- REFUNDED

Payment Method Enum:
- CREDIT_CARD
- DEBIT_CARD
- PIX
- BOLETO
```

## 🚀 Vantagens da Arquitetura

### Escalabilidade

- Cada microserviço pode escalar independentemente
- Load balancing por serviço
- Horizontal scaling facilitado
- **RabbitMQ permite múltiplos consumidores** para o mesmo evento
- **Processamento assíncrono** não bloqueia requisições HTTP

### Manutenibilidade

- Código organizado em camadas

### Manutenibilidade

- Código organizado em camadas
- Separação clara de responsabilidades
- Fácil localização de bugs

### Testabilidade

- Camadas independentes
- Mocks facilitados pela injeção de dependência
- Testes unitários por camada

### Flexibilidade

- Trocar implementação sem afetar outras camadas
- Adicionar novos serviços facilmente
- Mudar tecnologia de persistência sem impacto

### Evolução

- Adicionar novos casos de uso
- Estender entidades de domínio
- Novos endpoints na API Gateway
