const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRuntime, request } = require('./helpers/runtime.cjs');

const password = 'Synthetic-journey-password-2026!';

async function setup(t, config = {}) {
  const rt = createRuntime();
  Object.assign(rt.env, { AUTH_SIGNUP_ENABLED: 'true' }, config);
  t.after(() => rt.close());
  rt.loadSource('lib/auth.ts');
  const { betterAuth } = await import('better-auth');
  const auth = betterAuth({ ...rt.authOptions, database: rt.sql, logger: { disabled: true } });
  rt.authApi.getSession = ({ headers }) => auth.api.getSession({ headers });
  const cookieFrom = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  // Independent synthetic clients avoid spending a real anti-abuse budget on a fast drill.
  // The production rate limiter remains enabled. These tests do not certify its limits.
  let clientNumber = 0;
  const call = (route, body, cookie = '') => auth.handler(request('auth/' + route, { body, cookie, method: body === undefined ? 'GET' : 'POST', headers: { 'x-forwarded-for': `192.0.2.${++clientNumber}` } }));
  async function signup(email, space = 'pf') {
    const response = await call('sign-up/email', { name: 'Pessoa fictícia', email, password, space });
    assert.equal(response.status, 200, await response.clone().text());
    const { user } = await response.json();
    return { email, space, user, cookie: cookieFrom(response), financeId: `personal:${user.id}:${space}` };
  }
  return { rt, auth, call, cookieFrom, signup };
}

test('lista de homologação aceita somente participantes exatos, normalizando caixa e espaços', async t => {
  const ctx = await setup(t, { AUTH_SIGNUP_POLICY: 'allowlist', AUTH_SIGNUP_ALLOWED_EMAILS: ' PF@EXAMPLE.TEST ;\nmei@example.test ' });
  await ctx.signup('pf@example.test');
  await ctx.signup('mei@example.test', 'mei');
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM user').get().n, 2);
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM job_locks').get().n, 0);
});

test('lista não aceita substring, domínio, cabeçalhos ou identidade enviados pelo visitante', async t => {
  const ctx = await setup(t, { AUTH_SIGNUP_POLICY: 'allowlist', AUTH_SIGNUP_ALLOWED_EMAILS: 'owner@example.test' });
  for (const email of ['not-owner@example.test', 'owner+extra@example.test', 'owner@sub.example.test']) {
    const response = await ctx.auth.handler(request('auth/sign-up/email', {
      method: 'POST', headers: { 'x-user-email': 'owner@example.test' },
      body: { name: 'Fictício', email, password, space: 'pf', isAdmin: true, AUTH_SIGNUP_ALLOWED_EMAILS: email },
    }));
    assert.equal(response.status, 403);
  }
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM user').get().n, 0);
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM job_locks').get().n, 0);
});

test('lista vazia, inválida ou política desconhecida recusa cadastro sem ocupar vaga', async t => {
  const ctx = await setup(t, { AUTH_SIGNUP_POLICY: 'allowlist' });
  for (const list of ['', '*@example.test', 'owner@example.test,inválido']) {
    ctx.rt.env.AUTH_SIGNUP_ALLOWED_EMAILS = list;
    const response = await ctx.call('sign-up/email', { name: 'Fictício', email: 'owner@example.test', password, space: 'pf' });
    assert.equal(response.status, 403);
  }
  ctx.rt.env.AUTH_SIGNUP_POLICY = 'allow-all-by-mistake';
  const response = await ctx.call('sign-up/email', { name: 'Fictício', email: 'owner@example.test', password, space: 'pf' });
  assert.equal(response.status, 503);
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM user').get().n, 0);
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM job_locks').get().n, 0);
});

test('chave global de cadastro fechado prevalece sobre participante autorizado', async t => {
  const ctx = await setup(t, { AUTH_SIGNUP_ENABLED: 'false', AUTH_SIGNUP_POLICY: 'allowlist', AUTH_SIGNUP_ALLOWED_EMAILS: 'owner@example.test' });
  const response = await ctx.call('sign-up/email', { name: 'Fictício', email: 'owner@example.test', password, space: 'pf' });
  assert.notEqual(response.status, 200);
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM user').get().n, 0);
});

test('retirar participante da lista impede novo cadastro sem revogar seu login existente', async t => {
  const ctx = await setup(t, { AUTH_SIGNUP_POLICY: 'allowlist', AUTH_SIGNUP_ALLOWED_EMAILS: 'owner@example.test' });
  const account = await ctx.signup('owner@example.test');
  assert.equal((await ctx.call('sign-out', {}, account.cookie)).status, 200);
  ctx.rt.env.AUTH_SIGNUP_ALLOWED_EMAILS = '';
  const login = await ctx.call('sign-in/email', { email: account.email, password });
  assert.equal(login.status, 200);
  assert.ok((await (await ctx.call('get-session', undefined, ctx.cookieFrom(login))).json()).user);
});

