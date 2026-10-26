const environment = String(process.env.ASAAS_ENVIRONMENT || 'sandbox').toLowerCase();
const apiKey = process.env.ASAAS_API_KEY?.trim();
const url = process.env.ASAAS_WEBHOOK_URL?.trim();
const authToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
const email = process.env.ASAAS_WEBHOOK_EMAIL?.trim();

if (!apiKey || !url || !authToken || !email) {
  throw new Error('Defina ASAAS_API_KEY, ASAAS_WEBHOOK_URL, ASAAS_WEBHOOK_TOKEN e ASAAS_WEBHOOK_EMAIL.');
}
if (authToken.length < 32 || authToken.length > 255 || /\s/.test(authToken)) {
  throw new Error('ASAAS_WEBHOOK_TOKEN deve ter entre 32 e 255 caracteres e não pode conter espaços.');
}
if (!url.startsWith('https://')) throw new Error('ASAAS_WEBHOOK_URL deve usar HTTPS.');

const baseUrl = environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
const response = await fetch(`${baseUrl}/webhooks`, {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Clareia/1.0',
    access_token: apiKey,
  },
  body: JSON.stringify({
    name: 'Clareia · assinaturas',
    url,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken,
    sendType: 'SEQUENTIALLY',
    events: [
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_REFUNDED',
      'PAYMENT_DELETED',
      'PAYMENT_CHARGEBACK_REQUESTED',
      'PAYMENT_CHARGEBACK_DISPUTE',
      'SUBSCRIPTION_DELETED',
      'SUBSCRIPTION_INACTIVATED',
    ],
  }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(`Asaas recusou o cadastro do webhook (HTTP ${response.status}).`);
console.log(`Webhook configurado com sucesso: ${result.id || 'identificador não informado'}`);
