# Outbox Pattern — Arquitetura e Implementação

## Visão Geral

O **Outbox Pattern** (padrão de caixa de saída transacional) foi implementado no `order-service` e no `payment-service` para eliminar o risco de perda silenciosa de eventos causado pelo **dual-write**: persisir a entidade no banco e depois publicar o evento no broker como duas operações independentes e não atômicas.

---

## Problema que resolve

```
❌ ANTES (dual-write sem garantia)

UseCase:
  1. repository.save(entity)           ← grava no PostgreSQL ✓
  2. eventBus.emit(eventType, payload) ← publica no RabbitMQ
                                         ↑ se falhar aqui, evento se perde!
```

```
✓ DEPOIS (Outbox Pattern)

UseCase:
  1. repository.saveWithOutbox(entity, { eventType, payload })
     └── manager.transaction():
           a. em.save(DomainEntity)   ← mesma transação
           b. em.save(OutboxEntity)   ← mesma transação
                                         se qualquer um falhar → rollback total

OutboxProcessor (background):
  2. a cada 5 s: SELECT * FROM outbox WHERE status = 'PENDING'
  3. eventBus.emit(record.eventType, record.payload)
  4. UPDATE outbox SET status = 'PUBLISHED', published_at = now()
```

---

## Componentes

### `OutboxEntity`

Localização: `apps/{order,payment}-service/src/infrastructure/database/entities/outbox.entity.ts`

```
┌─────────────────────────────────────────────────┐
│                   outbox                        │
├─────────────────┬───────────┬───────────────────┤
│ id              │ uuid PK   │ auto-gerado        │
│ event_type      │ varchar   │ ex: payment.completed │
│ payload         │ jsonb     │ payload completo   │
│ status          │ varchar   │ PENDING|PUBLISHED|FAILED │
│ attempts        │ int       │ padrão: 0          │
│ last_error      │ text?     │ mensagem do erro   │
│ created_at      │ timestamp │ auto (CreateDateColumn) │
│ published_at    │ timestamp?│ quando publicado   │
└─────────────────┴───────────┴───────────────────┘
                          ▲
              índice em `status` para polling eficiente
```

A tabela é criada automaticamente via `synchronize: true` do TypeORM na inicialização.

---

### `saveWithOutbox(entity, outboxEntry)`

Localização: `apps/{order,payment}-service/src/infrastructure/database/repositories/typeorm-*.repository.ts`

Executa a escrita da entidade e a inserção no outbox em uma **única transação** usando `manager.transaction()`:

```typescript
async saveWithOutbox(entity: DomainEntity, outbox: OutboxEntry): Promise<DomainEntity> {
  return this.repository.manager.transaction(async (em) => {
    const saved = await em.save(TypeOrmEntity, toOrmEntity(entity));
    await em.save(OutboxEntity, {
      eventType: outbox.eventType,
      payload:   outbox.payload,
      status:    'PENDING',
    });
    return toDomainEntity(saved);
  });
}
```

---

### `OutboxProcessor`

Localização: `apps/{order,payment}-service/src/infrastructure/messaging/outbox.processor.ts`

Componente NestJS marcado como `@Injectable()` que implementa `OnModuleInit` e `OnModuleDestroy`.

#### Ciclo de vida

```
onModuleInit():
  └── poll() imediato
  └── setInterval(poll, 5000ms)

onModuleDestroy():
  └── clearInterval()

poll():
  1. SELECT FROM outbox WHERE status='PENDING' ORDER BY created_at ASC LIMIT 50
  2. Para cada registro:
     a. eventBus.emit(eventType, payload)
     b. UPDATE status='PUBLISHED', published_at=now()
     c. metrics.eventPublishedTotal.inc({ event_type })
     d. logger.debug('Outbox event published', { outboxId, eventType })
  3. Em caso de erro na publicação:
     a. attempts++
     b. Se attempts >= MAX_ATTEMPTS (5): status='FAILED'
     c. Senão: mantém status='PENDING' para retry
     d. Salva lastError
     e. Se FAILED: logger.error(...)
```

