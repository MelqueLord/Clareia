const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createRequire } = Module;
const { DatabaseSync } = require('node:sqlite');
const { test, beforeEach, after } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const env = {};
const modules = new Map();
let authOptions;
let session = null;
let sql;

class AuthError extends Error {
  constructor(status, body) { super(body.message); this.status = status; }
}

// Compile the real handlers in memory, replacing only runtime/auth providers.
function loadSource(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const compiled = new Module(filename, module);
  modules.set(filename, compiled);
  const nativeRequire = createRequire(filename);
  compiled.require = (name) => {
    if (name === 'cloudflare:workers') return { env };
    if (name === 'better-auth') return { betterAuth: options => {
      authOptions = options;
      return { api: { getSession: async () => session } };
    } };
    if (name === 'better-auth/api') return { APIError: AuthError };
    if (name === 'vinext/shims/request-context') return { getRequestExecutionContext: () => null };
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(target + '.ts')) return loadSource(target + '.ts');
    }
    return nativeRequire(name);
  };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return compiled.exports;
}

const { isTrialAdmin } = loadSource('lib/trial-admin.ts');
const access = loadSource('app/api/admin/access/route.ts');
const recovery = loadSource('app/api/admin/recovery/route.ts');
const data = loadSource('app/api/data/route.ts');
const { tokenHash } = loadSource('lib/session.ts');

function request(route, method = 'GET', body, cookie = '') {
  return new Request('https://clareia.test/api/' + route, {
    method,
    headers: { origin: 'https://clareia.test', 'content-type': 'application/json', cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function signIn(id = 'owner-id', email = 'owner@example.test', mustChangePassword = false) {
  session = { user: { id, email, name: 'Test user', space: 'pf', mustChangePassword, createdAt: new Date('2026-10-29T12:00:00Z') } };
}
const candidate = extra => ({ authUserId: 'owner-id', email: 'owner@example.test', isTest: false, mustChangePassword: false, ...extra });
const createUser = (id, email) => sql.prepare('INSERT INTO user(id,name,email,space,must_change_password) VALUES(?,?,?,?,0)').run(id, id, email, 'pf');

beforeEach(() => {
  sql?.close();
  sql = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(path.join(root, 'drizzle')).filter(file => file.endsWith('.sql')).sort()) {
    sql.exec(fs.readFileSync(path.join(root, 'drizzle', file), 'utf8'));
  }
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    TRIAL_ADMIN_EMAIL: 'owner@example.test', TRIAL_ADMIN_USER_ID: 'owner-id',
    BETTER_AUTH_SECRET: 'test-only-secret', PILOT_MAX_ACCOUNTS: '2',
    DB: {
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
          const result = [];
          for (const statement of statements) result.push(await statement.run());
          sql.exec('COMMIT');
          return result;
        } catch (error) { sql.exec('ROLLBACK'); throw error; }
      },
    },
  });
  createUser('owner-id', 'owner@example.test');
  createUser('customer-id', 'customer@example.test');
  session = null;
});
after(() => sql.close());

async function assertAdminDenied(cookie = '') {
  for (const [route, handler] of [['admin/access', access], ['admin/recovery', recovery]]) {
    assert.equal((await handler.GET(request(route, 'GET', null, cookie))).status, 403);
    assert.equal((await handler.POST(request(route, 'POST', { userId: 'customer-id', action: 'block', id: 'recovery-request-1' }, cookie))).status, 403);
  }
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM account_access').get().n, 0);
}

test('admin requires both configured identity fields, with no email fallback', () => {
  for (const [id, email] of [[undefined, 'owner@example.test'], ['', 'owner@example.test'], ['  ', 'owner@example.test'], ['owner-id', undefined], ['owner-id', '']]) {
    env.TRIAL_ADMIN_USER_ID = id;
    env.TRIAL_ADMIN_EMAIL = email;
    assert.equal(isTrialAdmin(candidate()), false);
  }
});

test('admin matches the immutable ID and normalized email, rejecting unsafe sessions', () => {
  env.TRIAL_ADMIN_EMAIL = ' OWNER@EXAMPLE.TEST ';
  assert.equal(isTrialAdmin(candidate()), true);
  for (const user of [null, undefined, candidate({ authUserId: 'attacker-id' }), candidate({ email: 'attacker@example.test' }), candidate({ isTest: true }), candidate({ mustChangePassword: true }), candidate({ authUserId: undefined })]) {
    assert.equal(isTrialAdmin(user), false);
  }
});

test('anonymous requests cannot read or mutate admin resources', async () => { await assertAdminDenied(); });

