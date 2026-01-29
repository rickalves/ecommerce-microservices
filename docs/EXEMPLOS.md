# Exemplos Práticos de Uso

## 🎯 Cenários de Teste Completos

### Cenário 1: E-commerce Básico

#### 1. Criar múltiplos usuários
```bash
# Usuário 1
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ana Silva",
    "email": "ana@email.com",
    "password": "ana123"
  }'

# Usuário 2
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Carlos Santos",
    "email": "carlos@email.com",
    "password": "carlos123"
  }'

# Usuário 3
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Beatriz Costa",
    "email": "beatriz@email.com",
    "password": "beatriz123"
  }'
```

#### 2. Listar todos os usuários
```bash
curl http://localhost:3000/users | jq
```

#### 3. Criar pedidos para diferentes usuários
```bash
# Pedido da Ana (Eletrônicos)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
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

### Cenário 2: Fluxo Completo de Pedido

```bash
# 1. Criar usuário
USER=$(curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Pedro",
    "email": "joao.pedro@email.com",
    "password": "joao123"
  }')

USER_ID=$(echo $USER | jq -r '.id')
echo "Usuário criado: $USER_ID"

# 2. Criar pedido
ORDER=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
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
curl -s http://localhost:3000/orders/$ORDER_ID | jq

# 4. Confirmar pedido
echo "
Confirmando pedido..."
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/confirm | jq

# 5. Enviar pedido
echo "
Enviando pedido..."
sleep 2
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/ship | jq

# 6. Entregar pedido
echo "
Entregando pedido..."
sleep 2
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/deliver | jq

# 7. Verificar histórico de pedidos do usuário
echo "
Histórico de pedidos do usuário:"
curl -s http://localhost:3000/orders/user/$USER_ID | jq
```

### Cenário 3: Validação de Regras de Negócio

#### Testar transições inválidas de status
```bash
# 1. Criar pedido
ORDER=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
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
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/ship
# Erro esperado: "Only confirmed orders can be shipped"

# 3. Confirmar e entregar
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/confirm
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/ship
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/deliver

# 4. Tentar cancelar pedido entregue (deve dar erro)
curl -X PATCH http://localhost:3000/orders/$ORDER_ID/cancel
# Erro esperado: "Delivered orders cannot be cancelled"
```

#### Testar validação de email único
```bash
# 1. Criar primeiro usuário
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Primeiro User",
    "email": "mesmo@email.com",
    "password": "senha123"
  }'

# 2. Tentar criar com mesmo email (deve dar erro)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Segundo User",
    "email": "mesmo@email.com",
    "password": "outrasenha"
  }'
# Erro esperado: "User with this email already exists"
```

### Cenário 4: Relatórios e Consultas

#### Listar todos os pedidos e calcular estatísticas
```bash
# Obter todos os pedidos
ORDERS=$(curl -s http://localhost:3000/orders)

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

### Script completo de testes
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

# 1. Testar criação de usuário
echo "
1. Criando usuário..."
USER=$(curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste User",
    "email": "teste@email.com",
    "password": "teste123"
  }')
check_success "Usuário criado"

USER_ID=$(echo $USER | jq -r '.id')
echo "   ID: $USER_ID"

# 2. Testar busca de usuário
echo "
2. Buscando usuário..."
curl -s http://localhost:3000/users/$USER_ID > /dev/null
check_success "Usuário encontrado"

# 3. Testar criação de pedido
echo "
3. Criando pedido..."
ORDER=$(curl -s -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
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
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/confirm > /dev/null
check_success "Pedido confirmado"

echo "   Enviando..."
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/ship > /dev/null
check_success "Pedido enviado"

echo "   Entregando..."
curl -s -X PATCH http://localhost:3000/orders/$ORDER_ID/deliver > /dev/null
check_success "Pedido entregue"

# 5. Verificar status final
echo "
5. Verificando status final..."
FINAL_ORDER=$(curl -s http://localhost:3000/orders/$ORDER_ID)
STATUS=$(echo $FINAL_ORDER | jq -r '.status')

if [ "$STATUS" = "DELIVERED" ]; then
  echo -e "${GREEN}✓ Status correto: $STATUS${NC}"
else
  echo -e "${RED}✗ Status incorreto: $STATUS${NC}"
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
# Popular banco com dados de exemplo
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"Admin","email":"admin@ecommerce.com","password":"admin123"}'
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"Cliente 1","email":"cliente1@email.com","password":"cliente123"}'
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"Cliente 2","email":"cliente2@email.com","password":"cliente123"}'
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"Cliente 3","email":"cliente3@email.com","password":"cliente123"}'

# Listar usuários e pegar IDs
curl http://localhost:3000/users | jq '.[] | {id, name, email}'
```

## 🐛 Testes de Validação

### Validação de DTOs
```bash
# Tentar criar usuário sem nome (deve dar erro 400)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sem-nome@email.com",
    "password": "senha123"
  }'

# Tentar criar usuário com email inválido
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
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
        "productId": "prod-1",
        "quantity": -5,
        "price": 100.00
      }
    ]
  }'
```

## 💡 Dicas de Uso

1. **Use jq para formatar JSON**: Adicione `| jq` no final dos comandos curl
2. **Salve IDs em variáveis**: Facilita testes subsequentes
3. **Use o histórico do bash**: Pressione ↑ para reutilizar comandos
4. **Teste um fluxo de cada vez**: Isola problemas mais facilmente
5. **Verifique os logs**: Os microserviços mostram logs úteis no console
