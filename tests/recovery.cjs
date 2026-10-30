const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRuntime } = require('./helpers/runtime.cjs');

const oldPassword = 'Test-only-old-password-2026!';
const newPassword = 'Test-only-new-password-2026!';

async function setup(t, configured = true) {
  const rt = createRuntime();
  rt.env.AUTH_SIGNUP_ENABLED = 'true';
  t.after(() => rt.close());
  if (configured) Object.assign(rt.env, {
    RESEND_API_KEY: 're_test_only_not_a_real_key',
    RESEND_FROM_EMAIL: 'Clareia <acesso@example.test>',
    RESEND_REPLY_TO: 'suporte@example.test',
  });
  const sent = [];
  const transport = t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push({ url, options, body: JSON.parse(options.body) });
    return Response.json({ id: 'test-provider-message-id' });
  });
  const email = rt.loadSource('lib/recovery-email.ts');
  rt.loadSource('lib/auth.ts');
  const { betterAuth } = await import('better-auth');
  // Actual Better Auth handlers, password hashing, cookies, reset tokens and
  // sessions. Only the Cloudflare runtime and email transport are substituted.
  // SQLite uses the actual project migrations; hosted D1 remains a separate QA.
  const auth = betterAuth({ ...rt.authOptions, database: rt.sql, logger: { disabled: true } });
  async function call(path, body, cookie = '') {
    return auth.handler(new Request('https://clareia.test/api/auth/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { origin: 'https://clareia.test', 'content-type': 'application/json', cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
  }
  async function signup(address = 'owner@example.test') {
    const response = await call('sign-up/email', { name: 'Pessoa Teste', email: address, password: oldPassword, space: 'pf' });
    assert.equal(response.status, 200, await response.clone().text());
    const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const result = await response.json();
    assert.ok(cookie);
    return { cookie, user: result.user, address };
  }
  function token(index = sent.length - 1) {
    const url = sent[index].body.text.match(/https:\/\/clareia\.test\/redefinir-senha\?token=[^\s]+/)?.[0];
    assert.ok(url, 'Email must contain the same-origin reset link');
    return new URL(url).searchParams.get('token');
  }
  return { rt, email, sent, transport, auth, call, signup, token };
}

test('recuperação real troca senha, invalida sessão e recusa reutilização do link', async t => {
  const ctx = await setup(t);
  const { cookie, address } = await ctx.signup();
  assert.equal((await ctx.call('request-password-reset', { email: address, redirectTo: 'https://clareia.test/redefinir-senha' })).status, 200);
  assert.equal(ctx.sent.length, 1);
  const token = ctx.token();
  assert.equal((await ctx.call('reset-password', { token, newPassword })).status, 200);
  assert.equal(await (await ctx.call('get-session', undefined, cookie)).json(), null);
  assert.equal((await ctx.call('sign-in/email', { email: address, password: oldPassword })).status, 401);
  assert.equal((await ctx.call('sign-in/email', { email: address, password: newPassword })).status, 200);
  assert.equal((await ctx.call('reset-password', { token, newPassword: oldPassword })).status, 400);
});

test('pedido não revela se o endereço tem cadastro', async t => {
  const ctx = await setup(t);
  const { address } = await ctx.signup();
  const known = await ctx.call('request-password-reset', { email: address });
  const unknown = await ctx.call('request-password-reset', { email: 'absent@example.test' });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(await known.json(), await unknown.json());
  assert.equal(ctx.sent.length, 1);
});

test('link expirado é recusado sem trocar senha ou encerrar sessão válida', async t => {
  const ctx = await setup(t);
  const { cookie, address } = await ctx.signup();
  await ctx.call('request-password-reset', { email: address });
  const token = ctx.token();
  ctx.rt.sql.prepare('UPDATE verification SET expires_at=? WHERE identifier=?').run(Date.now() - 1000, `reset-password:${token}`);
  assert.equal((await ctx.call('reset-password', { token, newPassword })).status, 400);
  assert.ok((await (await ctx.call('get-session', undefined, cookie)).json()).user);
  assert.equal((await ctx.call('sign-in/email', { email: address, password: oldPassword })).status, 200);
});

test('novo pedido invalida link anterior e preserva o mais recente', async t => {
  const ctx = await setup(t);
  const { address } = await ctx.signup();
  await ctx.call('request-password-reset', { email: address });
  const first = ctx.token();
  await ctx.call('request-password-reset', { email: address });
  const latest = ctx.token();
  assert.notEqual(first, latest);
  assert.equal((await ctx.call('reset-password', { token: first, newPassword })).status, 400);
  assert.equal((await ctx.call('reset-password', { token: latest, newPassword })).status, 200);
});

test('senha fraca não consome link e URL de retorno externa é recusada', async t => {
  const ctx = await setup(t);
  const { address } = await ctx.signup();
  assert.equal((await ctx.call('request-password-reset', { email: address, redirectTo: 'https://attacker.test/reset' })).status, 403);
  assert.equal(ctx.sent.length, 0);
  await ctx.call('request-password-reset', { email: address });
  const token = ctx.token();
  assert.equal((await ctx.call('reset-password', { token, newPassword: 'tiny' })).status, 400);
  assert.equal((await ctx.call('reset-password', { token, newPassword })).status, 200);
});

test('sem Resend não há envio e o suporte recebe link temporário removido após uso', async t => {
  const ctx = await setup(t, false);
  const { address, user } = await ctx.signup();
  assert.equal(ctx.email.recoveryEmailConfigured(), false);
  const started = Date.now();
  assert.equal((await ctx.call('request-password-reset', { email: address })).status, 200);
  assert.equal(ctx.transport.mock.callCount(), 0);
  const queued = ctx.rt.sql.prepare('SELECT * FROM verification WHERE identifier=?').get(`support-reset-link:${user.id}`);
  assert.ok(queued);
  assert.ok(queued.expires_at >= started + 3599000 && queued.expires_at <= Date.now() + 3601000);
  const token = new URL(queued.value).searchParams.get('token');
  assert.equal((await ctx.call('reset-password', { token, newPassword })).status, 200);
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM verification WHERE identifier=?').get(`support-reset-link:${user.id}`).n, 0);
});

test('falha de rede preserva a alternativa de recuperação sem expor token na resposta', async t => {
  const ctx = await setup(t);
  ctx.transport.mock.mockImplementation(async () => { throw new Error('simulated network failure'); });
  const { address, user } = await ctx.signup();
  const response = await ctx.call('request-password-reset', { email: address });
  assert.equal(response.status, 200);
  const queued = ctx.rt.sql.prepare('SELECT value FROM verification WHERE identifier=?').get(`support-reset-link:${user.id}`);
  assert.ok(queued);
  assert.equal((await response.text()).includes(new URL(queued.value).searchParams.get('token')), false);
});

test('envio exige aceite válido do provedor e trata rejeição ou resposta inválida', async t => {
  const ctx = await setup(t);
  const input = { email: 'owner@example.test', name: 'Pessoa', resetUrl: 'https://clareia.test/redefinir-senha?token=test-token' };
  for (const [status, body, expected] of [[403, '{}', false], [503, '{}', false], [200, 'not-json', false], [200, '{}', false], [200, '{"id":""}', false], [200, '{"id":"accepted-id"}', true]]) {
    ctx.transport.mock.mockImplementation(async () => new Response(body, { status }));
    assert.equal(await ctx.email.sendRecoveryEmail(input), expected);
  }
});

test('links externos, sem token, parâmetros extras e injeção de cabeçalho não são enviados', async t => {
  const ctx = await setup(t);
  for (const resetUrl of [
    'https://attacker.test/redefinir-senha?token=t', 'http://clareia.test/redefinir-senha?token=t',
    'javascript:alert(1)', 'https://user:password@clareia.test/redefinir-senha?token=t',
    'https://clareia.test/redefinir-senha', 'https://clareia.test/redefinir-senha?token=',
    'https://clareia.test/redefinir-senha?token=a&token=b', 'https://clareia.test/redefinir-senha?token=a&redirect=https://attacker.test',
    'https://clareia.test/outro?token=t', 'https://clareia.test/redefinir-senha?token=t#fragment',
  ]) assert.equal(await ctx.email.sendRecoveryEmail({ email: 'owner@example.test', name: 'Pessoa', resetUrl }), false);
  assert.equal(await ctx.email.sendRecoveryEmail({ email: 'owner@example.test\r\nBcc:attacker@example.test', name: 'Pessoa', resetUrl: 'https://clareia.test/redefinir-senha?token=t' }), false);
  delete ctx.rt.env.BETTER_AUTH_URL;
  assert.equal(await ctx.email.sendRecoveryEmail({ email: 'owner@example.test', name: 'Pessoa', resetUrl: 'https://clareia.test/redefinir-senha?token=t' }), false);
  assert.equal(ctx.transport.mock.callCount(), 0);
});

test('mensagem escapa HTML e usa idempotência sem colocar token no cabeçalho', async t => {
  const ctx = await setup(t);
  const input = { email: 'owner@example.test', name: '<img src=x onerror=alert(1)>', resetUrl: 'https://clareia.test/redefinir-senha?token=test-secret-token' };
  assert.equal(await ctx.email.sendRecoveryEmail(input), true);
  assert.equal(await ctx.email.sendRecoveryEmail(input), true);
  assert.equal(await ctx.email.sendRecoveryEmail({ ...input, resetUrl: 'https://clareia.test/redefinir-senha?token=another-token' }), true);
  const [first, second, third] = ctx.sent;
  assert.equal(first.url, 'https://api.resend.com/emails');
  assert.equal(first.options.redirect, 'error');
  assert.ok(first.options.signal instanceof AbortSignal);
  assert.deepEqual(first.body.to, ['owner@example.test']);
  assert.equal(first.body.reply_to, 'suporte@example.test');
  assert.equal(first.body.html.includes('<img'), false);
  assert.ok(first.body.html.includes('&lt;img'));
  assert.equal(first.options.headers['Idempotency-Key'], second.options.headers['Idempotency-Key']);
  assert.notEqual(first.options.headers['Idempotency-Key'], third.options.headers['Idempotency-Key']);
  assert.match(first.options.headers['Idempotency-Key'], /^clareia-reset\/[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(first.options.headers).includes('test-secret-token'), false);
  assert.equal(JSON.stringify(first.body).includes(ctx.rt.env.RESEND_API_KEY), false);
});

test('falha tardia do envio antigo não reinsere link substituído na fila de suporte', async t => {
  const ctx = await setup(t);
  const { address, user } = await ctx.signup();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  let attempt = 0;
  ctx.transport.mock.mockImplementation(async () => {
    if (++attempt === 1) { entered.resolve(); return release.promise; }
    return Response.json({ error: 'simulated rejection' }, { status: 503 });
  });
  const firstRequest = ctx.call('request-password-reset', { email: address });
  await entered.promise;
  assert.equal((await ctx.call('request-password-reset', { email: address })).status, 200);
  const before = ctx.rt.sql.prepare('SELECT id,value FROM verification WHERE identifier=?').all(`support-reset-link:${user.id}`);
  assert.equal(before.length, 1);
  release.resolve(Response.json({ error: 'simulated delayed rejection' }, { status: 503 }));
  assert.equal((await firstRequest).status, 200);
  const after = ctx.rt.sql.prepare('SELECT id,value FROM verification WHERE identifier=?').all(`support-reset-link:${user.id}`);
  assert.deepEqual(after, before);
});

test('falha tardia depois da troca de senha não recria pedido já resolvido', async t => {
  const ctx = await setup(t);
  const { address, user } = await ctx.signup();
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  ctx.transport.mock.mockImplementation(async (_url, options) => {
    const body = JSON.parse(options.body);
    entered.resolve(new URL(body.text.match(/https:\/\/clareia\.test\/redefinir-senha\?token=[^\s]+/)[0]).searchParams.get('token'));
    return release.promise;
  });
  const pending = ctx.call('request-password-reset', { email: address });
  const token = await entered.promise;
  assert.equal((await ctx.call('reset-password', { token, newPassword })).status, 200);
  release.resolve(Response.json({ error: 'simulated late rejection' }, { status: 503 }));
  assert.equal((await pending).status, 200);
  assert.equal(ctx.rt.sql.prepare('SELECT COUNT(*) AS n FROM verification WHERE identifier=?').get(`support-reset-link:${user.id}`).n, 0);
});

test('recuperar uma conta mantém a sessão e o link de outra conta', async t => {
  const ctx = await setup(t);
  const first = await ctx.signup('first@example.test');
  const second = await ctx.signup('second@example.test');
  await ctx.call('request-password-reset', { email: second.address });
  const secondToken = ctx.token();
  await ctx.call('request-password-reset', { email: first.address });
  assert.equal((await ctx.call('reset-password', { token: ctx.token(), newPassword })).status, 200);
  assert.equal(await (await ctx.call('get-session', undefined, first.cookie)).json(), null);
  assert.ok((await (await ctx.call('get-session', undefined, second.cookie)).json()).user);
  assert.equal((await ctx.call('reset-password', { token: secondToken, newPassword })).status, 200);
});
