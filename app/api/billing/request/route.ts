import { env } from 'cloudflare:workers';
import { getFinanceUser } from '../../../../lib/session';
import { getAccountAccess } from '../../../../lib/trial';
import {
  asaasConfigured,
  createAsaasSubscription,
  findOrCreateAsaasCustomer,
  listAsaasSubscriptionPayments,
  safeAsaasInvoiceUrl,
  validCpfCnpj,
} from '../../../../lib/asaas';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if ((req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) || !req.headers.get('content-type')?.includes('application/json')) {
    return reply({ error: 'Origem inválida.' }, 403);
  }
  const user = await getFinanceUser(req);
  if (!user || user.isTest || user.mustChangePassword || !env.DB) return reply({ error: 'Entre na sua conta para solicitar a assinatura.' }, 401);

  const requestedAt = Date.now();
  try {
    const access = await getAccountAccess(user.authUserId!);
    if (access.status === 'active') return reply({ error: 'Sua assinatura já está ativa.' }, 409);

    if (!asaasConfigured()) {
      const savedAt = access.subscriptionRequestedAt || requestedAt;
      await env.DB.prepare('UPDATE account_access SET subscription_requested_at=?,updated_at=? WHERE user_id=? AND subscription_requested_at IS NULL')
        .bind(savedAt, requestedAt, user.authUserId!).run();
      return reply({ ok: true, requestedAt: savedAt, mode: 'manual' });
    }

    const body = await req.json().catch(() => ({})) as { cpfCnpj?: string };
    if (!validCpfCnpj(body.cpfCnpj || '')) return reply({ error: 'Informe um CPF ou CNPJ válido para gerar a cobrança.' }, 400);

    const row = await env.DB.prepare('SELECT provider_customer_id,provider_subscription_id FROM account_access WHERE user_id=?')
      .bind(user.authUserId!).first<{ provider_customer_id: string | null; provider_subscription_id: string | null }>();

    if (row?.provider_subscription_id) {
      const listed = await listAsaasSubscriptionPayments(row.provider_subscription_id);
      const openPayment = listed.data.find(payment => ['PENDING', 'OVERDUE'].includes(payment.status) && safeAsaasInvoiceUrl(payment.invoiceUrl));
      const checkoutUrl = safeAsaasInvoiceUrl(openPayment?.invoiceUrl);
      if (checkoutUrl) return reply({ ok: true, requestedAt: access.subscriptionRequestedAt || requestedAt, mode: 'asaas', checkoutUrl });
      return reply({ error: 'Sua assinatura já foi criada. Aguarde a atualização da cobrança ou fale com o suporte.' }, 409);
    }

    const nowIso = new Date().toISOString();
    const untilIso = new Date(Date.now() + 30_000).toISOString();
    const lockId = `billing:${user.authUserId}`;
    const lock = await env.DB.prepare(
      'INSERT INTO job_locks(id,until_at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET until_at=excluded.until_at WHERE job_locks.until_at<? RETURNING id',
    ).bind(lockId, untilIso, nowIso).first<{ id: string }>();
    if (!lock) return reply({ error: 'A cobrança já está sendo preparada. Tente novamente em alguns segundos.' }, 409);

    try {
      const customer = row?.provider_customer_id
        ? { id: row.provider_customer_id }
        : await findOrCreateAsaasCustomer({
          authUserId: user.authUserId!,
          name: user.displayName || user.email,
          email: user.email,
          cpfCnpj: body.cpfCnpj || '',
        });
      await env.DB.prepare('UPDATE account_access SET provider_customer_id=?,updated_at=? WHERE user_id=?')
        .bind(customer.id, requestedAt, user.authUserId!).run();

      const configuredReturn = env.ASAAS_RETURN_URL?.trim();
      const returnUrl = configuredReturn || new URL('/?billing=return', req.url).toString();
      const subscription = await createAsaasSubscription({
        authUserId: user.authUserId!, customerId: customer.id, space: user.defaultSpace, returnUrl,
      });
      const listed = await listAsaasSubscriptionPayments(subscription.id);
      const payment = listed.data.find(item => safeAsaasInvoiceUrl(item.invoiceUrl)) || listed.data[0];
      const checkoutUrl = safeAsaasInvoiceUrl(payment?.invoiceUrl);
      await env.DB.prepare(`
        UPDATE account_access
        SET provider_customer_id=?,provider_subscription_id=?,provider_payment_id=?,subscription_requested_at=?,updated_at=?
        WHERE user_id=?
      `).bind(customer.id, subscription.id, payment?.id || null, requestedAt, requestedAt, user.authUserId!).run();
      if (!checkoutUrl) return reply({ error: 'A assinatura foi criada, mas a página de pagamento ainda está sendo preparada. Tente novamente em instantes.' }, 503);
      return reply({ ok: true, requestedAt, mode: 'asaas', checkoutUrl });
    } finally {
      await env.DB.prepare('DELETE FROM job_locks WHERE id=?').bind(lockId).run();
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '';
    if (message.startsWith('ASAAS_400')) return reply({ error: 'A Asaas não aceitou os dados informados. Confira o CPF ou CNPJ e tente novamente.' }, 400);
    return reply({ error: 'Não foi possível preparar o pagamento agora. Tente novamente em alguns minutos.' }, 503);
  }
}
