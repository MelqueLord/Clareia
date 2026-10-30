const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRuntime, request } = require('./helpers/runtime.cjs');

function setup(t) {
  const rt = createRuntime();
  t.after(() => rt.close());
  return rt;
}

test('migrações criam todos os índices usados nas consultas multiusuário', t => {
  const { sql } = setup(t);
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
});

test('clientes individuais PF e MEI salvam em paralelo sem compartilhar dados', async t => {
  const rt = setup(t), api = rt.loadSource('app/api/data/route.ts');
  const { emptyData } = rt.loadSource('lib/model.ts');
  const clients = [rt.createSession({ id: 'customer-a' }), rt.createSession({ id: 'customer-b' }), rt.createSession({ id: 'customer-mei', space: 'mei' })];
  const reads = await Promise.all(clients.map(client => api.GET(request('data', { cookie: client.cookie }))));
  for (const response of reads) assert.equal(response.status, 200);
  const accounts = await Promise.all(reads.map(response => response.json()));
  assert.equal(new Set(accounts.map(account => account.user.id)).size, 3);
  const saves = await Promise.all(clients.map((client, index) => {
    const data = emptyData();
    data.accounts = [{ id: 'same-local-id', name: client.id, bank: 'Teste', space: client.space, balance: 10000 + index, openingDate: '2026-10-01' }];
    return api.POST(request('data', { method: 'POST', cookie: client.cookie, body: { data, revision: accounts[index].revision, mutationId: crypto.randomUUID(), action: 'settings' } }));
  }));
  for (const response of saves) assert.equal(response.status, 200);
  for (const [index, client] of clients.entries()) {
    const saved = await (await api.GET(request('data', { cookie: client.cookie }))).json();
    assert.equal(saved.data.accounts.length, 1);
    assert.equal(saved.data.accounts[0].name, client.id);
    assert.equal(saved.data.accounts[0].space, client.space);
    assert.equal(saved.data.accounts[0].balance, 10000 + index);
  }
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM finance_documents').get().n, 3);
});

test('identidade enviada no corpo não substitui o dono autenticado do documento', async t => {
  const rt = setup(t), api = rt.loadSource('app/api/data/route.ts');
  const owner = rt.createSession({ id: 'owner' }), attacker = rt.createSession({ id: 'attacker' });
  const data = rt.loadSource('lib/model.ts').emptyData();
  data.profiles.pf.incomeSource = 'Conteúdo do solicitante';
  const response = await api.POST(request('data', { method: 'POST', cookie: attacker.cookie, body: {
    userId: owner.userId, authUserId: owner.id, data, revision: 0, mutationId: crypto.randomUUID(), action: 'settings',
  } }));
  assert.equal(response.status, 200);
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM finance_documents WHERE user_id=?').get(owner.userId).n, 0);
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM finance_documents WHERE user_id=?').get(attacker.userId).n, 1);
});

test('duas gravações da mesma revisão preservam apenas uma alteração', async t => {
  const rt = setup(t), api = rt.loadSource('app/api/data/route.ts');
  const { cookie } = rt.createSession();
  const { emptyData } = rt.loadSource('lib/model.ts');
  const responses = await Promise.all(['Primeira alteração', 'Segunda alteração'].map(incomeSource => {
    const data = emptyData(); data.profiles.pf.incomeSource = incomeSource;
    return api.POST(request('data', { method: 'POST', cookie, body: { data, revision: 0, mutationId: crypto.randomUUID(), action: 'settings' } }));
  }));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM finance_documents').get().n, 1);
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM finance_audit').get().n, 1);
  assert.equal(rt.sql.prepare('SELECT revision FROM finance_documents').get().revision, 1);
});
