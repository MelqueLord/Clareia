import { env } from 'cloudflare:workers';

type AsaasList<T> = { data: T[]; hasMore?: boolean; totalCount?: number };
type AsaasCustomer = { id: string; externalReference?: string | null };
type AsaasSubscription = { id: string; customer: string; status?: string };
export type AsaasPayment = {
  id: string;
  status: string;
  invoiceUrl?: string | null;
  subscription?: string | null;
  externalReference?: string | null;
  dueDate?: string | null;
};

export type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
  subscription?: { id?: string; status?: string; externalReference?: string | null };
};

const DEFAULT_TIMEOUT_MS = 20_000;

function baseUrl() {
  return env.ASAAS_ENVIRONMENT?.trim().toLowerCase() === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';
}

export function asaasConfigured() {
  return Boolean(env.ASAAS_API_KEY?.trim() && env.ASAAS_WEBHOOK_TOKEN?.trim());
}

export function asaasPriceCents(space: 'pf' | 'mei') {
  const raw = Number(space === 'mei' ? env.ASAAS_MEI_PRICE_CENTS : env.ASAAS_PF_PRICE_CENTS);
  if (Number.isInteger(raw) && raw > 0 && raw <= 1_000_000) return raw;
  return space === 'mei' ? 2990 : 1990;
}

export function normalizeCpfCnpj(value: string) {
  return value.replace(/\D/g, '');
}

function repeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

function validCpf(value: string) {
  if (value.length !== 11 || repeatedDigits(value)) return false;
  for (let digit = 9; digit < 11; digit += 1) {
    let sum = 0;
    for (let index = 0; index < digit; index += 1) sum += Number(value[index]) * (digit + 1 - index);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(value[digit])) return false;
  }
  return true;
}

function validCnpj(value: string) {
  if (value.length !== 14 || repeatedDigits(value)) return false;
  const calculate = (length: number) => {
    let factor = length - 7;
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * factor--;
      if (factor < 2) factor = 9;
    }
    const result = 11 - (sum % 11);
    return result > 9 ? 0 : result;
  };
  return calculate(12) === Number(value[12]) && calculate(13) === Number(value[13]);
}

export function validCpfCnpj(value: string) {
  const digits = normalizeCpfCnpj(value);
  return validCpf(digits) || validCnpj(digits);
}

async function asaasRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = env.ASAAS_API_KEY?.trim();
  if (!apiKey) throw new Error('ASAAS_NOT_CONFIGURED');
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'User-Agent': 'Clareia/1.0',
      access_token: apiKey,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { errors?: Array<{ description?: string }> } | null;
    const description = payload?.errors?.map(item => item.description).filter(Boolean).join(' ') || '';
    throw new Error(`ASAAS_${response.status}${description ? `:${description.slice(0, 240)}` : ''}`);
  }
  return response.json() as Promise<T>;
}

export async function findOrCreateAsaasCustomer(input: {
  authUserId: string;
  name: string;
  email: string;
  cpfCnpj: string;
}) {
  const externalReference = `clareia:${input.authUserId}`;
  const found = await asaasRequest<AsaasList<AsaasCustomer>>(`/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`);
  if (found.data[0]?.id) return found.data[0];
  return asaasRequest<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: normalizeCpfCnpj(input.cpfCnpj),
      externalReference,
      notificationDisabled: false,
    }),
  });
}

function dateInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function createAsaasSubscription(input: {
  authUserId: string;
  customerId: string;
  space: 'pf' | 'mei';
  returnUrl: string;
}) {
  return asaasRequest<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: 'UNDEFINED',
      value: asaasPriceCents(input.space) / 100,
      nextDueDate: dateInSaoPaulo(),
      cycle: 'MONTHLY',
      description: input.space === 'mei' ? 'Clareia · Plano MEI' : 'Clareia · Plano Pessoa Física',
      externalReference: `clareia:${input.authUserId}`,
      callback: { successUrl: input.returnUrl, autoRedirect: true },
    }),
  });
}

export async function listAsaasSubscriptionPayments(subscriptionId: string) {
  return asaasRequest<AsaasList<AsaasPayment>>(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=20`);
}

export function safeAsaasInvoiceUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'asaas.com' || url.hostname.endsWith('.asaas.com')) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function webhookTokenIsValid(received: string | null) {
  const expected = env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!received || !expected) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}
