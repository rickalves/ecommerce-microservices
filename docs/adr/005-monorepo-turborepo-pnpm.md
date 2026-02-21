# ADR 005: Estrutura Monorepo com Turborepo e pnpm Workspaces

**Data:** 2026-02-21
**Status:** Aceito
**Contexto:** Estratégia de repositório para gerenciar múltiplos microserviços e pacotes compartilhados

---

## Contexto

O projeto possui 4 microserviços (`api-gateway`, `user-service`, `order-service`, `payment-service`) e 3 pacotes compartilhados (`@ecommerce/shared`, `@ecommerce/observability`, `@ecommerce/typescript-config`). Precisamos escolher uma estratégia que equilibre independência de serviços com reutilização de código e operação eficiente.

### Opções consideradas

1. **Monorepo com Turborepo + pnpm workspaces**
2. **Polyrepo** (repositório separado por serviço)
3. **Monorepo com Nx**
4. **Monorepo com Lerna**

---

## Decisão

Adotar **Turborepo + pnpm workspaces** como solução de monorepo.

### Estrutura adotada

```
ecommerce-microservices/
├── apps/                        # Serviços deployáveis
│   ├── api-gateway/
│   ├── user-service/
│   ├── order-service/
│   └── payment-service/
├── packages/                    # Pacotes compartilhados internos
│   ├── shared/                  # DTOs, interfaces, tipos (@ecommerce/shared)
│   ├── observability/           # Logging, tracing, health (@ecommerce/observability)
│   └── typescript-config/       # tsconfig base (@ecommerce/typescript-config)
├── turbo.json                   # Pipeline de tasks do Turborepo
├── pnpm-workspace.yaml          # Definição dos workspaces
└── package.json                 # Scripts raiz
```

### Configuração do Turborepo (`turbo.json`)

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

**`^build`** garante que `packages/` são buildados antes dos `apps/` que os consomem.

### pnpm workspaces (`pnpm-workspace.yaml`)

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Referência entre pacotes

```json
// apps/order-service/package.json
{
  "dependencies": {
    "@ecommerce/shared": "workspace:*",
    "@ecommerce/observability": "workspace:*"
  }
}
```

---

## Alternativas consideradas

### 1. Polyrepo (repositório por serviço)
- **Prós:** Total independência de deploy e ciclo de vida, sem acoplamento de build
- **Contras:** Duplicação de configurações (ESLint, TypeScript, CI), dificuldade para manter pacotes compartilhados sincronizados, overhead de PRs cross-repo para mudanças que afetam múltiplos serviços
- **Decisão:** Rejeitado — o custo operacional não compensa no estágio atual do projeto

### 2. Nx
- **Prós:** Recursos avançados (affected builds, dependency graph visual, code generators)
- **Contras:** Curva de aprendizado elevada, configuração verbosa, opinionated demais para o porte do projeto
- **Decisão:** Rejeitado — Turborepo oferece 80% dos benefícios com 20% da complexidade

### 3. Lerna
- **Prós:** Maduro, bem documentado, amplamente usado
- **Contras:** Historicamente lento sem cache nativo, mantido por Nx (que introduz acoplamento), pnpm já resolve o problema de hoisting
- **Decisão:** Rejeitado — Turborepo é mais moderno e performático

### 4. Yarn Workspaces + sem pipeline runner
- **Prós:** Simples, sem dependências extras
- **Contras:** Sem cache de build, sem orquestração de dependências entre tasks, execução sequencial
- **Decisão:** Rejeitado — sem cache o build seria significativamente mais lento

---

## Consequências

### Positivas
- **Build incremental:** Turborepo cacheia outputs por hash de input — rebuild só do que mudou
- **Execução paralela:** Tasks independentes rodam em paralelo automaticamente
- **Pacotes internos com `workspace:*`:** Mudanças em `@ecommerce/shared` são refletidas imediatamente nos consumidores sem publicar em npm
- **CI unificado:** Um único workflow valida todo o monorepo com `turbo run test build lint`
- **Configurações centralizadas:** TypeScript base, ESLint e Prettier definidos uma vez

### Negativas / Trade-offs
- **Deploy acoplado:** Um único repositório implica que todos os serviços são versionados juntos no git (mitigado com tags e pipelines de CI que fazem deploy seletivo por `affected`)
- **node_modules compartilhado:** Pode causar conflitos de versão em edge cases (mitigado pelo hoisting inteligente do pnpm)
- **Tempo de checkout/clone:** Cresce com o tempo conforme o repositório acumula histórico de todos os serviços

---

## Referências

- [Turborepo documentation](https://turbo.build/repo/docs)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [Monorepo vs Polyrepo — comparativo](https://monorepo.tools/)
