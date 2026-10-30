import { env } from 'cloudflare:workers';
import { getFinanceUser } from '../../../../lib/session';
import { isTrialAdmin } from '../../../../lib/trial-admin';
import { recoveryEmailConfigured } from '../../../../lib/recovery-email';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } });
const allowed = (req: Request) => !req.headers.get('origin') || req.headers.get('origin') === new URL(req.url).origin;

async function authorized(req: Request) {
  const user = await getFinanceUser(req);
  return user && !user.isTest && !user.mustChangePassword && isTrialAdmin(user);
}

export async function GET(req: Request) {
  if (!allowed(req)) return reply({ error: 'Origem inválida.' }, 403);
  if (!env.DB) return reply({ error: 'Banco indisponível.' }, 503);
  if (!await authorized(req)) return reply({ error: 'Acesso restrito ao suporte responsável.' }, 403);
  try {
    const now = Date.now();
    await env.DB.prepare("DELETE FROM verification WHERE identifier LIKE 'support-reset-link:%' AND expires_at<=?").bind(now).run();
    const rows = await env.DB.prepare(`
      SELECT v.id, v.value AS resetUrl, v.expires_at AS expiresAt, v.created_at AS requestedAt,
        u.name, u.email, u.space
      FROM verification v JOIN user u ON v.identifier=('support-reset-link:' || u.id)
      WHERE v.expires_at>? ORDER BY v.created_at DESC LIMIT 50
    `).bind(now).all();
    return reply({ requests: rows.results, emailDeliveryConfigured: recoveryEmailConfigured() });
  } catch {
    return reply({ error: 'Não foi possível carregar as solicitações de recuperação.' }, 503);
  }
}

export async function POST(req: Request) {
  if (!allowed(req) || !req.headers.get('content-type')?.includes('application/json')) return reply({ error: 'Origem inválida.' }, 403);
  if (!env.DB) return reply({ error: 'Banco indisponível.' }, 503);
  if (!await authorized(req)) return reply({ error: 'Acesso restrito ao suporte responsável.' }, 403);
  try {
    const raw = await req.text();
    if (raw.length > 500) return reply({ error: 'Dados inválidos.' }, 400);
    const body = JSON.parse(raw) as { id?: unknown };
    if (typeof body.id !== 'string' || body.id.length < 10 || body.id.length > 80) return reply({ error: 'Solicitação inválida.' }, 400);
    const result = await env.DB.prepare("DELETE FROM verification WHERE id=? AND identifier LIKE 'support-reset-link:%'").bind(body.id).run();
    if (!result.meta.changes) return reply({ error: 'Solicitação expirada ou já removida.' }, 404);
    return reply({ ok: true });
  } catch {
    return reply({ error: 'Não foi possível concluir esta solicitação.' }, 503);
  }
}
