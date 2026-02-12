[TITLE]
Skill: Observabilidade para Microserviços com Eventos

[OBJECTIVE]
Garantir rastreabilidade end-to-end.

[REQUIREMENTS]
- correlationId em todo request e mensagem
- logs estruturados (JSON)
- traces propagados (W3C traceparent quando possível)
- métricas de filas e consumidores

[DELIVER]
- Campos padrão de log
- Convenção de spans
- Métricas recomendadas (consumer_lag, retries, dlq_count, processing_time)
- Alertas (SLOs)
