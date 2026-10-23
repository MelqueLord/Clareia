import { env } from 'cloudflare:workers';
import { getFinanceUser } from '../../../../lib/session';
import { getAccountAccess } from '../../../../lib/trial';
import { isTrialAdmin } from '../../../../lib/trial-admin';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const allowed = (req: Request) => !req.headers.get('origin') || req.headers.get('origin') === new URL(req.url).origin;
async function authorizedAdmin(req: Request) {
  const user = await getFinanceUser(req);
  return user && !user.isTest && !user.mustChangePassword && isTrialAdmin(user.email) ? user : null;
}

export async function GET(req: Request) {
  if (!allowed(req)) return reply({ error: 'Origem inválida.' }, 403);
  if (!env.DB) return reply({ error: 'Banco indisponível.' }, 503);
  if (!await authorizedAdmin(req)) return reply({ error: 'Acesso restrito ao responsável pelo Clareia.' }, 403);
  try {
    const rows = await env.DB.prepare(`
      SELECT u.id, u.name, u.email, u.space, u.created_at AS createdAt,
        a.status, a.trial_started_at AS trialStartedAt, a.trial_ends_at AS trialEndsAt,
        a.billing_period_ends_at AS billingPeriodEndsAt, a.subscription_requested_at AS subscriptionRequestedAt
      FROM user u LEFT JOIN account_access a ON a.user_id = u.id
      ORDER BY COALESCE(a.subscription_requested_at, 0) DESC, u.created_at DESC LIMIT 200
    `).all();
    return reply({ accounts: rows.results });
  } catch {
    return reply({ error: 'Não foi possível carregar os acessos.' }, 503);
  }
}

export async function POST(req: Request) {
  if (!allowed(req) || !req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'Origem inválida.' }, 403);
  if (!env.DB) return reply({ error: 'Banco indisponível.' }, 503);
  const admin = await authorizedAdmin(req);
  if (!admin) return reply({ error: 'Acesso restrito ao responsável pelo Clareia.' }, 403);
  try {
    const raw = await req.text();
    if (raw.length > 2000) return reply({ error: 'Dados inválidos.' }, 400);
    const body = JSON.parse(raw) as { userId?: unknown; action?: unknown; days?: unknown };
    if (typeof body.userId !== 'string' || body.userId.length < 1 || body.userId.length > 128) return reply({ error: 'Conta inválida.' }, 400);
    if (body.userId === admin.authUserId) return reply({ error: 'Use outra conta para testar ações administrativas; sua conta de responsável foi protegida.' }, 409);
    if (!['extend_trial', 'activate', 'block', 'clear_request'].includes(String(body.action))) return reply({ error: 'Ação inválida.' }, 400);
    const account = await env.DB.prepare('SELECT id FROM user WHERE id=?').bind(body.userId).first<{ id: string }>();
    if (!account) return reply({ error: 'Conta não encontrada.' }, 404);
    const action = String(body.action);
    const days = body.days === undefined ? 30 : Number(body.days);
    if ((action === 'extend_trial' || action === 'activate') && (!Number.isInteger(days) || days < 1 || days > 365)) return reply({ error: 'Informe um prazo entre 1 e 365 dias.' }, 400);
    const now = Date.now();
    await getAccountAccess(body.userId);
    if (action === 'extend_trial') {
      const current = await env.DB.prepare('SELECT status FROM account_access WHERE user_id=?').bind(body.userId).first<{ status: string }>();
      if (current?.status === 'active') return reply({ error: 'Esta conta tem acesso ativo. Bloqueie ou aguarde o fim do período antes de prorrogar o teste.' }, 409);
      await env.DB.prepare("UPDATE account_access SET status='trialing',trial_ends_at=MAX(trial_ends_at,?)+?,subscription_requested_at=NULL,updated_at=? WHERE user_id=?")
        .bind(now, days * 86400000, now, body.userId).run();
    } else if (action === 'activate') {
      await env.DB.prepare("UPDATE account_access SET status='active',billing_period_ends_at=?,subscription_requested_at=NULL,updated_at=? WHERE user_id=?")
        .bind(now + days * 86400000, now, body.userId).run();
    } else if (action === 'block') {
      await env.DB.prepare("UPDATE account_access SET status='expired',billing_period_ends_at=?,subscription_requested_at=NULL,updated_at=? WHERE user_id=?")
        .bind(now, now, body.userId).run();
    } else {
      await env.DB.prepare('UPDATE account_access SET subscription_requested_at=NULL,updated_at=? WHERE user_id=?').bind(now, body.userId).run();
    }
    return reply({ ok: true });
  } catch {
    return reply({ error: 'Não foi possível atualizar o acesso.' }, 503);
  }
}
