const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createRuntime, request } = require('./helpers/runtime.cjs');

const password = 'Only-for-deletion-tests-2026!';

async function setup(t) {
  const rt = createRuntime();
  rt.env.AUTH_SIGNUP_ENABLED = 'true';
  t.after(() => rt.close());
  rt.loadSource('lib/auth.ts');
  const { betterAuth } = await import('better-auth');
  const auth = betterAuth({ ...rt.authOptions, database: rt.sql, logger: { disabled: true } });
  rt.authApi.getSession = ({ headers }) => auth.api.getSession({ headers });
  async function call(route, body, cookie = '') {
    return auth.handler(request('auth/' + route, { method: body === undefined ? 'GET' : 'POST', body, cookie }));
  }
  async function account(email, space) {
    const signup = await call('sign-up/email', { name: 'Conta fictícia', email, password, space });
    assert.equal(signup.status, 200, await signup.clone().text());
    const { user } = await signup.json();
    const cookie = signup.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const userId = `personal:${user.id}:${space}`;
    const payload = JSON.stringify(rt.loadSource('lib/model.ts').emptyData());
    const now = new Date().toISOString();
    rt.sql.prepare('INSERT INTO finance_documents(user_id,payload,revision,mutation_id,updated_at) VALUES(?,?,?,?,?)')
      .run(userId, payload, 1, crypto.randomUUID(), now);
    rt.sql.prepare('INSERT INTO finance_snapshots(id,user_id,payload,created_at) VALUES(?,?,?,?)').run(crypto.randomUUID(), userId, payload, now);
    rt.sql.prepare('INSERT INTO finance_audit(id,user_id,action,created_at) VALUES(?,?,?,?)').run(crypto.randomUUID(), userId, 'settings', now);
    rt.sql.prepare('INSERT INTO push_subscriptions(id,user_id,endpoint,frequency,last_digest,last_sent,last_week,attempt_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), userId, 'https://push.example.test/fake', 'daily', '', '', '', '');
    rt.sql.prepare('INSERT INTO account_access(user_id,status,trial_started_at,trial_ends_at) VALUES(?,?,?,?)')
      .run(user.id, 'expired', Date.now() - 31 * 86400000, Date.now() - 86400000);
    return { user, userId, cookie };
  }
  return { rt, call, account };
}

// Render the actual paywall and privacy panel with React. Router operations are
// substituted; this check does not claim a full browser interaction test.
function loadPaywall() {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '..', relative);
    if (cache.has(file)) return cache.get(file).exports;
    const compiled = new Module(file, module);
    cache.set(file, compiled);
    const original = Module.createRequire(file);
    compiled.require = name => {
      if (name === 'next/navigation') return { useRouter: () => ({ replace() {}, refresh() {} }) };
      if (name.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), name);
        for (const extension of ['.tsx', '.ts']) {
          if (fs.existsSync(resolved + extension)) return load(resolved + extension);
        }
      }
      return original(name);
    };
    compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, file);
    return compiled.exports;
  }
  return load('app/ui/TrialPaywall.tsx').default;
}

test('tela de teste vencido oferece exportação e exclusão com senha e confirmação', () => {
  const TrialPaywall = loadPaywall();
  const html = renderToStaticMarkup(React.createElement(TrialPaywall, {
    user: { id: 'personal:test:pf', email: 'person@example.test', defaultSpace: 'pf', isTest: false },
    access: { status: 'expired', trialEndsAt: Date.now() - 86400000, canUse: false, daysRemaining: 0 },
    onSignOut: async () => {}, onDeleted() {},
  }));
  assert.match(html, /SEU PERÍODO DE TESTE TERMINOU/);
  assert.match(html, /Exportar meus dados/);
  assert.match(html, /Excluir minha conta e meus dados/);
  assert.match(html, /Senha atual/);
  assert.match(html, /type="password"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /Excluir conta permanentemente/);
});

test('conta vencida pode ser excluída com senha e sem remover dados de outra conta', async t => {
  const { rt, call, account } = await setup(t);
  const first = await account('expired-pf@example.test', 'pf');
  const second = await account('other-mei@example.test', 'mei');
  const api = rt.loadSource('app/api/data/route.ts');
  const exporting = rt.loadSource('app/api/data/export/route.ts');
  assert.equal((await api.GET(request('data', { cookie: first.cookie }))).status, 402);
  assert.equal((await exporting.GET(request('data/export', { cookie: first.cookie }))).status, 200);
  const response = await call('delete-user', { password }, first.cookie);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM user WHERE id=?').get(first.user.id).n, 0);
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM session WHERE user_id=?').get(first.user.id).n, 0);
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM account WHERE user_id=?').get(first.user.id).n, 0);
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM account_access WHERE user_id=?').get(first.user.id).n, 0);
  for (const table of ['finance_documents', 'finance_snapshots', 'finance_audit', 'push_subscriptions']) {
    assert.equal(rt.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(first.userId).n, 0, table);
    assert.equal(rt.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(second.userId).n, 1, table);
  }
  assert.equal(await (await call('get-session', undefined, first.cookie)).json(), null);
  assert.ok((await (await call('get-session', undefined, second.cookie)).json()).user);
  assert.equal((await api.GET(request('data', { cookie: first.cookie }))).status, 401);
});

test('senha incorreta impede exclusão da conta vencida e preserva seus dados', async t => {
  const { rt, call, account } = await setup(t);
  const first = await account('wrong-password@example.test', 'pf');
  const response = await call('delete-user', { password: 'Incorrect-password-2026!' }, first.cookie);
  assert.equal(response.status, 400);
  for (const table of ['finance_documents', 'finance_snapshots', 'finance_audit', 'push_subscriptions']) {
    assert.equal(rt.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(first.userId).n, 1, table);
  }
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM user WHERE id=?').get(first.user.id).n, 1);
  assert.ok((await (await call('get-session', undefined, first.cookie)).json()).user);
});
