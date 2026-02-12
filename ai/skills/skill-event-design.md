[TITLE]
Skill: Design de Eventos + Contratos EDA

[INPUT]
Fornecerei:
- Caso de uso / regra de negócio
- Quem publica (producer) e quem consome (consumers)
- Dados disponíveis no producer
- Restrições (LGPD, payload mínimo, etc.)

[TASK]
Você deve:
1) Sugerir nomes de eventos (passado) e comandos (imperativo)
2) Definir payload mínimo (evitar vazamento de domínio)
3) Definir metadata padrão (correlationId, causationId, occurredAt, schemaVersion)
4) Sugerir chave de idempotência
5) Indicar versionamento (quando necessário)
6) Indicar tópicos/rotas (routing key) para RabbitMQ (se aplicável)

[OUTPUT]
- Evento(s) sugerido(s)
- JSON de contrato
- Regras de compatibilidade (backward/forward)
- Checklist de validação
