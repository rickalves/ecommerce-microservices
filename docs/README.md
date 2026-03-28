# Documentação — E-commerce Microservices

Índice central de toda a documentação técnica do projeto.

---

## Arquitetura

| Documento                                                                       | Descrição                                                                   |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [arquitetura.md](./architecture/arquitetura.md)                                 | Visão geral da arquitetura, camadas DDD, fluxo de eventos                   |
| [outbox-pattern.md](./architecture/outbox-pattern.md)                           | Outbox Pattern: componentes, fluxo de estado, eventos cobertos Implementado |
| [observabilidade-arquitetura.md](./architecture/observabilidade-arquitetura.md) | Arquitetura do stack OTel: componentes, design e infra Implementado         |
| [observabilidade-guia.md](./architecture/observabilidade-guia.md)               | Guia legado — logging estruturado com Pino e CorrelationId (Fase 1)         |
| [fase1-resumo.md](./architecture/fase1-resumo.md)                               | Resumo da Fase 1: logging estruturado com Pino e CorrelationId              |

---

## Guias de Desenvolvimento

| Documento                                                 | Descrição                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| [comandos.md](./guides/comandos.md)                       | Referência completa de comandos (Docker, pnpm, migrações, testes, outbox) |
| [observabilidade-uso.md](./guides/observabilidade-uso.md) | Como usar o stack OTel: traces, logs, métricas, Exemplars, health checks  |
| [exemplos.md](./guides/exemplos.md)                       | Exemplos práticos de fluxos completos via cURL                            |
| [teste-http-direto.md](./guides/teste-http-direto.md)     | Guia de testes de comunicação HTTP direta entre serviços                  |

---

## Diagramas

Todos os diagramas estão em formato [Mermaid](https://mermaid.js.org/) na pasta [`diagrams/`](./diagrams/).

| Arquivo                                                               | Tipo       | Descrição                                               |
| --------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| [c4-context-level1.mmd](./diagrams/c4-context-level1.mmd)             | C4 Level 1 | Contexto do sistema — atores e sistemas externos        |
| [c4-container-level2.mmd](./diagrams/c4-container-level2.mmd)         | C4 Level 2 | Containers — serviços, bancos de dados, broker          |
| [c4-component-level3.mmd](./diagrams/c4-component-level3.mmd)         | C4 Level 3 | Componentes internos de cada serviço                    |
| [sequence-order-creation.mmd](./diagrams/sequence-order-creation.mmd) | Sequência  | Fluxo de criação de pedido e processamento de pagamento |

---

## Architecture Decision Records (ADR)

Decisões arquiteturais documentadas seguindo o formato [MADR](./adr/README.md).

| #                                                               | Título                                                 | Status   |
| --------------------------------------------------------------- | ------------------------------------------------------ | -------- |
| [001](./adr/001-microservicos-eda-vs-arquitetura-em-camadas.md) | Microserviços com EDA vs Arquitetura em Camadas        | Aceito   |
| [002](./adr/002-observabilidade-arquitetura-event-driven.md)    | Observabilidade em Arquitetura Event-Driven            | Proposto |
| [003](./adr/003-comunicacao-sincrona-vs-assincrona.md)          | Comunicação Síncrona vs Assíncrona (CQRS simplificado) | Proposto |
| [004](./adr/004-autenticacao-jwt-api-gateway.md)                | Autenticação JWT centralizada no API Gateway           | Aceito   |
| [005](./adr/005-monorepo-turborepo-pnpm.md)                     | Estrutura Monorepo com Turborepo e pnpm workspaces     | Aceito   |
| [006](./adr/006-outbox-pattern-garantia-transacional.md)        | Outbox Pattern para Garantia Transacional de Eventos   | Aceito   |

> Para criar um novo ADR, consulte o [guia de ADRs](./adr/README.md).
