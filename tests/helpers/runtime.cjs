const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createRequire } = Module;
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function createRuntime() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  try {
    for (const file of fs.readdirSync(path.join(root, 'drizzle')).filter(file => file.endsWith('.sql')).sort()) {
      sql.exec(fs.readFileSync(path.join(root, 'drizzle', file), 'utf8'));
    }
  } catch (error) { sql.close(); throw error; }
  const env = { BETTER_AUTH_SECRET: 'test-only-secret', BETTER_AUTH_URL: 'https://clareia.test' };
  env.DB = {
    prepare(query) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sql.prepare(query).get(...args) || null; },
        async all() { return { results: sql.prepare(query).all(...args) }; },
        runSync() { return { meta: { changes: sql.prepare(query).run(...args).changes } }; },
        async run() { return this.runSync(); },
      };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(statement.runSync());
        sql.exec('COMMIT');
        return results;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  const modules = new Map();
  let authOptions;
  const authApi = {
    // Test provider: sessions are read from real SQLite rows. Cookie signing and
    // password verification belong to Better Auth and need browser integration QA.
    async getSession({ headers }) {
      const token = headers.get('cookie')?.match(/(?:^|;\s*)better-auth\.session_token=([^;]+)(?:;|$)/)?.[1];
      if (!token) return null;
      const row = sql.prepare(`SELECT u.id,u.name,u.email,u.space,u.created_at AS createdAt,
        u.must_change_password AS mustChangePassword,s.id AS sessionId
        FROM session s JOIN user u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?`)
        .get(token, Date.now());
      return row ? { session: { id: row.sessionId }, user: { ...row, createdAt: new Date(row.createdAt), mustChangePassword: Boolean(row.mustChangePassword) } } : null;
    },
  };
  function loadSource(relative) {
    const filename = path.resolve(root, relative);
    if (modules.has(filename)) return modules.get(filename).exports;
    const compiled = new Module(filename, module);
    modules.set(filename, compiled);
    const nativeRequire = createRequire(filename);
    compiled.require = name => {
      if (name === 'cloudflare:workers') return { env };
      if (name === 'better-auth') return { betterAuth: options => { authOptions = options; return { api: authApi }; } };
      if (name === 'vinext/shims/request-context') return { getRequestExecutionContext: () => null };
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), name);
        if (fs.existsSync(target + '.ts')) return loadSource(target + '.ts');
      }
      return nativeRequire(name);
    };
    try {
      compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText, filename);
    } catch (error) { modules.delete(filename); throw error; }
    return compiled.exports;
  }
  function createSession({ id = randomUUID(), email = `${id}@example.test`, space = 'pf', mustChangePassword = false, createdAt = '2026-10-29T12:00:00Z' } = {}) {
    const now = Date.now(), token = randomUUID();
    sql.prepare('INSERT INTO user(id,name,email,space,must_change_password,created_at) VALUES(?,?,?,?,?,?)')
      .run(id, id, email, space, Number(mustChangePassword), Date.parse(createdAt));
    sql.prepare('INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .run(randomUUID(), token, id, now + 3600000, now, now);
    return { id, token, email, space, userId: `personal:${id}:${space}`, cookie: `better-auth.session_token=${token}` };
  }
  return { env, sql, loadSource, createSession, authApi, get authOptions() { return authOptions; }, close: () => sql.close() };
}

function request(route, { method = 'GET', body, cookie = '', headers = {} } = {}) {
  return new Request('https://clareia.test/api/' + route, {
    method, headers: { origin: 'https://clareia.test', 'content-type': 'application/json', cookie, ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

module.exports = { createRuntime, request };