test('jornada PF/MEI com autenticação real: login, persistência, isolamento, exportação e exclusão vencida', async t => {
  const { rt, call, signup, cookieFrom } = await setup(t);
  const api = rt.loadSource('app/api/data/route.ts');
  const exporting = rt.loadSource('app/api/data/export/route.ts');
  const { emptyData, today } = rt.loadSource('lib/model.ts');
  const { balances } = rt.loadSource('lib/engine.ts');
  const clients = [await signup('first-pf@example.test'), await signup('second-pf@example.test'), await signup('business@example.test', 'mei')];
  for (const [index, client] of clients.entries()) {
    const initial = await api.GET(request('data', { cookie: client.cookie }));
    assert.equal(initial.status, 200);
    const initialData = await initial.json();
    assert.equal(initialData.user.defaultSpace, client.space);
    assert.equal(initialData.data.accounts.length, 0);
    const data = emptyData();
    data.configured = true;
    data.accounts = [{ id: 'same-local-account', name: `Conta fictícia ${index}`, bank: 'Teste', space: client.space, balance: 0, openingDate: today() }];
    data.transactions = [['income', 100000], ['expense', 3850]].map(([type, amount]) => ({
      id: `${type}-${index}`, description: `Fictício ${index} ${type}`, amount, type, category: type === 'income' ? 'Outras receitas' : 'Outros',
      date: today(), dueDate: today(), paid: true, estimated: false, accountId: 'same-local-account', toAccountId: '', cardId: '',
      space: client.space, installments: 1, recurring: false, source: 'manual', createdAt: new Date().toISOString(),
    }));
    const saved = await api.POST(request('data', { method: 'POST', cookie: client.cookie, body: { data, revision: 0, mutationId: crypto.randomUUID(), action: 'settings', userId: clients[(index + 1) % clients.length].financeId } }));
    assert.equal(saved.status, 200, await saved.clone().text());
  }
  for (const [index, client] of clients.entries()) {
    assert.equal((await call('sign-in/email', { email: client.email, password: 'Wrong-password-2026!' })).status, 401);
    const login = await call('sign-in/email', { email: client.email, password });
    assert.equal(login.status, 200);
    client.cookie = cookieFrom(login);
    const read = await api.GET(request('data?userId=' + clients[(index + 1) % clients.length].financeId, { cookie: client.cookie }));
    assert.equal(read.status, 200);
    const result = await read.json();
    assert.equal(result.revision, 1);
    assert.equal(result.data.accounts[0].name, `Conta fictícia ${index}`);
    assert.equal(result.user.id, client.financeId);
    assert.equal(result.data.transactions.length, 2);
    assert.equal(balances(result.data, today())['same-local-account'], 96150);
    const response = await exporting.GET(request('data/export', { cookie: client.cookie }));
    assert.equal(response.status, 200);
    const exported = await response.json();
    assert.equal(exported.space, client.space);
    assert.equal(exported.data.accounts[0].name, `Conta fictícia ${index}`);
    assert.equal(exported.data.transactions.length, 2);
  }
  const first = clients[0], survivor = clients[1];
  for (const routeModule of ['app/api/admin/access/route.ts', 'app/api/admin/recovery/route.ts']) {
    assert.equal((await rt.loadSource(routeModule).GET(request('admin/test', { cookie: first.cookie }))).status, 403);
  }
  const oldCookie = first.cookie;
  assert.equal((await call('sign-out', {}, oldCookie)).status, 200);
  assert.equal((await api.GET(request('data', { cookie: oldCookie }))).status, 401);
  const login = await call('sign-in/email', { email: first.email, password });
  assert.equal(login.status, 200);
  first.cookie = cookieFrom(login);
  assert.equal((await (await api.GET(request('data', { cookie: first.cookie }))).json()).data.transactions.length, 2);
  rt.sql.prepare("UPDATE account_access SET status='expired',trial_ends_at=? WHERE user_id=?").run(Date.now() - 1, first.user.id);
  assert.equal((await api.GET(request('data', { cookie: first.cookie }))).status, 402);
  assert.equal((await exporting.GET(request('data/export', { cookie: first.cookie }))).status, 200);
  assert.equal((await call('delete-user', { password: 'Wrong-password-2026!' }, first.cookie)).status, 400);
  assert.equal((await call('delete-user', { password }, first.cookie)).status, 200);
  assert.equal(await (await call('get-session', undefined, first.cookie)).json(), null);
  assert.equal((await call('sign-in/email', { email: first.email, password })).status, 401);
  for (const table of ['finance_documents', 'finance_snapshots', 'finance_audit']) {
    assert.equal(rt.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(first.financeId).n, 0);
    assert.equal(rt.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(survivor.financeId).n, 1);
  }
  for (const client of clients.slice(1)) assert.equal((await api.GET(request('data', { cookie: client.cookie }))).status, 200);
});

test('autenticação real recusa troca do perfil PF/MEI após cadastro', async t => {
  const ctx = await setup(t);
  const account = await ctx.signup('fixed-profile@example.test');
  const changed = await ctx.call('update-user', { space: 'mei' }, account.cookie);
  assert.equal(changed.status, 400);
  assert.equal(ctx.rt.sql.prepare('SELECT space FROM user WHERE id=?').get(account.user.id).space, 'pf');
});

test('limpeza de rascunhos remove somente a conta que saiu e tolera storage indisponível', t => {
  const rt = createRuntime();
  t.after(() => rt.close());
  const { clearAccountDrafts } = rt.loadSource('lib/client-privacy.ts');
  const entries = new Map([['clareia-drafts:personal:first:pf', 'privado'], ['clareia-drafts:personal:other:mei', 'outro'], ['other-setting', 'preferência']]);
  assert.equal(clearAccountDrafts('personal:first:pf', { removeItem: key => entries.delete(key) }), true);
  assert.equal(entries.has('clareia-drafts:personal:first:pf'), false);
  assert.equal(entries.get('clareia-drafts:personal:other:mei'), 'outro');
  assert.equal(entries.get('other-setting'), 'preferência');
  assert.equal(clearAccountDrafts('personal:first:pf', { removeItem() { throw new Error('Storage denied'); } }), false);
});
