import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backup, DatabaseSync } from 'node:sqlite';

// This drill deliberately has no remote mode, credentials, or arbitrary input paths.
// SQLite files cannot be imported directly into D1; hosted recovery requires SQL export/import.
const root = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const canonical = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? { bigint: v.toString() } : v);
const expectedTables = ['account', 'account_access', 'billing_events', 'finance_audit', 'finance_documents', 'finance_snapshots', 'job_locks', 'push_subscriptions', 'rate_limit', 'session', 'test_sessions', 'user', 'verification'];
const now = 1793318400000;
const iso = new Date(now).toISOString();
const identities = ['pf', 'mei'];
const logicalId = space => `personal:drill-${space}:${space}`;
const payload = space => JSON.stringify({ space, note: "Café d'ensaio — fictício", balanceCents: 96150, transactions: [{ id: `tx-${space}`, cents: -3850 }] });

function insert(db, table, row) {
  const keys = Object.keys(row);
  db.prepare(`INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row));
}
function checkIntegrity(db) {
  assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(row => row.integrity_check), ['ok']);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
}
function state(db) {
  checkIntegrity(db);
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
  assert.deepEqual(tables, expectedTables);
  const data = {};
  for (const table of tables) {
    const statement = db.prepare(`SELECT * FROM ${quote(table)}`);
    statement.setReadBigInts(true);
    const rows = statement.all().map(row => canonical(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))).sort();
    data[table] = { rows: rows.length, sha256: hash(canonical(rows)) };
  }
  const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  return { schemaSha256: hash(canonical(schema)), tables: data };
}
function restoreVerified(archive, destination, expectedHash) {
  assert.equal(hash(readFileSync(archive)), expectedHash, 'Checksum do backup divergente');
  assert.equal(existsSync(destination), false, 'Destino de restauração deve ser novo');
  copyFileSync(archive, destination, constants.COPYFILE_EXCL);
  assert.equal(hash(readFileSync(destination)), expectedHash);
  const db = new DatabaseSync(destination);
  db.exec('PRAGMA foreign_keys=ON');
  return db;
}
function seedEarly(db, index) {
  if (index === 0) for (const space of identities) {
    insert(db, 'finance_documents', { user_id: logicalId(space), payload: payload(space), revision: space === 'pf' ? 7 : 11, mutation_id: `mutation-${space}`, updated_at: iso });
    insert(db, 'finance_snapshots', { id: `snapshot-${space}`, user_id: logicalId(space), payload: payload(space), created_at: iso });
    insert(db, 'finance_audit', { id: `audit-${space}`, user_id: logicalId(space), action: 'drill', created_at: iso });
  }
  if (index === 3) for (const space of identities) {
    insert(db, 'user', { id: `drill-${space}`, name: `Fictício ${space}`, email: `${space}@example.test`, space, created_at: now, updated_at: now });
  }
  if (index === 6) for (const space of identities) {
    insert(db, 'account_access', { user_id: `drill-${space}`, status: 'trialing', trial_started_at: now, trial_ends_at: now + 86400000 });
  }
}
function seedRemaining(db) {
  for (const space of identities) {
    const id = `drill-${space}`;
    insert(db, 'account', { id: `account-${space}`, account_id: id, provider_id: 'credential', user_id: id, password: 'synthetic-not-a-real-hash', created_at: now, updated_at: now });
    insert(db, 'session', { id: `session-${space}`, token: `synthetic-session-${space}`, user_id: id, expires_at: now + 86400000, created_at: now, updated_at: now });
    insert(db, 'test_sessions', { token_hash: `synthetic-test-${space}`, user_id: id, display_name: `Fictício ${space}`, email: `${space}@example.test`, space, expires_at: iso });
    insert(db, 'verification', { id: `verification-${space}`, identifier: `reset-password:synthetic-${space}`, value: id, expires_at: now + 3600000, created_at: now, updated_at: now });
    insert(db, 'push_subscriptions', { id: `push-${space}`, user_id: logicalId(space), endpoint: `https://push.example.test/${space}`, frequency: 'daily', last_digest: '', last_sent: '', last_week: '', attempt_at: '' });
    insert(db, 'rate_limit', { id: `limit-${space}`, key: `key-${space}`, count: 1, last_request: now });
    insert(db, 'job_locks', { id: `job-${space}`, until_at: iso });
    insert(db, 'billing_events', { id: `event-${space}`, event_type: 'synthetic', provider_payment_id: `synthetic-payment-${space}`, received_at: now });
    db.prepare('UPDATE account_access SET subscription_requested_at=?,provider_customer_id=?,provider_payment_id=? WHERE user_id=?').run(now, `synthetic-customer-${space}`, `synthetic-payment-${space}`, id);
  }
}
function excludeSyntheticPf(db) {
  // Mirrors the fact that finance ownership is namespaced and has no FK to user.
  db.exec('BEGIN');
  try {
    for (const table of ['finance_documents', 'finance_snapshots', 'finance_audit', 'push_subscriptions']) {
      db.prepare(`DELETE FROM ${quote(table)} WHERE user_id=?`).run(logicalId('pf'));
    }
    db.prepare('DELETE FROM test_sessions WHERE user_id=?').run('drill-pf');
    db.prepare('DELETE FROM verification WHERE value=?').run('drill-pf');
    db.prepare('DELETE FROM user WHERE id=?').run('drill-pf');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

async function main() {
  assert.equal(process.argv.length, 2, 'Este ensaio só aceita execução local sem argumentos');
  const parent = path.join(root, '.sites-runtime', 'database-drills');
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, 'sqlite-'));
  const reportPath = path.join(directory, 'evidence.json');
  const report = { scope: 'LOCAL_SQLITE_SYNTHETIC_ONLY', remoteDatabaseVerified: false, startedAt: new Date().toISOString(), nodeVersion: process.version, checks: [], migrations: [], limitations: ['Não executa D1 remoto, Time Travel, autenticação, envio de e-mail ou recuperação de credenciais.', 'Backup em arquivo SQLite é somente deste ensaio; D1 exige exportação/importação SQL.', 'Não comprova backup externo nem política de retenção.'] };
  const open = [];
  try {
    const db = new DatabaseSync(path.join(directory, 'source.sqlite'));
    open.push(db);
    db.exec('PRAGMA foreign_keys=ON');
    const journal = JSON.parse(readFileSync(path.join(root, 'drizzle/meta/_journal.json'), 'utf8'));
    const files = readdirSync(path.join(root, 'drizzle')).filter(file => file.endsWith('.sql')).sort();
    assert.deepEqual(files, journal.entries.map(entry => `${entry.tag}.sql`));
    for (const [index, entry] of journal.entries.entries()) {
      assert.equal(entry.idx, index);
      const sql = readFileSync(path.join(root, 'drizzle', files[index]), 'utf8');
      db.exec('BEGIN');
      try { db.exec(sql); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
      seedEarly(db, index);
      checkIntegrity(db);
      report.migrations.push({ file: files[index], sha256: hash(sql), applied: true });
    }
    assert.equal(report.migrations.length, 9);
    for (const space of identities) {
      const finance = db.prepare('SELECT * FROM finance_documents WHERE user_id=?').get(logicalId(space));
      assert.equal(finance.payload, payload(space));
      assert.equal(finance.revision, space === 'pf' ? 7 : 11);
      const user = db.prepare('SELECT * FROM user WHERE id=?').get(`drill-${space}`);
      assert.equal(user.must_change_password, 1);
      const access = db.prepare('SELECT * FROM account_access WHERE user_id=?').get(`drill-${space}`);
      for (const field of ['subscription_requested_at', 'provider_customer_id', 'provider_payment_id']) assert.equal(access[field], null);
    }
    report.checks.push('9 migrações em ordem; dados anteriores preservados; defaults e colunas novas conferidos');
    seedRemaining(db);
    report.beforeBackup = state(db);
    assert.ok(Object.values(report.beforeBackup.tables).every(table => table.rows === 2));
    const archive = path.join(directory, 'backup.sqlite');
    await backup(db, archive);
    report.backup = { file: 'backup.sqlite', bytes: readFileSync(archive).length, sha256: hash(readFileSync(archive)) };
    report.checks.push('backup SQLite criado pela API nativa; checksum SHA-256 registrado');
    excludeSyntheticPf(db);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user').get().n, 1);
    const restored = restoreVerified(archive, path.join(directory, 'restored.sqlite'), report.backup.sha256);
    open.push(restored);
    report.restored = state(restored);
    assert.deepEqual(report.restored, report.beforeBackup);
    report.checks.push('restauração em novo arquivo: esquema, índices, contagens e hash de todas as linhas das 13 tabelas idênticos');
    const corrupt = path.join(directory, 'corrupt.sqlite');
    const bytes = Buffer.from(readFileSync(archive));
    bytes[0] ^= 0xff;
    writeFileSync(corrupt, bytes);
    const rejected = path.join(directory, 'must-not-exist.sqlite');
    assert.throws(() => restoreVerified(corrupt, rejected, report.backup.sha256), /Checksum/);
    assert.equal(existsSync(rejected), false);
    assert.throws(() => restoreVerified(archive, path.join(directory, 'source.sqlite'), report.backup.sha256), /Destino/);
    report.checks.push('backup adulterado recusado antes da importação; destino existente protegido contra sobrescrita');
    // A restore reintroduces old sessions and deleted accounts. Quarantine is mandatory.
    excludeSyntheticPf(restored);
    for (const table of ['session', 'verification', 'test_sessions', 'push_subscriptions', 'job_locks']) restored.exec(`DELETE FROM ${quote(table)}`);
    checkIntegrity(restored);
    assert.deepEqual(restored.prepare('SELECT id FROM user').all().map(row => row.id), ['drill-mei']);
    assert.equal(restored.prepare('SELECT payload FROM finance_documents WHERE user_id=?').get(logicalId('mei')).payload, payload('mei'));
    for (const table of ['session', 'verification', 'test_sessions', 'push_subscriptions', 'job_locks']) assert.equal(restored.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)}`).get().n, 0);
    for (const table of ['account', 'account_access']) assert.equal(restored.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)} WHERE user_id=?`).get('drill-pf').n, 0);
    for (const table of ['finance_documents', 'finance_snapshots', 'finance_audit', 'push_subscriptions']) assert.equal(restored.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)} WHERE user_id=?`).get(logicalId('pf')).n, 0);
    report.afterQuarantine = state(restored);
    report.checks.push('exclusão posterior ao backup reaplicada; sessões e tokens antigos invalidados; MEI preservado');
    report.status = 'PASSED_LOCAL_ONLY';
  } catch (error) {
    report.status = 'FAILED';
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    for (const db of open.reverse()) db.close();
    report.finishedAt = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ status: report.status, remoteDatabaseVerified: false, migrations: report.migrations.length, checks: report.checks, evidence: reportPath, error: report.error }, null, 2));
  }
}
await main();
