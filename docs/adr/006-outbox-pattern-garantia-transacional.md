# ADR 006 — Outbox Pattern para Garantia Transacional de Eventos

- **Status:** Aceito
- **Data:** 2026-03-25
- **Autores:** Time de Plataforma

---

## Contexto

Em uma arquitetura event-driven, os serviços precisam persistir mudanças de estado **e** publicar eventos no broker de mensagens. A abordagem original usava duas operações independentes:

```
1. repository.save(entity)          // persiste no PostgreSQL
2. eventBus.emit(eventType, payload) // publica no RabbitMQ
```

Essa sequência apresenta um **dual-write** sem garantia atômica: se a publicação do evento falhar após a persistência (ou o processo morrer nesse intervalo), o estado no banco fica inconsistente com o que o restante do sistema espera, e o evento se perde silenciosamente.

### Problema observado

O `ProcessPaymentUseCase` emitia até três eventos (`payment.initiated`, `payment.completed/failed`) via `ClientProxy.emit()` após salvar a entidade. O mesmo padrão estava presente em `CreateOrderUseCase` e `UpdateOrderStatusUseCase`.

---

## Decisão

Adotar o **Outbox Pattern** (padrão de caixa de saída transacional) em `order-service` e `payment-service`.

### Funcionamento

1. O use case chama `saveWithOutbox(entity, outboxEntry)` no repositório.
2. O repositório executa uma única transação de banco de dados:
    - Persiste a entidade de domínio (`orders` / `payments`).
    - Insere uma linha na tabela `outbox` com status `PENDING`.
3. Um `OutboxProcessor` independente faz polling a cada 5 s na tabela `outbox`.
4. Para cada registro `PENDING`, o processor publica o evento via `ClientProxy.emit()` e marca o registro como `PUBLISHED`.
5. Em caso de falha na publicação, o `attempts` é incrementado. Após `MAX_ATTEMPTS = 5` falhas, o status passa a `FAILED` e o erro é registrado em log de nível ERROR.

### Estrutura da tabela `outbox`

| Coluna         | Tipo      | Descrição                                  |
| -------------- | --------- | ------------------------------------------ |
| `id`           | uuid PK   | Identificador único do registro            |
| `event_type`   | varchar   | Nome do evento (ex: `payment.completed`)   |
| `payload`      | jsonb     | Payload completo do evento                 |
| `status`       | varchar   | `PENDING` → `PUBLISHED` \| `FAILED`        |
| `attempts`     | int       | Número de tentativas de publicação         |
| `last_error`   | text      | Mensagem do último erro (nullable)         |
| `created_at`   | timestamp | Data de inserção                           |
| `published_at` | timestamp | Data de publicação bem-sucedida (nullable) |

---

## Alternativas consideradas

### A — Fire-and-forget (status quo)

`ClientProxy.emit()` chamado diretamente no use case, após o `save`. Simples, porém sem garantia de durabilidade. Rejeitado pela possibilidade de perda silent de eventos.

### B — Saga com compensação

Implementar sagas para desfazer o estado em caso de falha na publicação do evento. Complexidade operacional significativamente maior para o ganho equivalente. Rejeitado para a fase atual.

### C — Change Data Capture (CDC) com Debezium

Capturar mudanças de WAL do PostgreSQL e alimentar o Kafka/RabbitMQ diretamente. Solução robusta, mas requer Kafka e Debezium como dependências de infraestrutura, aumentando a complexidade do ambiente. Reservado para escala futura.

### D — Outbox Pattern (escolhida)

Atomic write no banco + background processor. Implementação simples, sem novas dependências de infra, compatível com o TypeORM e PostgreSQL já em uso. Aceito.

---

## Consequências

### Positivas

- **Atomicidade garantida:** entidade e evento escritos na mesma transação de banco.
- **Resiliência a falhas parciais:** se o processo morrer antes de publicar, o processor retomará na próxima inicialização.
- **Observabilidade:** métricas (`eventPublishedTotal`) e logs estruturados em cada etapa.
- **Idempotência:** os use cases agora verificam o estado atual antes de processar (`if (order.status === CONFIRMED) return`), evitando re-processamento.

### Negativas / Trade-offs

- **Latência adicional:** eventos são publicados com até 5 s de atraso (intervalo de polling).
- **Polling constante:** query SQL a cada 5 s em ambos os serviços (impacto mínimo com índice em `status`).
- **Consistência eventual:** consumidores devem tolerar a pequena janela de delay após a gravação no banco.
- **Sem DLQ automatizada:** eventos com status `FAILED` requerem intervenção manual ou futura automação de reenvio.

---

## Arquivos modificados

| Arquivo                                                                   | Alteração                                   |
| ------------------------------------------------------------------------- | ------------------------------------------- |
| `apps/*/src/infrastructure/database/entities/outbox.entity.ts`            | Nova entidade TypeORM                       |
| `apps/*/src/infrastructure/messaging/outbox.processor.ts`                 | Novo processor de polling                   |
| `apps/*/src/domain/repositories/*.repository.interface.ts`                | Interface `saveWithOutbox`                  |
| `apps/*/src/infrastructure/database/repositories/typeorm-*.repository.ts` | Implementação transacional                  |
| `apps/*/src/application/use-cases/*.use-case.ts`                          | Refatoração — remove `ClientProxy`          |
| `apps/*/src/*.module.ts`                                                  | Registra `OutboxEntity` e `OutboxProcessor` |
| `apps/*/src/infrastructure/database/data-source.ts`                       | Adiciona `OutboxEntity`                     |
