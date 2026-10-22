import { env } from 'cloudflare:workers';
import { auth } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function allowed(req: Request) {
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

export async function POST(req: Request) {
  if (!allowed(req) || !req.headers.get('content-type')?.includes('application/json')) {
    return reply({ error: 'Origem inválida.' }, 403);
  }
  if (!env.DB || !env.BETTER_AUTH_SECRET) {
    return reply({ error: 'Serviço temporariamente indisponível.' }, 503);
  }

  try {
    const raw = await req.text();
    if (raw.length > 1000) return reply({ error: 'Dados inválidos.' }, 400);
    const body = JSON.parse(raw) as { currentPassword?: unknown; newPassword?: unknown };
    if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
      return reply({ error: 'Informe sua senha atual e a nova senha.' }, 400);
    }
    if (body.newPassword.length < 8 || body.newPassword.length > 128) {
      return reply({ error: 'A nova senha deve ter de 8 a 128 caracteres.' }, 400);
    }
    if (body.currentPassword === body.newPassword) {
      return reply({ error: 'Escolha uma senha diferente da senha temporária.' }, 400);
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return reply({ error: 'Sua sessão expirou. Entre novamente.' }, 401);
    if (session.user.mustChangePassword !== true) {
      return reply({ error: 'Esta conta já definiu uma senha pessoal.' }, 409);
    }

    try {
      await auth.api.changePassword({
        headers: req.headers,
        body: { currentPassword: body.currentPassword, newPassword: body.newPassword },
      });
    } catch {
      return reply({ error: 'Não foi possível confirmar a senha atual. Confira os dados e tente novamente.' }, 400);
    }

    const updated = await env.DB.prepare(
      'UPDATE user SET must_change_password=0 WHERE id=? AND must_change_password=1',
    ).bind(session.user.id).run();
    if (!updated.meta.changes) return reply({ error: 'A senha foi atualizada, mas não foi possível concluir o primeiro acesso. Recarregue e tente novamente.' }, 500);
    return reply({ ok: true });
  } catch {
    return reply({ error: 'Não foi possível concluir a troca de senha. Tente novamente.' }, 500);
  }
}
