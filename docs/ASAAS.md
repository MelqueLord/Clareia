# Integração Asaas do Clareia

## Fluxo preparado

1. O cliente escolhe o plano PF ou MEI e informa CPF/CNPJ.
2. O servidor localiza ou cria o cliente na Asaas usando `externalReference`.
3. O servidor cria uma assinatura mensal e devolve a URL segura da fatura hospedada pela Asaas.
4. O navegador abre a página da Asaas. O Clareia não recebe dados do cartão.
5. A Asaas envia eventos para `POST /api/webhooks/asaas`.
6. O webhook valida `asaas-access-token`, evita eventos duplicados e atualiza o acesso.

Sem as variáveis da Asaas, o pedido continua no modo manual existente. Isso permite publicar o código antes de ativar cobranças reais.

## Variáveis necessárias

Use o Sandbox primeiro. Nunca coloque os valores reais no Git.

| Variável | Exemplo | Uso |
| --- | --- | --- |
| `ASAAS_ENVIRONMENT` | `sandbox` | `sandbox` ou `production` |
| `ASAAS_API_KEY` | chave do ambiente | Autentica chamadas do servidor |
| `ASAAS_WEBHOOK_TOKEN` | segredo aleatório com 32+ caracteres | Valida notificações recebidas |
| `ASAAS_RETURN_URL` | `https://seudominio.com/?billing=return` | Retorno após o pagamento |
| `ASAAS_PF_PRICE_CENTS` | `1990` | Preço mensal PF em centavos |
| `ASAAS_MEI_PRICE_CENTS` | `2990` | Preço mensal MEI em centavos |

Para cadastrar o webhook automaticamente, também defina temporariamente:

- `ASAAS_WEBHOOK_URL=https://seudominio.com/api/webhooks/asaas`
- `ASAAS_WEBHOOK_EMAIL=seu-email-de-alertas`

Depois execute `node scripts/setup-asaas-webhook.mjs`. O script não grava a chave nem o token.

## Banco de dados

Aplique `drizzle/0008_tense_leopardon.sql` antes de ativar a integração. A migração adiciona os IDs do cliente e da cobrança e cria uma tabela de eventos idempotentes.

## Homologação mínima

- Criar conta separada no Sandbox.
- Criar assinatura PF e MEI com dados próprios ou autorizados.
- Confirmar que a fatura abre no domínio da Asaas.
- Simular pagamento e conferir a mudança para `active`.
- Reenviar o mesmo evento e confirmar que o período não é duplicado.
- Simular atraso, estorno e cancelamento.
- Repetir a jornada em produção com uma cobrança controlada antes de abrir para clientes.

## Segurança

- A chave da API só é lida no servidor.
- O token do webhook deve ser diferente da chave da API.
- O endpoint exige HTTPS em produção.
- O app não armazena número do cartão, validade ou CVV.
- O ID do evento da Asaas é usado como chave de idempotência.
