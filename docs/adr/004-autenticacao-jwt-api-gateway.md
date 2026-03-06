# ADR 004: Autenticação JWT Centralizada no API Gateway

**Data:** 2026-02-21
**Status:** Aceito
**Contexto:** Estratégia de autenticação e autorização em arquitetura de microserviços

---

## Contexto

O sistema possui 4 microserviços independentes. Cada serviço poderia autenticar requisições por conta própria, mas isso levaria a duplicação de lógica, inconsistência de regras e maior superfície de ataque. Precisamos definir onde e como a autenticação acontece.

### Situação antes da decisão

- Sem estratégia centralizada, cada serviço interno exposto teria que validar tokens
- Risco de divergência entre regras de autenticação por serviço
- Dificuldade para revogar tokens ou mudar a estratégia sem alterar múltiplos serviços

---

## Decisão

Autenticação JWT centralizada exclusivamente no **API Gateway**, usando `@nestjs/passport` com a estratégia `passport-jwt`.

### Arquitetura de tokens

| Token         | Duração    | Finalidade                  |
| ------------- | ---------- | --------------------------- |
| Access Token  | 15 minutos | Autenticação de requisições |
| Refresh Token | 7 dias     | Renovação do Access Token   |

### Fluxo de autenticação

```
Cliente → POST /auth/login → API Gateway
  → valida credenciais no User Service (HTTP)
  → assina Access Token + Refresh Token (RS256)
  → retorna tokens ao cliente

Cliente → GET /orders (com Bearer token) → API Gateway
  → JwtGuard valida assinatura e expiração localmente
  → extrai userId do payload
  → encaminha requisição ao Order Service com userId no header
  → Order Service confia no header (sem revalidação)
```

### Responsabilidades por camada

**API Gateway (autenticação):**

- Validação da assinatura e expiração do JWT
- Extração do `userId` e `roles` do payload
- Propagação via headers internos (`x-user-id`, `x-user-roles`)
- Endpoint `/auth/refresh` para renovação de tokens

**Serviços internos (autorização):**

- Confiam no header `x-user-id` propagado pelo Gateway
- Aplicam regras de negócio (ex: usuário só pode ver seus próprios pedidos)
- Não validam tokens JWT diretamente

### Implementação no API Gateway

```typescript
// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: configService.get('JWT_SECRET'),
        });
    }

    async validate(payload: JwtPayload) {
        return { userId: payload.sub, email: payload.email };
    }
}

// jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

---

## Alternativas consideradas

### 1. Sessões com Redis

- **Prós:** Revogação imediata, sem estado no token
- **Contras:** Dependência de Redis, latência adicional em toda requisição, complexidade operacional
- **Decisão:** Rejeitado — adiciona infraestrutura sem benefício proporcional para o estágio atual

### 2. OAuth2 / OIDC (ex: Keycloak)

- **Prós:** Padrão da indústria, SSO, delegação de identidade
- **Contras:** Overhead operacional alto, complexidade desproporcional para o projeto
- **Decisão:** Rejeitado para o estágio atual — pode ser adotado no futuro

### 3. Autenticação distribuída (cada serviço valida JWT)

- **Prós:** Gateway stateless sem concentrar responsabilidade
- **Contras:** Duplicação de lógica, risco de inconsistência, secret compartilhado entre serviços
- **Decisão:** Rejeitado — viola o princípio de responsabilidade única

### 4. Basic Auth

- **Prós:** Simples
- **Contras:** Credenciais em cada requisição, sem controle de sessão, não escalável
- **Decisão:** Rejeitado completamente

---

## Consequências

### Positivas

- Lógica de autenticação em um único lugar — fácil manutenção
- Serviços internos ficam simples e focados no domínio
- Mudança de estratégia de auth impacta somente o API Gateway
- Tokens stateless — sem consulta ao banco por requisição

### Negativas / Trade-offs

- API Gateway é o **Single Point of Failure** para autenticação
- Tokens Access não são revogáveis antes do vencimento (15 min)
    - Mitigação: Refresh Tokens de curta duração relativa + denylist no Redis (futuro)
- Serviços internos confiam implicitamente no Gateway — comunicação interna deve ser restringida por rede (Docker network)

---

## Referências

- [ADR 002 — Comunicação Síncrona vs Assíncrona](./002-comunicacao-sincrona-vs-assincrona.md)
- [NestJS Authentication docs](https://docs.nestjs.com/security/authentication)
- [RFC 7519 — JSON Web Token (JWT)](https://www.rfc-editor.org/rfc/rfc7519)
