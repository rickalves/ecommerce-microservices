# E-commerce Microservices

Plataforma de e-commerce construída com NestJS, arquitetura DDD e comunicação event-driven via RabbitMQ. Gerenciada como monorepo com Turborepo e pnpm workspaces.

## Serviços

| Serviço             | Porta        | Responsabilidade                        |
| ------------------- | ------------ | --------------------------------------- |
| API Gateway         | 3000         | Ponto de entrada HTTP, autenticação JWT |
| User Service        | 3001         | Gerenciamento de usuários               |
| Order Service       | 3002         | Gerenciamento de pedidos                |
| Payment Service     | 3003         | Processamento de pagamentos             |
| RabbitMQ            | 5672 / 15672 | Message broker (AMQP / Management UI)   |
| PostgreSQL Users    | 5432         | Banco de dados de usuários              |
| PostgreSQL Orders   | 5433         | Banco de dados de pedidos               |
| PostgreSQL Payments | 5434         | Banco de dados de pagamentos            |

## Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose
- Node.js >= 18 e pnpm >= 10 (apenas para desenvolvimento local)

## Quick Start

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>
cd ecommerce-microservices

# 2. Subir todos os serviços
docker-compose up -d --build

# 3. Aguardar os health checks (opcional)
docker-compose ps

# 4. Acessar a API
curl http://localhost:3000/health
```

Serviços disponíveis:

- **API:** http://localhost:3000
- **Swagger UI:** http://localhost:3000/api/docs
- **RabbitMQ Management:** http://localhost:15672 (guest / guest)

## Primeiro uso

```bash
# Registrar um usuário
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "João Silva", "email": "joao@email.com", "password": "senha123"}'

# Fazer login e guardar o token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "joao@email.com", "password": "senha123"}' | jq -r '.accessToken')

# Criar um pedido
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId": "<user-id>", "items": [{"productId": "prod-1", "quantity": 2, "price": 50.00}]}'
```

Ver mais exemplos em [docs/guides/exemplos.md](./docs/guides/exemplos.md).

## Documentação

| Categoria                     | Link                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| Indice completo               | [docs/](./docs/README.md)                                              |
| Arquitetura e DDD             | [docs/architecture/arquitetura.md](./docs/architecture/arquitetura.md) |
| Comandos e scripts            | [docs/guides/comandos.md](./docs/guides/comandos.md)                   |
| Exemplos de uso               | [docs/guides/exemplos.md](./docs/guides/exemplos.md)                   |
| Diagramas C4                  | [docs/diagrams/](./docs/diagrams/)                                     |
| Decisões arquiteturais (ADRs) | [docs/adr/](./docs/adr/)                                               |

## Desenvolvimento local

```bash
pnpm install
pnpm dev          # inicia todos os serviços em modo watch
```

Para migrações e outros comandos, consulte [docs/guides/comandos.md](./docs/guides/comandos.md).

## CI/CD

Pipeline GitHub Actions (`.github/workflows/ci.yml`): install → test → lint → build.

## Stack

NestJS · TypeScript · TypeORM · PostgreSQL · RabbitMQ · Docker · Turborepo · pnpm · JWT · Swagger