test('an authenticated account with the admin email but a different ID is denied', async () => {
  signIn('attacker-id', 'owner@example.test');
  await assertAdminDenied();
});

test('request parameters and headers cannot grant admin privileges', async () => {
  signIn('customer-id', 'customer@example.test');
  const req = new Request('https://clareia.test/api/admin/access?authUserId=owner-id&email=owner@example.test', {
    method: 'POST', headers: { origin: 'https://clareia.test', 'content-type': 'application/json', 'x-user-id': 'owner-id' },
    body: JSON.stringify({ userId: 'customer-id', action: 'block', authUserId: 'owner-id', email: 'owner@example.test', isAdmin: true }),
  });
  assert.equal((await access.POST(req)).status, 403);
});

test('legacy demo sessions cannot become admin even with the owner email', async () => {
  const token = 'a'.repeat(64);
  sql.prepare('INSERT INTO test_sessions(token_hash,user_id,display_name,email,space,expires_at) VALUES(?,?,?,?,?,?)')
    .run(await tokenHash(token), 'owner-id', 'Demo', 'owner@example.test', 'pf', new Date(Date.now() + 60000).toISOString());
  await assertAdminDenied('clareia_session=' + token);
});

test('the enrolled owner must finish the required first password change', async () => {
  signIn('owner-id', 'owner@example.test', true);
  await assertAdminDenied();
});

test('missing ID configuration also denies administrative endpoints', async () => {
  signIn();
  delete env.TRIAL_ADMIN_USER_ID;
  await assertAdminDenied();
});

test('the enrolled owner can manage access and recovery requests', async () => {
  signIn();
  const now = Date.now();
  sql.prepare('INSERT INTO verification(id,identifier,value,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run('recovery-request-1', 'support-reset-link:customer-id', 'https://clareia.test/redefinir-senha?token=test', now + 60000, now, now);
  assert.equal((await access.GET(request('admin/access'))).status, 200);
  const recoveryResponse = await recovery.GET(request('admin/recovery'));
  assert.equal(recoveryResponse.status, 200);
  assert.equal((await recoveryResponse.json()).requests.length, 1);
  assert.equal((await access.POST(request('admin/access', 'POST', { userId: 'customer-id', action: 'activate', days: 30 }))).status, 200);
  assert.equal(sql.prepare('SELECT status FROM account_access WHERE user_id=?').get('customer-id').status, 'active');
  assert.equal((await recovery.POST(request('admin/recovery', 'POST', { id: 'recovery-request-1' }))).status, 200);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM verification').get().n, 0);
});

test('the owner cannot accidentally block their own administrative account', async () => {
  signIn();
  assert.equal((await access.POST(request('admin/access', 'POST', { userId: 'owner-id', action: 'block' }))).status, 409);
});

test('data responses use the same admin policy, including the expired-trial response', async () => {
  signIn();
  assert.equal((await (await data.GET(request('data'))).json()).user.isAdmin, true);
  env.TRIAL_ADMIN_USER_ID = 'other-id';
  assert.equal((await (await data.GET(request('data'))).json()).user.isAdmin, false);
  sql.prepare("UPDATE account_access SET status='expired' WHERE user_id=?").run('owner-id');
  const expired = await data.GET(request('data'));
  assert.equal(expired.status, 402);
  assert.equal((await expired.json()).user.isAdmin, false);
});

test('public registration cannot claim the reserved administrator email', async () => {
  await assert.rejects(authOptions.databaseHooks.user.create.before({ email: ' OWNER@EXAMPLE.TEST ' }), error => error.status === 'FORBIDDEN');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM job_locks').get().n, 0);
});

test('pilot capacity exempts only the pinned account and still accepts ordinary users', async () => {
  const before = authOptions.databaseHooks.user.create.before;
  const afterCreate = authOptions.databaseHooks.user.create.after;
  const input = { email: 'new@example.test' };
  assert.deepEqual(await before(input), { data: input });
  await afterCreate();
  env.PILOT_MAX_ACCOUNTS = '1';
  await assert.rejects(before(input), error => error.status === 'FORBIDDEN');
  env.PILOT_MAX_ACCOUNTS = '2';
  env.TRIAL_ADMIN_USER_ID = 'wrong-id';
  await assert.rejects(before(input), error => error.status === 'FORBIDDEN');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM job_locks').get().n, 0);
});

test('missing administrator email denies all administrative endpoints', async () => {
  delete env.TRIAL_ADMIN_EMAIL;
  signIn();
  await assertAdminDenied();
});
