import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

const targets = [
  { id: 'dJYz7RInUt9e7MvSfI3sLafyt6YNbMiF', email: 'pf.zerado@teste.clareia.app', space: 'pf' },
  { id: 'myMpbgFvNZy5FYTbTM3RQNsE6VPW9o2z', email: 'mei.zerado@teste.clareia.app', space: 'mei' },
] as const;
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } });

function matchesSecret(provided: string, expected: string) {
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function POST(req: Request) {
  if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return reply({ error: 'Origem inválida.' }, 403);
  const expected = env.CLEAR_TEST_ACCOUNTS_KEY || '';
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !matchesSecret(provided, expected)) return reply({ error: 'Acesso negado.' }, 403);
  if (!env.DB) return reply({ error: 'Banco indisponível.' }, 503);

  try {
    for (const target of targets) {
      const user = await env.DB.prepare('SELECT id FROM user WHERE id=? AND lower(email)=? AND space=?')
        .bind(target.id, target.email, target.space).first<{ id: string }>();
      if (!user) return reply({ error: 'Uma das contas de teste não corresponde ao alvo esperado.' }, 409);
    }

    const accountIds = targets.map((target) => target.id);
    const financeIds = [...new Set([
      ...accountIds.flatMap((id) => [id, `${id}:pf`, `${id}:mei`, `personal:${id}:pf`, `personal:${id}:mei`]),
      'test_pf', 'test_mei',
    ])];
    const financePlaceholders = financeIds.map(() => '?').join(',');
    const accountPlaceholders = accountIds.map(() => '?').join(',');
    const financeTables = ['finance_documents', 'finance_snapshots', 'finance_audit', 'push_subscriptions'] as const;
    const statements = [
      ...financeTables.map((table) => env.DB!.prepare(`DELETE FROM ${table} WHERE user_id IN (${financePlaceholders})`).bind(...financeIds)),
      env.DB.prepare(`DELETE FROM account_access WHERE user_id IN (${accountPlaceholders})`).bind(...accountIds),
      env.DB.prepare(`DELETE FROM session WHERE user_id IN (${accountPlaceholders})`).bind(...accountIds),
      env.DB.prepare(`DELETE FROM account WHERE user_id IN (${accountPlaceholders})`).bind(...accountIds),
      env.DB.prepare(`DELETE FROM verification WHERE value IN (${accountPlaceholders}) OR identifier IN (${targets.map(() => '?,?,?').join(',')})`)
        .bind(...accountIds, ...targets.flatMap(({ id, email }) => [email, `email:${email}`, `support-reset-link:${id}`])),
      env.DB.prepare('DELETE FROM test_sessions').bind(),
      env.DB.prepare("DELETE FROM rate_limit WHERE key LIKE 'demo-login:%'").bind(),
      env.DB.prepare(`DELETE FROM user WHERE id IN (${accountPlaceholders})`).bind(...accountIds),
    ];
    const results = await env.DB.batch(statements);
    const accountRowsDeleted = results[results.length - 1]?.meta.changes || 0;
    const demoSessionsDeleted = results[results.length - 3]?.meta.changes || 0;
    const relatedRowsDeleted = results.slice(0, -3).reduce((total, result) => total + (result.meta.changes || 0), 0);
    return reply({ ok: true, accountsDeleted: accountRowsDeleted, demoSessionsDeleted, relatedRowsDeleted });
  } catch {
    return reply({ error: 'Não foi possível remover as contas de teste.' }, 503);
  }
}
