# ADR 001: Microserviços com EDA vs Arquitetura em Camadas

**Data:** 2026-02-21
**Status:** Aceito
**Contexto:** Escolha do estilo arquitetural fundamental para o sistema de e-commerce

---

## Contexto

Ao iniciar o projeto, a primeira decisão crítica foi sobre o estilo arquitetural. Temos um domínio de e-commerce composto por, pelo menos, três contextos bem delimitados: **usuários**, **pedidos** e **pagamentos**. Cada um com suas regras, modelos de dados e ritmos de evolução distintos.

O time precisava decidir entre:

- **Opção A:** Aplicação monolítica com arquitetura em camadas (Presentation → Application → Domain → Infrastructure)
- **Opção B:** Microserviços com comunicação assíncrona via eventos (EDA — Event-Driven Architecture)

A escolha determina como o sistema cresce, como falhas se propagam, como os times trabalham e qual o custo operacional a longo prazo.

---

## Decisão

Adotar **microserviços com Event-Driven Architecture (EDA)**, onde cada serviço é autônomo, possui seu próprio banco de dados e se comunica com os demais por meio de eventos publicados em um message broker (RabbitMQ).

### Visão geral da arquitetura

```
                        ┌─────────────────────────────────────────────┐
                        │              API Gateway :3000               │
                        │  (Autenticação JWT · Roteamento · CORS)      │
                        └──────┬────────────────┬────────────────┬─────┘
                    HTTP       │                │ HTTP           │ HTTP
                               ▼                ▼                ▼
                    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                    │ User Service │  │Order Service │  │Payment Svc   │
                    │   :3001      │  │   :3002      │  │   :3003      │
                    │  PostgreSQL  │  │  PostgreSQL  │  │  PostgreSQL  │
                    └──────────────┘  └──────┬───────┘  └──────┬───────┘
                                             │                  │
                                             └────────┬─────────┘
                                                      │ AMQP
                                             ┌────────▼────────┐
                                             │    RabbitMQ      │
                                             │  (Message Broker)│
                                             └─────────────────┘
```

Cada serviço segue internamente a estrutura em camadas do **DDD**:

```
service/
├── domain/          # Entidades, Value Objects, repositório (interface)
├── application/     # Casos de uso, orquestração, handlers de eventos
├── infrastructure/  # TypeORM, RabbitMQ producer/consumer, HTTP clients
└── presentation/    # Controllers REST, DTOs, pipes de validação
```

---

## Características Arquiteturais e Por Que São Necessárias

Esta seção documenta as propriedades que a arquitetura **deve ter** e a justificativa de negócio e técnica para cada uma. Propriedades não documentadas aqui não são garantidas pela arquitetura.

---

### 1. Independência de domínio por Bounded Context

**O que é:** Cada microserviço representa exatamente um bounded context do DDD. `User Service` cuida de identidade e autenticação; `Order Service` cuida do ciclo de vida de pedidos; `Payment Service` cuida de transações financeiras. Eles nunca compartilham banco de dados nem modelos de domínio diretamente.

**Por que é necessário:**
Os três contextos têm linguagens ubíquas distintas. O conceito de "pedido" no `Order Service` carrega estado, itens e endereço de entrega. Já no `Payment Service`, um pedido é apenas um `orderId` e um `amount` — não há motivo para que o serviço de pagamento conheça a estrutura interna de um pedido. Misturar esses contextos em um monolito leva inevitavelmente a vazamentos de responsabilidade, acoplamento de schema e dificuldade de evoluir os modelos independentemente.

**Consequência direta:** Um time pode alterar o schema de `orders_db` e fazer deploy do `Order Service` sem afetar o `Payment Service` nem exigir coordenação de releases.

---

### 2. Comunicação assíncrona por eventos (EDA)

**O que é:** Mudanças de estado significativas são comunicadas via eventos publicados no RabbitMQ. O serviço produtor publica e esquece (`fire-and-forget`). Os consumidores reagem no seu próprio ritmo.

**Exemplos de eventos do sistema:**

| Evento                   | Produtor        | Consumidores    |
| ------------------------ | --------------- | --------------- |
| `order.created.accepted` | Order Service   | Payment Service |
| `payment.completed`      | Payment Service | Order Service   |
| `payment.failed`         | Payment Service | Order Service   |

**Por que é necessário:**
Com comunicação síncrona pura (RPC), o `Order Service` precisaria aguardar o `Payment Service` responder em tempo real durante a criação do pedido. Isso cria **acoplamento temporal**: se o `Payment Service` estiver lento ou indisponível, a criação de pedido falha junto. Em dias de alto volume (Black Friday), essa dependência se torna um ponto único de falha em cascata.

