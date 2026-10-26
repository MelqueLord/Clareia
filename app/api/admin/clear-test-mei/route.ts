import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

const targetEmail = 'mei.zerado@teste.clareia.app';
const targetId = 'myMpbgFvNZy5FYTbTM3RQNsE6VPW9o2z';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } });

function matchesSecret(provided: string, expected: string) {
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function POST(req: Request) {
  if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return reply({ error: 'Origem inválida.' }, 403);
  const expected = env.CLEAR_TEST_FINANCE_KEY || '';
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !matchesSecret(provided, expected)) return reply({ error: 'Acesso negado.' }, 403);
  if (!env.DB) return reply({ error: 'Banco indisponível.' }, 503);

  try {
    const user = await env.DB.prepare('SELECT id, space FROM user WHERE lower(email)=?').bind(targetEmail).first<{ id: string; space: string }>();
    if (!user || user.id !== targetId || user.space !== 'mei') return reply({ error: 'A conta de teste MEI não corresponde ao alvo esperado.' }, 404);

    const userIds = [user.id, `${user.id}:pf`, `${user.id}:mei`, `personal:${user.id}:pf`, `personal:${user.id}:mei`];
    const placeholders = userIds.map(() => '?').join(',');
    const tables = ['finance_documents', 'finance_snapshots', 'finance_audit', 'push_subscriptions'] as const;
    const results = await env.DB.batch(tables.map((table) => env.DB!.prepare(`DELETE FROM ${table} WHERE user_id IN (${placeholders})`).bind(...userIds)));
    const removedRows = results.reduce((total, result) => total + (result.meta.changes || 0), 0);
    return reply({ ok: true, removedRows });
  } catch {
    return reply({ error: 'Não foi possível limpar os dados financeiros.' }, 503);
  }
}
