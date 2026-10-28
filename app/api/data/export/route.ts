import { env } from 'cloudflare:workers';
import { getFinanceUser } from '../../../../lib/session';
import { emptyData, type FinanceData } from '../../../../lib/model';
import { migrateLegacyUser, scopedData } from '../route';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const user = await getFinanceUser(req);
  if (!user) return reply({ error: 'Entre na sua conta para exportar seus dados.' }, 401);
  if (user.isTest) return reply({ error: 'A demonstração compartilhada não possui dados pessoais para exportar.' }, 403);
  if (user.mustChangePassword) return reply({ error: 'Altere sua senha antes de exportar seus dados.' }, 403);
  if (!env.DB) return reply({ error: 'Banco de dados indisponível.' }, 503);

  try {
    let row = await env.DB.prepare('SELECT payload FROM finance_documents WHERE user_id=?')
      .bind(user.userId).first<{ payload: string }>();
    if (!row && 'legacyUserId' in user && typeof user.legacyUserId === 'string') {
      await migrateLegacyUser(user.legacyUserId);
      row = await env.DB.prepare('SELECT payload FROM finance_documents WHERE user_id=?')
        .bind(user.userId).first<{ payload: string }>();
    }
    const data = row ? scopedData(JSON.parse(row.payload) as FinanceData, user.defaultSpace) : emptyData();
    return reply({ version: 1, space: user.defaultSpace, exportedAt: new Date().toISOString(), data });
  } catch {
    return reply({ error: 'Não foi possível exportar seus dados. Tente novamente.' }, 503);
  }
}