Com EDA, o `Order Service` publica `order.created.accepted` e retorna `201 Created` imediatamente. O `Payment Service` processa quando possível. A falha de um serviço não bloqueia o outro.

**Consultas síncronas são a exceção:** Para leituras que exigem resposta imediata (ex.: `GET /orders/:id`), usamos HTTP direto ou `send()` com request-response. A regra é: **comandos são assíncronos, queries são síncronas** (ver ADR 003).

---

### 3. Database per service

**O que é:** Cada serviço tem seu próprio banco PostgreSQL isolado, sem acesso direto aos bancos dos outros serviços.

```
User Service   → postgres-users:5432   (users_db)
Order Service  → postgres-orders:5433  (orders_db)
Payment Service→ postgres-payments:5434(payments_db)
```

**Por que é necessário:**
Um banco compartilhado é o acoplamento mais forte que pode existir entre serviços. Se o `Order Service` fizer um `JOIN` direto na tabela `users`, qualquer migração no schema de usuários pode quebrar queries de pedidos. Com bancos separados, o contrato entre serviços é o **evento** (estável, versionado) e não o schema do banco (interno, volátil).

Além disso, bancos separados permitem que cada serviço escolha estratégias de tuning, índices e até tecnologias distintas no futuro, sem impacto nos demais.

---

### 4. Autonomia de deploy

**O que é:** Cada microserviço e seu banco de dados são containerizados de forma independente. Um serviço pode ser deployado, reiniciado ou escalado sem que os demais precisem de restart ou redeploy.

**Por que é necessário:**
Se uma correção urgente no cálculo de frete precisar de deploy no `Order Service`, não faz sentido bloquear esse deploy esperando validação do `Payment Service`. Autonomia de deploy é o que transforma o monorepo em microserviços de verdade — sem ela, o sistema se comporta como um monolito distribuído com toda a complexidade e nenhum dos benefícios.

---

### 5. Consistência eventual (Eventual Consistency)

**O que é:** O sistema não garante que todos os serviços enxergarão o mesmo estado ao mesmo tempo. Após um pedido ser criado, pode haver um breve período em que o `Order Service` o exibe como `PENDING` enquanto o `Payment Service` ainda não o processou.

**Por que é necessário:**
A alternativa — transações distribuídas com Two-Phase Commit (2PC) — garante consistência forte, mas impõe locks entre bancos de dados independentes, aumenta a latência e cria acoplamento de disponibilidade. Para um sistema de e-commerce, a inconsistência de segundos entre a criação do pedido e o processamento do pagamento é completamente aceitável e esperada pelos usuários.

**Trade-off explícito:** Aceitamos consistência eventual em troca de disponibilidade e desacoplamento (posicionamento AP no teorema CAP).

---

### 6. Idempotência de consumidores

**O que é:** Todos os handlers de eventos devem produzir o mesmo resultado independente de quantas vezes processem o mesmo evento. O RabbitMQ oferece garantia de entrega `at-least-once` — o mesmo evento pode ser entregue mais de uma vez em caso de falha de rede ou restart do consumidor.

**Por que é necessário:**
Sem idempotência, eventos duplicados causam pagamentos duplicados, pedidos duplicados e estados inconsistentes. Um consumidor idempotente verifica antes de processar: "já processou esse `correlationId`?" ou "esse `orderId` já tem pagamento?". Se sim, descarta silenciosamente.

**Mecanismo usado:** Verificação de existência no banco antes de inserir + constraints de unicidade no nível de banco de dados (ex.: `UNIQUE(order_id)` na tabela de pagamentos).

---

### 7. Observabilidade por CorrelationId

**O que é:** Toda requisição recebida no `API Gateway` recebe um `correlationId` único (UUID v4). Esse identificador é propagado em todos os eventos, headers HTTP internos e logs emitidos durante o processamento daquela requisição, em todos os serviços.

**Por que é necessário:**
Com 4 serviços emitindo logs simultâneos, é impossível reconstruir o caminho de uma transação sem um identificador transversal. O `correlationId` transforma logs isolados em rastreamento distribuído de baixo custo. Em produção, quando um pedido falha, basta filtrar os logs pelo `correlationId` para ver exatamente em qual serviço e em qual passo ocorreu a falha.

Sem `correlationId`, o debugging em produção de uma arquitetura distribuída torna-se inviável.

---

### 8. Escalabilidade independente por serviço

**O que é:** Cada serviço pode ter seu número de réplicas ajustado individualmente, independentemente dos demais.

