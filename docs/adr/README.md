# Architecture Decision Records (ADR)

Este diretório contém os registros de decisões arquiteturais (ADRs) do projeto E-commerce Microservices.

## O que são ADRs?

Architecture Decision Records são documentos que capturam decisões arquiteturais importantes, incluindo:

- **Contexto:** Por que precisamos tomar essa decisão?
- **Decisão:** O que decidimos fazer?
- **Consequências:** Quais são os impactos (positivos e negativos)?
- **Alternativas:** O que mais consideramos e por que não escolhemos?

## Formato

Seguimos o formato MADR (Markdown Any Decision Records) adaptado:

```markdown
# ADR XXX: Título da Decisão

**Data:** YYYY-MM-DD
**Status:** Proposto | Aceito | Rejeitado | Depreciado | Substituído por ADR-YYY
**Autores:** Nome(s)
**Decisores:** Nome(s)

## Contexto
[Descreva o problema e por que uma decisão é necessária]

## Decisão
[Descreva a decisão tomada]

## Consequências
### Positivas
[Liste os benefícios]

### Negativas
[Liste os trade-offs e desafios]

## Alternativas Consideradas
[Liste outras opções avaliadas e por que foram rejeitadas]

## Referências
[Links, documentação relevante]
```

## Status de ADRs

- **Proposto:** ADR em revisão, aguardando aprovação
- **Aceito:** Decisão aprovada e em implementação/implementada
- **Rejeitado:** Proposta rejeitada (documento mantido para histórico)
- **Depreciado:** Decisão não é mais válida mas permanece por referência
- **Substituído:** Substituído por outra ADR (indicar qual)

## Nomenclatura

ADRs devem seguir o padrão:

```
NNN-titulo-descritivo-em-kebab-case.md
```

Exemplo: `001-observabilidade-arquitetura-event-driven.md`

## Processo de Criação

1. **Propor:** Criar ADR com status "Proposto"
2. **Revisar:** Equipe revisa e discute (pode usar PR reviews)
3. **Decidir:** Tech Lead aprova ou rejeita
4. **Implementar:** Se aceito, atualizar status e iniciar implementação
5. **Atualizar:** Documentar mudanças significativas na seção "Revisões"

## Quando Criar uma ADR?

Crie uma ADR quando:

- A decisão impacta múltiplos serviços/componentes
- A decisão é difícil de reverter
- A decisão envolve trade-offs significativos
- A decisão pode gerar debates na equipe
- A decisão define padrões ou convenções importantes

**Exemplos:**
- Escolha de stack de observabilidade
- Mudança de banco de dados
- Adoção de novos padrões arquiteturais
- Estratégias de deployment
- Políticas de versionamento de APIs/eventos

## Índice de ADRs

| # | Título | Status | Data |
|---|--------|--------|------|
| [001](./001-microservicos-eda-vs-arquitetura-em-camadas.md) | Microserviços com EDA vs Arquitetura em Camadas | Aceito | 2026-02-21 |
| [002](./002-observabilidade-arquitetura-event-driven.md) | Implementação de Observabilidade em Arquitetura Event-Driven | Proposto | 2026-02-11 |
| [003](./003-comunicacao-sincrona-vs-assincrona.md) | Comunicação Síncrona vs Assíncrona em Microserviços (CQRS simplificado) | Proposto | 2026-02-17 |
| [004](./004-autenticacao-jwt-api-gateway.md) | Autenticação JWT Centralizada no API Gateway | Aceito | 2026-02-21 |
| [005](./005-monorepo-turborepo-pnpm.md) | Estrutura Monorepo com Turborepo e pnpm Workspaces | Aceito | 2026-02-21 |
---

**Referências:**
- [ADR GitHub Organization](https://adr.github.io/)
- [MADR Template](https://adr.github.io/madr/)
- [When to Write an ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
