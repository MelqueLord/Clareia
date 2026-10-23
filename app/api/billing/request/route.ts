import { env } from 'cloudflare:workers';
import { getFinanceUser } from '../../../../lib/session';
import { getAccountAccess } from '../../../../lib/trial';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if ((req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) || !req.headers.get('content-type')?.includes('application/json')) {
    return reply({ error: 'Origem inválida.' }, 403);
  }
  const user = await getFinanceUser(req);
  if (!user || user.isTest || user.mustChangePassword || !env.DB) return reply({ error: 'Entre na sua conta para solicitar a assinatura.' }, 401);
  try {
    const access = await getAccountAccess(user.authUserId!);
    if (access.status === 'active') return reply({ error: 'Sua assinatura já está ativa.' }, 409);
    const requestedAt = access.subscriptionRequestedAt || Date.now();
    await env.DB.prepare('UPDATE account_access SET subscription_requested_at=?,updated_at=? WHERE user_id=? AND subscription_requested_at IS NULL')
      .bind(requestedAt, Date.now(), user.authUserId!).run();
    return reply({ ok: true, requestedAt });
  } catch {
    return reply({ error: 'Não foi possível registrar seu pedido. Tente novamente.' }, 503);
  }
}
