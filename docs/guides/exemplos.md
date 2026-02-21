# Exemplos Práticos de Uso

## 🔐 Autenticação

**IMPORTANTE:** Todos os endpoints (exceto /auth/*) agora requerem autenticação JWT!

### Como autenticar:

1. **Registrar ou fazer login** em `/auth/register` ou `/auth/login`
2. **Copiar o accessToken** da resposta
3. **Incluir o token** nas requisições:
   - Header: `Authorization: Bearer SEU_TOKEN_AQUI`
   - Ou usar Swagger UI e clicar em **Authorize**

## 🎯 Cenários de Teste Completos

### Cenário 1: Fluxo Completo com Pagamento Automático (Event-Driven) 🆕

Este é o fluxo principal que demonstra a arquitetura event-driven com o Payment Service:

```bash
# 1. Registrar usuário e obter token
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@email.com",
    "password": "maria123"
  }')

USER_ID=$(echo $AUTH_RESPONSE | jq -r '.user.id')
ACCESS_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.accessToken')
echo "Usuário criado: $USER_ID"
echo "Token: $ACCESS_TOKEN"

# 2. Criar pedido
echo "
Criando pedido..."
ORDER=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"items\": [
      {
        \"productId\": \"notebook-dell-i7\",
        \"quantity\": 1,
        \"price\": 4500.00
      },
      {
        \"productId\": \"mouse-wireless\",
        \"quantity\": 1,
        \"price\": 120.00
      }
    ]
  }")

ORDER_ID=$(echo $ORDER | jq -r '.id')
TOTAL_AMOUNT=$(echo $ORDER | jq -r '.totalAmount')
echo "Pedido criado: $ORDER_ID"
echo "Total: R$ $TOTAL_AMOUNT"
echo "Status inicial: PENDING"

# 3. Aguardar processamento automático do pagamento (evento order.created.accepted)
echo "
Aguardando processamento do pagamento (via eventos RabbitMQ)..."
sleep 3

# 4. Verificar pagamento criado automaticamente
echo "
Buscando pagamento do pedido..."
PAYMENT=$(curl -s http://localhost:3000/payments/order/$ORDER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN")

PAYMENT_ID=$(echo $PAYMENT | jq -r '.id')
PAYMENT_STATUS=$(echo $PAYMENT | jq -r '.status')
echo "Pagamento ID: $PAYMENT_ID"
echo "Status do pagamento: $PAYMENT_STATUS"

# 5. Verificar status do pedido (deve estar CONFIRMED se pagamento foi bem-sucedido)
echo "
Verificando status do pedido após pagamento..."
ORDER_STATUS=$(curl -s http://localhost:3000/orders/$ORDER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.status')
echo "Status do pedido: $ORDER_STATUS"

if [ "$ORDER_STATUS" = "CONFIRMED" ]; then
  echo "✓ Pagamento aprovado! Pedido confirmado automaticamente."

  # 6. Continuar com o fluxo de envio e entrega
  echo "
Enviando pedido..."
  curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/ship \
    -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null
  echo "✓ Pedido enviado!"

  echo "
Entregando pedido..."
  sleep 1
  curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/deliver \
    -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null
  echo "✓ Pedido entregue!"

elif [ "$ORDER_STATUS" = "CANCELLED" ]; then
  echo "✗ Pagamento recusado. Pedido cancelado automaticamente."
else
  echo "⏳ Pedido ainda em processamento..."
fi

# 7. Ver histórico de pagamentos do usuário
echo "
Histórico de pagamentos do usuário:"
curl -s http://localhost:3000/payments/user/$USER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### Cenário 2: E-commerce Básico

#### 0. Configurar autenticação (NOVO)

```bash
# Registrar e obter token
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "admin@email.com",
    "password": "admin123"
  }')

ACCESS_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.accessToken')
echo "Access Token: $ACCESS_TOKEN"

# Definir função auxiliar para requisições autenticadas
auth_curl() {
  curl "$@" -H "Authorization: Bearer $ACCESS_TOKEN"
}
```

#### 1. Criar múltiplos usuários

```bash
# Usuário 1
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ana Silva",
    "email": "ana@email.com",
    "password": "ana123"
  }'

# Usuário 2
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Carlos Santos",
    "email": "carlos@email.com",
    "password": "carlos123"
  }'

# Usuário 3
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Beatriz Costa",
    "email": "beatriz@email.com",
    "password": "beatriz123"
  }'
```

#### 2. Listar todos os usuários (requer token)

```bash
auth_curl -s http://localhost:3000/users | jq
# Ou sem a função auxiliar:
curl -s http://localhost:3000/users \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

#### 3. Criar pedidos para diferentes usuários (com autenticação)

```bash
# Pedido da Ana (Eletrônicos)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "userId": "ID_DA_ANA",
    "items": [
      {
        "productId": "notebook-dell-inspiron",
        "quantity": 1,
        "price": 3500.00
      },
      {
        "productId": "mouse-logitech-mx",
        "quantity": 1,
        "price": 250.00
      },
      {
        "productId": "teclado-mecanico",
        "quantity": 1,
        "price": 450.00
      }
    ]
  }'

# Pedido do Carlos (Livros)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "userId": "ID_DO_CARLOS",
    "items": [
      {
        "productId": "clean-code-book",
        "quantity": 1,
        "price": 85.00
      },
      {
        "productId": "design-patterns-book",
        "quantity": 1,
        "price": 95.00
      }
    ]
  }'

# Pedido da Beatriz (Roupas)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "userId": "ID_DA_BEATRIZ",
    "items": [
      {
        "productId": "camisa-polo-azul",
        "quantity": 2,
        "price": 89.90
      },
      {
        "productId": "calca-jeans",
        "quantity": 1,
        "price": 159.90
      },
      {
        "productId": "tenis-esportivo",
        "quantity": 1,
        "price": 299.00
      }
    ]
  }'
```

### Cenário 2: Fluxo Completo de Pedido (com JWT)

```bash
# 1. Registrar usuário e obter token
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Pedro",
    "email": "joao.pedro@email.com",
    "password": "joao123"
  }')

USER_ID=$(echo $AUTH_RESPONSE | jq -r '.user.id')
ACCESS_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.accessToken')
echo "Usuário criado: $USER_ID"
echo "Token: $ACCESS_TOKEN"

# 2. Criar pedido (com autenticação)
ORDER=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"items\": [
      {
        \"productId\": \"smartphone-samsung-s23\",
        \"quantity\": 1,
        \"price\": 2999.00
      },
      {
        \"productId\": \"capinha-silicone\",
        \"quantity\": 1,
        \"price\": 49.90
      },
      {
        \"productId\": \"pelicula-vidro\",
        \"quantity\": 2,
        \"price\": 29.90
      }
    ]
  }")

ORDER_ID=$(echo $ORDER | jq -r '.id')
echo "Pedido criado: $ORDER_ID"
echo "Total: R$ $(echo $ORDER | jq -r '.totalAmount')"

# 3. Verificar pedido criado (status PENDING)
curl -s http://localhost:3000/orders/$ORDER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

# 4. Confirmar pedido
echo "
Confirmando pedido..."
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/confirm \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

# 5. Enviar pedido
echo "
Enviando pedido..."
sleep 2
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/ship \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

# 6. Entregar pedido
echo "
Entregando pedido..."
sleep 2
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/deliver \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq

# 7. Verificar histórico de pedidos do usuário
echo "
Histórico de pedidos do usuário:"
curl -s http://localhost:3000/orders/user/$USER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq
```

### Cenário 3: Validação de Regras de Negócio

#### Testar transições inválidas de status

```bash
# 1. Criar pedido
ORDER=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "userId": "USER_ID_AQUI",
    "items": [
      {
        "productId": "produto-teste",
        "quantity": 1,
        "price": 100.00
      }
    ]
  }')

ORDER_ID=$(echo $ORDER | jq -r '.id')

# 2. Tentar enviar sem confirmar (deve dar erro)
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/ship \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# Erro esperado: "Only confirmed orders can be shipped"

# 3. Confirmar e entregar
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/confirm \
  -H "Authorization: Bearer $ACCESS_TOKEN"
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/ship \
  -H "Authorization: Bearer $ACCESS_TOKEN"
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/deliver \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 4. Tentar cancelar pedido entregue (deve dar erro)
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/cancel \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# Erro esperado: "Delivered orders cannot be cancelled"
```

#### Testar validação de email único

```bash
# 1. Criar primeiro usuário
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Primeiro User",
    "email": "mesmo@email.com",
    "password": "senha123"
  }'

# 2. Tentar criar com mesmo email (deve dar erro)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Segundo User",
    "email": "mesmo@email.com",
    "password": "outrasenha"
  }'
# Erro esperado: "User with this email already exists"
```

#### Testar acesso sem autenticação (401)

```bash
# Tentar listar usuários sem token
curl -X GET http://localhost:3000/users
# Erro esperado: 401 Unauthorized

# Tentar criar pedido sem token
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "qualquer-id",
    "items": []
  }'
# Erro esperado: 401 Unauthorized
```

### Cenário 4: Relatórios e Consultas (com autenticação)

#### Listar todos os pedidos e calcular estatísticas

```bash
# Obter todos os pedidos (com token)
ORDERS=$(curl -s http://localhost:3000/orders \
  -H "Authorization: Bearer $ACCESS_TOKEN")

# Contar total de pedidos
echo "Total de pedidos: $(echo $ORDERS | jq 'length')"

# Pedidos por status
echo "
Pedidos PENDING: $(echo $ORDERS | jq '[.[] | select(.status == "PENDING")] | length')"
echo "Pedidos CONFIRMED: $(echo $ORDERS | jq '[.[] | select(.status == "CONFIRMED")] | length')"
echo "Pedidos SHIPPED: $(echo $ORDERS | jq '[.[] | select(.status == "SHIPPED")] | length')"
echo "Pedidos DELIVERED: $(echo $ORDERS | jq '[.[] | select(.status == "DELIVERED")] | length')"
echo "Pedidos CANCELLED: $(echo $ORDERS | jq '[.[] | select(.status == "CANCELLED")] | length')"

# Soma total de vendas
echo "
Total de vendas: R$ $(echo $ORDERS | jq '[.[] | .totalAmount] | add')"

# Ticket médio
echo "Ticket médio: R$ $(echo $ORDERS | jq '[.[] | .totalAmount] | add / length')"
```

## 🧪 Scripts de Teste Automatizados

### Script completo de testes (com JWT)

```bash
#!/bin/bash

echo "==================================="
echo "Iniciando testes do E-commerce"
echo "==================================="

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para verificar sucesso
check_success() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $1${NC}"
  else
    echo -e "${RED}✗ $1 FALHOU${NC}"
    exit 1
  fi
}

# 1. Testar registro de usuário e obter token
echo "
1. Registrando usuário e obtendo token..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste User",
    "email": "teste@email.com",
    "password": "teste123"
  }')
check_success "Usuário registrado"

USER_ID=$(echo $AUTH_RESPONSE | jq -r '.user.id')
ACCESS_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.accessToken')
echo "   ID: $USER_ID"
echo "   Token obtido: ${ACCESS_TOKEN:0:20}..."

# 2. Testar busca de usuário (com autenticação)
echo "
2. Buscando usuário..."
curl -s http://localhost:3000/users/$USER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null
check_success "Usuário encontrado"

# 3. Testar criação de pedido (com autenticação)
echo "
3. Criando pedido..."
ORDER=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"items\": [
      {
        \"productId\": \"prod-1\",
        \"quantity\": 2,
        \"price\": 50.00
      }
    ]
  }")
check_success "Pedido criado"

ORDER_ID=$(echo $ORDER | jq -r '.id')
echo "   ID: $ORDER_ID"
echo "   Total: R$ $(echo $ORDER | jq -r '.totalAmount')"

# 4. Testar workflow do pedido
echo "
4. Testando workflow do pedido..."

echo "   Confirmando..."
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/confirm \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null
check_success "Pedido confirmado"

echo "   Enviando..."
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/ship \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null
check_success "Pedido enviado"

echo "   Entregando..."
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/deliver \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null
check_success "Pedido entregue"

# 5. Verificar status final
echo "
5. Verificando status final..."
FINAL_ORDER=$(curl -s http://localhost:3000/orders/$ORDER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN")
STATUS=$(echo $FINAL_ORDER | jq -r '.status')

if [ "$STATUS" = "DELIVERED" ]; then
  echo -e "${GREEN}✓ Status correto: $STATUS${NC}"
else
  echo -e "${RED}✗ Status incorreto: $STATUS${NC}"
  exit 1
fi

# 6. Testar acesso sem token (deve falhar com 401)
echo "
6. Testando segurança (acesso sem token)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/users)
if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Proteção JWT funcionando (401 Unauthorized)${NC}"
else
  echo -e "${RED}✗ Proteção JWT falhou (código: $HTTP_CODE)${NC}"
  exit 1
fi

echo "
==================================="
echo -e "${GREEN}Todos os testes passaram!${NC}"
echo "==================================="
```

Salve como `test-api.sh` e execute:

```bash
chmod +x test-api.sh
./test-api.sh
```

## 📊 Dados de Exemplo para Popular

```bash
# Registrar usuários e obter seus dados
echo "Registrando usuários..."

# Admin
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@ecommerce.com","password":"admin123"}' | jq

# Cliente 1
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Cliente 1","email":"cliente1@email.com","password":"cliente123"}' | jq

# Cliente 2
curl -s -X POST http://localhost:3000/auth/register \
  -H "Conregistrar usuário sem nome (deve dar erro 400)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sem-nome@email.com",
    "password": "senha123"
  }'

# Tentar registrar usuário com email inválido
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "email": "email-invalido",
    "password": "senha123"
  }'

# Tentar registrar usuário com senha curta
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "email": "teste@email.com",
    "password": "123"
  }'

# Tentar criar pedido com quantidade negativa (com token válido)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "userId": "algum-id",
    "items": [
      {
        "productId": "prod-1",
        "quantity": -5,
        "price": 100.00
      }
    ]
  }'

# Tentar fazer login com credenciais inválidas
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "naoexiste@email.com",
    "password": "senhaerrada"
  }'
# Erro esperado: 401 Unauthorized '{
    "name": "Teste",
    "email": "email-invalido",
    "password": "senha123"
  }'

# Tentar criar usuário com senha curta
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "email": "teste@email.com",
    "password": "123"
  }'

# Tentar criar pedido com quantidade negativa
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "algum-id",
    "items": [
      {
        "Swagger UI**: É a forma mais fácil de testar a API (http://localhost:3000/api/docs)
2. **Guarde seu access token**: Você precisará dele para todas as requisições protegidas
3. **Use jq para formatar JSON**: Adicione `| jq` no final dos comandos curl
4. **Salve IDs em variáveis**: Facilita testes subsequentes
5. **Use o histórico do bash**: Pressione ↑ para reutilizar comandos
6. **Teste um fluxo de cada vez**: Isola problemas mais facilmente
7. **Verifique os logs**: Os microserviços mostram logs úteis no console
8. **Renove tokens expirados**: Use `/auth/refresh` com o refreshToken
9. **Teste segurança**: Tente acessar endpoints sem token para confirmar proteção
10. **Use RabbitMQ UI**: Monitore mensagens em http://localhost:15672
  }'
```

## 💡 Dicas de Uso

1. **Use jq para formatar JSON**: Adicione `| jq` no final dos comandos curl
2. **Salve IDs em variáveis**: Facilita testes subsequentes
3. **Use o histórico do bash**: Pressione ↑ para reutilizar comandos
4. **Teste um fluxo de cada vez**: Isola problemas mais facilmente
5. **Verifique os logs**: Os microserviços mostram logs úteis no console
