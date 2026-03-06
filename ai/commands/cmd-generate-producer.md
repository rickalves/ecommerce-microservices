Crie a estratégia de producer com Outbox:

- model da tabela outbox
- lógica transacional (mudança + outbox)
- publisher worker (polling ou listener)
- publicação no broker com headers (correlationId etc.)
- garantir reprocessamento seguro

Ação de negócio:
{DESCRICAO_DA_ACAO}
Evento gerado:
{EVENT_JSON_CONTRACT}
Banco: {DB}
Broker: {BROKER}
