-- SOMENTE LEITURA. Executar apenas pelo provedor/operador autorizado no banco
-- de homologação cujo ID tenha sido confirmado. Não é uma migração ou backup.
-- Não pressupõe nome da tabela interna de histórico do provedor Sites.
SELECT type, name, tbl_name, sql FROM sqlite_schema
WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
ORDER BY type, name;
PRAGMA table_info('user');
PRAGMA table_info('account_access');
PRAGMA table_info('billing_events');
PRAGMA foreign_key_list('account');
PRAGMA foreign_key_list('session');
PRAGMA foreign_key_list('account_access');
PRAGMA integrity_check;
PRAGMA foreign_key_check;
SELECT 'account' AS tabela, COUNT(*) AS registros FROM account
UNION ALL SELECT 'account_access', COUNT(*) FROM account_access
UNION ALL SELECT 'billing_events', COUNT(*) FROM billing_events
UNION ALL SELECT 'finance_audit', COUNT(*) FROM finance_audit
UNION ALL SELECT 'finance_documents', COUNT(*) FROM finance_documents
UNION ALL SELECT 'finance_snapshots', COUNT(*) FROM finance_snapshots
UNION ALL SELECT 'job_locks', COUNT(*) FROM job_locks
UNION ALL SELECT 'push_subscriptions', COUNT(*) FROM push_subscriptions
UNION ALL SELECT 'rate_limit', COUNT(*) FROM rate_limit
UNION ALL SELECT 'session', COUNT(*) FROM session
UNION ALL SELECT 'test_sessions', COUNT(*) FROM test_sessions
UNION ALL SELECT 'user', COUNT(*) FROM user
UNION ALL SELECT 'verification', COUNT(*) FROM verification;
