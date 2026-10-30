import { pathToFileURL } from 'node:url';

// Anonymous, read-only checks. Never signs in, creates accounts or sends email.
export async function smoke(base, fetcher = fetch) {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Informe apenas a origem do aplicativo, sem credenciais, caminho ou parâmetros.');
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Use HTTPS; HTTP é permitido somente no ambiente local.');
  }
  const cases = [
    ['/', 200, 'text/html'],
    ['/privacidade', 200, 'text/html'],
    ['/excluir-conta', 200, 'text/html'],
    ['/suporte', 200, 'text/html'],
    ['/redefinir-senha', 200, 'text/html'],
    ['/manifest.webmanifest', 200, 'json'],
    ['/sw.js', 200, 'javascript'],
    ['/api/data', 401, 'application/json'],
    ['/api/data/export', 401, 'application/json'],
    ['/api/admin/access', 403, 'application/json'],
    ['/api/admin/recovery', 403, 'application/json'],
    ['/api/auth/get-session', 200, 'application/json'],
  ];
  const results = [];
  for (const [path, expected, type] of cases) {
    const issues = [];
    let status = null;
    try {
      const response = await fetcher(new URL(path, url), {
        redirect: 'manual', credentials: 'omit', cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: type === 'text/html' ? 'text/html' : '*/*' },
      });
      status = response.status;
      if (status !== expected) issues.push(`HTTP ${status}; esperado ${expected}`);
      if (!response.headers.get('content-type')?.includes(type)) issues.push('Content-Type inesperado');
      if (path === '/' || path.startsWith('/api/')) {
        if (response.headers.get('x-content-type-options') !== 'nosniff') issues.push('nosniff ausente');
        if (!response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'")) issues.push('CSP de enquadramento ausente');
        if (url.protocol === 'https:' && !response.headers.get('strict-transport-security')) issues.push('HSTS ausente');
      }
      if (path.startsWith('/api/') && path !== '/api/auth/get-session' && !response.headers.get('cache-control')?.includes('no-store')) {
        issues.push('no-store ausente');
      }
      if (path === '/api/auth/get-session') {
        if ((await response.text()).trim() !== 'null') issues.push('Sessão anônima inesperada');
      } else await response.body?.cancel();
    } catch {
      // Do not print response bodies, cookies, tokens or network exception URLs.
      issues.push('Falha de conexão ou tempo limite');
    }
    results.push({ path, status, ok: issues.length === 0, issues });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const base = process.argv[2];
    if (!base) throw new Error('Uso: npm run smoke:homologation -- https://endereco-do-app');
    const results = await smoke(base);
    for (const result of results) console.log(`${result.ok ? 'OK' : 'FALHA'} ${result.path}${result.issues.length ? ': ' + result.issues.join('; ') : ''}`);
    console.log(`${results.filter(result => result.ok).length}/${results.length} verificações HTTP aprovadas. Autenticação e jornada de usuário exigem validação separada.`);
    process.exitCode = results.every(result => result.ok) ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
