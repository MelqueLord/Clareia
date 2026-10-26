import { env } from 'cloudflare:workers';
import { webhookTokenIsValid, type AsaasWebhookPayload } from '../../../../lib/asaas';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function paidUntil(now: number) {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() + 2);
  return date.getTime();
}

function userIdFromReference(value: string | null | undefined) {
  return value?.startsWith('clareia:') ? value.slice('clareia:'.length) : null;
}

export async function POST(req: Request) {
  if (!env.DB) return reply({ error: 'Banco indisponível.' }, 503);
  if (!req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'Conteúdo inválido.' }, 415);
  if (!await webhookTokenIsValid(req.headers.get('asaas-access-token'))) return reply({ error: 'Token inválido.' }, 401);

  const payload = await req.json().catch(() => null) as AsaasWebhookPayload | null;
  if (!payload?.id || !payload.event) return reply({ error: 'Evento inválido.' }, 400);

  const now = Date.now();
  const subscriptionId = payload.payment?.subscription || payload.subscription?.id || null;
  const paymentId = payload.payment?.id || null;
  await env.DB.prepare(`
    INSERT OR IGNORE INTO billing_events(id,event_type,provider_payment_id,provider_subscription_id,received_at)
    VALUES(?,?,?,?,?)
  `).bind(payload.id, payload.event, paymentId, subscriptionId, now).run();

  const event = await env.DB.prepare('SELECT processed_at FROM billing_events WHERE id=?')
    .bind(payload.id).first<{ processed_at: number | null }>();
  if (event?.processed_at) return reply({ ok: true, duplicate: true });

  const referenceUserId = userIdFromReference(payload.payment?.externalReference || payload.subscription?.externalReference);
  const account = subscriptionId
    ? await env.DB.prepare('SELECT user_id,billing_period_ends_at FROM account_access WHERE provider_subscription_id=?')
      .bind(subscriptionId).first<{ user_id: string; billing_period_ends_at: number | null }>()
    : referenceUserId
      ? await env.DB.prepare('SELECT user_id,billing_period_ends_at FROM account_access WHERE user_id=?')
        .bind(referenceUserId).first<{ user_id: string; billing_period_ends_at: number | null }>()
      : null;

  if (!account) return reply({ ok: true, matched: false });

  const paidEvents = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
  const overdueEvents = new Set(['PAYMENT_OVERDUE']);
  const canceledEvents = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_DELETED']);
  const subscriptionCanceledEvents = new Set(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED']);

  if (paidEvents.has(payload.event)) {
    await env.DB.prepare(`
      UPDATE account_access
      SET status='active',billing_period_ends_at=MAX(COALESCE(billing_period_ends_at,0),?),provider_payment_id=?,subscription_requested_at=NULL,updated_at=?
      WHERE user_id=?
    `).bind(paidUntil(now), paymentId, now, account.user_id).run();
  } else if (overdueEvents.has(payload.event)) {
    await env.DB.prepare(`
      UPDATE account_access SET status='past_due',provider_payment_id=?,updated_at=?
      WHERE user_id=? AND (billing_period_ends_at IS NULL OR billing_period_ends_at<=?)
    `).bind(paymentId, now, account.user_id, now).run();
  } else if (canceledEvents.has(payload.event) || subscriptionCanceledEvents.has(payload.event)) {
    await env.DB.prepare("UPDATE account_access SET status='canceled',provider_payment_id=?,updated_at=? WHERE user_id=?")
      .bind(paymentId, now, account.user_id).run();
  }

  await env.DB.prepare('UPDATE billing_events SET processed_at=? WHERE id=?').bind(now, payload.id).run();
  return reply({ ok: true, matched: true });
}
