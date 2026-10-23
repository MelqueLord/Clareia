const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const Module = require('node:module');
const { randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const out = path.join(root, '.multitenant-build');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}');

for (const file of ['lib/model.ts', 'lib/validation.ts', 'lib/session.ts', 'app/api/data/route.ts']) {
  const destination = path.join(out, file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}

const sql = new DatabaseSync(':memory:');
for (const file of fs.readdirSync(path.join(root, 'drizzle')).filter(file => file.endsWith('.sql')).sort()) {
  sql.exec(fs.readFileSync(path.join(root, 'drizzle', file), 'utf8'));
}

const env = { DB: {
  prepare(query) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) || null; },
      async all() { return { results: sql.prepare(query).all(...args) }; },
      async run() { return { meta: { changes: sql.prepare(query).run(...args).changes } }; },
    };
  },
  async batch(statements) {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sql.exec('COMMIT');
      return results;
    } catch (error) {
      sql.exec('ROLLBACK');
      throw error;
    }
  },
} };

const originalLoad = Module._load;
Module._load = function (name, ...rest) {
  if (name === 'cloudflare:workers') return { env };
  if (name === './auth') return { auth: { api: { getSession: async () => null } } };
  return originalLoad.call(this, name, ...rest);
};

async function main() {
  const { emptyData } = require('../.multitenant-build/lib/model');
  const { tokenHash } = require('../.multitenant-build/lib/session');
  const api = require('../.multitenant-build/app/api/data/route');
  const now = new Date().toISOString();
  const sessions = [];
  for (const [id, name] of [['customer-a', 'Cliente A'], ['customer-b', 'Cliente B']]) {
    const token = randomBytes(32).toString('hex');
    sessions.push(token);
    await env.DB.prepare('INSERT INTO test_sessions(token_hash,user_id,display_name,email,space,expires_at) VALUES(?,?,?,?,?,?)')
      .bind(await tokenHash(token), id, name, `${id}@example.test`, 'pf', new Date(Date.now() + 3600000).toISOString()).run();
  }

  const request = (token, method = 'GET', body) => new Request('https://clareia.test/api/data', {
    method,
    headers: { origin: 'https://clareia.test', cookie: `clareia_session=${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const [tokenA, tokenB] = sessions;
  const [readA, readB] = await Promise.all([api.GET(request(tokenA)), api.GET(request(tokenB))]);
  const accountA = await readA.json();
  const accountB = await readB.json();
  assert.notEqual(accountA.user.id, accountB.user.id);

  for (const [token, account, incomeSource] of [[tokenA, accountA, 'Renda da Cliente A'], [tokenB, accountB, 'Renda do Cliente B']]) {
    const data = emptyData();
    data.profiles.pf.incomeSource = incomeSource;
    const response = await api.POST(request(token, 'POST', {
      data, revision: account.revision, mutationId: crypto.randomUUID(), action: 'settings',
    }));
    assert.equal(response.status, 200);
  }

  const [savedA, savedB] = await Promise.all([api.GET(request(tokenA)), api.GET(request(tokenB))]);
  assert.equal((await savedA.json()).data.profiles.pf.incomeSource, 'Renda da Cliente A');
  assert.equal((await savedB.json()).data.profiles.pf.incomeSource, 'Renda do Cliente B');
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM finance_documents').get().count, 2);

  for (const [table, expected] of [
    ['finance_snapshots', 'finance_snapshots_user_created_idx'],
    ['finance_audit', 'finance_audit_user_created_idx'],
    ['push_subscriptions', 'push_subscriptions_user_attempt_idx'],
    ['push_subscriptions', 'push_subscriptions_attempt_idx'],
    ['test_sessions', 'test_sessions_expires_at_idx'],
    ['session', 'session_expires_at_idx'],
    ['verification', 'verification_expires_at_idx'],
    ['rate_limit', 'rate_limit_last_request_idx'],
  ]) {
    const indexes = sql.prepare(`PRAGMA index_list('${table}')`).all().map(row => row.name);
    assert.ok(indexes.includes(expected), `Índice ausente: ${expected}`);
  }

  console.log('PASS migrações e índices para consultas multiusuário');
  console.log('PASS isolamento de dados financeiros entre dois clientes');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  sql.close();
  fs.rmSync(out, { recursive: true, force: true });
});