**Por que é necessário:**
O perfil de carga de cada serviço é diferente. Em picos de vendas, o `Payment Service` e o `Order Service` concentram a maioria das requisições. Escalar o sistema inteiro para atender esse pico seria economicamente ineficiente. A independência de escala permite otimizar custo de infraestrutura de forma cirúrgica.

---

## Alternativas Consideradas

### 1. Monolito com arquitetura em camadas

**Descrição:** Uma única aplicação NestJS com módulos organizados por camada (Presentation → Application → Domain → Infrastructure) e um único banco PostgreSQL.

**Prós:**

- Desenvolvimento inicial mais rápido — sem necessidade de infraestrutura de mensageria
- Transactions ACID entre domínios sem complexidade de Saga/consistência eventual
- Debugging mais simples — stack trace único, sem rastreamento distribuído
- Deploy simples — um único artefato

**Contras:**

- Acoplamento crescente — com o tempo, módulos tendem a se misturar
- Escalar um componente exige escalar o sistema inteiro
- Deploy de um módulo implica redeploy de toda a aplicação
- Banco único é ponto único de falha e gargalo de performance

**Por que foi rejeitado:** O domínio de e-commerce é naturalmente dividido em contextos com requisitos de escala e ciclos de lifecycle distintos. Um monolito tornaria impossível, por exemplo, escalar a camada de pagamentos independentemente durante picos sazonais.

---

### 2. Microserviços com comunicação síncrona pura (RPC only)

**Descrição:** Microserviços idênticos aos adotados, mas com comunicação exclusivamente síncrona via HTTP ou `send()` do NestJS Microservices.

**Prós:**

- Mais simples de raciocinar — chamada → resposta, sem estados intermediários
- Sem fila para gerenciar, sem dead-letter queues, sem redelivery

**Contras:**

- Acoplamento temporal: uma falha no `Payment Service` afeta diretamente o `Order Service`
- Latência composta: tempo de resposta = soma de todas as chamadas encadeadas
- Dificulta fanout: para notificar múltiplos serviços de um evento, é necessário múltiplas chamadas síncronas

**Por que foi rejeitado:** Os fluxos de e-commerce (criação de pedido → processamento de pagamento → atualização de status) são naturalmente assíncronos. Forçá-los em RPC cria fragilidade e latência desnecessária.

---

### 3. Serverless functions (AWS Lambda / Cloud Functions)

**Descrição:** Cada caso de uso vira uma função serverless, sem servidores de longa duração.

**Prós:**

- Escala automática até zero
- Custo proporcional ao uso real

**Contras:**

- Cold starts impactam a latência em APIs síncronas
- Vendor lock-in com cloud provider
- Estado e conexões de banco mais complexas de gerenciar (connection pooling)
- Observabilidade requer ferramentas proprietárias do provider

**Por que foi rejeitado:** O projeto prioriza portabilidade e controle sobre o ambiente de execução. Containers Docker com NestJS em Node.js oferecem a mesma elasticidade com mais previsibilidade e sem dependência de um provider específico.

---

## Consequências

### Positivas

- Domínios evoluem de forma verdadeiramente independente — times podem trabalhar em paralelo sem conflitos de merge em domínios diferentes
- Falhas são isoladas: o `User Service` fora do ar não impede a consulta de pedidos existentes
- Escalabilidade cirúrgica por serviço conforme a demanda real
- Contratos de eventos forçam uma interface pública estável entre domínios
- Base para implementação futura de Saga Pattern para transações distribuídas complexas

### Negativas / Trade-offs aceitos

- Complexidade operacional elevada: gerenciar 4 serviços + 3 bancos + RabbitMQ requer Docker Compose robusto, health checks e estratégia de orquestração
- Consistência eventual exige que o front-end e os clientes da API lidem com estados transitórios (ex.: `PENDING_PAYMENT`)
- Rastreamento de bugs em produção requer observabilidade ativa (correlationId, logs estruturados) — implementada no ADR 002
- Maior curva de aprendizado para novos membros do time: DDD + EDA + microserviços + Docker em conjunto exige contexto significativo

---

## Referências

- [Building Microservices — Sam Newman](https://samnewman.io/books/building_microservices/)
- [Domain-Driven Design — Eric Evans](https://www.dddcommunity.org/book/evans_2003/)
- [Enterprise Integration Patterns — Hohpe & Woolf](https://www.enterpriseintegrationpatterns.com/)
- [CAP Theorem — Brewer](https://en.wikipedia.org/wiki/CAP_theorem)
- [ADR 002](./002-observabilidade-arquitetura-event-driven.md) — Implementação de Observabilidade
- [ADR 003](./003-comunicacao-sincrona-vs-assincrona.md) — Comunicação Síncrona vs Assíncrona (CQRS simplificado)
