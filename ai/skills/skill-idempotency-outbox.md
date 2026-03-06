[TITLE]
Skill: Idempotência, Outbox e Tratamento de Falhas

[GOAL]
Desenhar a execução resiliente de produtores e consumidores em EDA.

[PRODUCER CHECKLIST]

- Outbox table (event_id, type, payload, status, created_at, published_at)
- Publicação assíncrona e reprocessável
- Transactional boundary (persistir mudança + outbox na mesma transação)
- Garantir schemaVersion e occurredAt

[CONSUMER CHECKLIST]

- Idempotency store (ex: tabela processed_messages)
- Chave idempotente: messageId/eventId
- Retry com backoff e limite
- DLQ com motivo do erro + payload + headers
- Handlers side-effect safe
- Observabilidade: logs estruturados + traceId

[OUTPUT FORMAT]

1. Desenho do fluxo
2. Tabelas/estruturas necessárias
3. Algoritmo do consumidor (passo a passo)
4. Política de retry/DLQ recomendada