#### Parâmetros configuráveis (constantes no arquivo)

| Parâmetro         | Valor padrão | Descrição                            |
| ----------------- | ------------ | ------------------------------------ |
| `POLL_INTERVAL_MS`| 5000         | Intervalo entre ciclos de polling    |
| `BATCH_SIZE`      | 50           | Máximo de registros por ciclo        |
| `MAX_ATTEMPTS`    | 5            | Tentativas antes de marcar `FAILED`  |

---

## Fluxo de Estado

```
Inserção         Processamento bem-sucedido
PENDING ──────────────────────────────────► PUBLISHED
   │
   │ erro na publicação (attempts < MAX_ATTEMPTS)
   └──────────────────────────────────────► PENDING (retry)
   │
   │ erro na publicação (attempts >= MAX_ATTEMPTS)
   └──────────────────────────────────────► FAILED
```

---

## Eventos Cobertos

### order-service

| Evento                  | Use Case                   |
| ----------------------- | -------------------------- |
| `order.created.accepted`| `CreateOrderUseCase`       |
| `order.cancelled`       | `UpdateOrderStatusUseCase` |

### payment-service

| Evento               | Use Case                  |
| -------------------- | ------------------------- |
| `payment.initiated`  | `ProcessPaymentUseCase`   |
| `payment.completed`  | `ProcessPaymentUseCase`   |
| `payment.failed`     | `ProcessPaymentUseCase`   |

---

## Idempotência nos Consumidores

`UpdateOrderStatusUseCase` (order-service) foi atualizado com verificações de estado antes de processar:

```typescript
async confirmOrder(orderId: string): Promise<Order> {
  const order = await this.orderRepository.findById(orderId);
  if (order.status === OrderStatus.CONFIRMED) return order; // idempotente
  // ...
}

async cancelOrder(orderId: string): Promise<Order> {
  const order = await this.orderRepository.findById(orderId);
  if (order.status === OrderStatus.CANCELLED) return order; // idempotente
  // ...
}
```

Isso garante que a re-entrega de um mesmo evento pelo broker não cause efeitos colaterais duplicados.

---

## Observabilidade

O `OutboxProcessor` integra-se ao stack OTel via:

- **Métrica:** `eventPublishedTotal` incrementada por `event_type` a cada publicação bem-sucedida (visível no Prometheus/Grafana).
- **Logs estruturados:** `debug` para publicações bem-sucedidas e `error` para falhas permanentes, ambos com `outboxId` e `eventType` como campos indexáveis no Loki.

---

## Verificação em Produção

```bash
# Listar últimas entradas do outbox no order-service
docker exec postgres-orders psql -U order_service -d orders_db \
  -c "SELECT event_type, status, attempts, created_at, published_at \
      FROM outbox ORDER BY created_at DESC LIMIT 20;"

# Listar últimas entradas do outbox no payment-service
docker exec postgres-payments psql -U payment_service -d payments_db \
  -c "SELECT event_type, status, attempts, created_at, published_at \
      FROM outbox ORDER BY created_at DESC LIMIT 20;"

# Verificar eventos com falha permanente
docker exec postgres-orders psql -U order_service -d orders_db \
  -c "SELECT id, event_type, attempts, last_error FROM outbox WHERE status = 'FAILED';"

# Ver logs do processor em tempo real
docker compose logs -f order-service | grep -i outbox
docker compose logs -f payment-service | grep -i outbox
```

---

## Referências

- [ADR 006 — Outbox Pattern para Garantia Transacional de Eventos](../adr/006-outbox-pattern-garantia-transacional.md)
- [Skill: Idempotência, Outbox e Tratamento de Falhas](../../ai/skills/skill-idempotency-outbox.md)
- [Arquitetura Geral do Sistema](./arquitetura.md)
