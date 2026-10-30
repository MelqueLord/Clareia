const assert = require('node:assert/strict');
const { test } = require('node:test');

test('smoke de homologação usa apenas GET anônimo e recusa redirecionamentos', async () => {
  const { smoke } = await import('../scripts/homologation-smoke.mjs');
  const requests = [];
  const results = await smoke('https://clareia.test', async (url, options) => {
    requests.push({ url, options });
    return new Response('', { status: 302, headers: { location: 'https://outro.test' } });
  });
  assert.equal(results.length, 12);
  assert.ok(results.every(result => !result.ok));
  assert.ok(requests.every(({ url, options }) => url.origin === 'https://clareia.test'
    && options.redirect === 'manual' && options.credentials === 'omit'
    && options.method === undefined && options.body === undefined && !options.headers.Cookie));
});

test('smoke recusa origens inseguras, credenciais e parâmetros antes de acessar a rede', async () => {
  const { smoke } = await import('../scripts/homologation-smoke.mjs');
  let requests = 0;
  for (const url of ['http://clareia.test', 'https://user:senha@clareia.test', 'https://clareia.test/?token=segredo', 'https://clareia.test/api/data']) {
    await assert.rejects(smoke(url, async () => { requests++; }));
  }
  assert.equal(requests, 0);
});

test('smoke distingue APIs protegidas, páginas e ausência de sessão', async () => {
  const { smoke } = await import('../scripts/homologation-smoke.mjs');
  const results = await smoke('https://clareia.test', async url => {
    const path = url.pathname;
    const api = path.startsWith('/api/');
    const session = path === '/api/auth/get-session';
    return new Response(session ? 'null' : '', {
      status: path.startsWith('/api/admin/') ? 403 : api && !session ? 401 : 200,
      headers: {
        'content-type': api ? 'application/json' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('webmanifest') ? 'application/manifest+json' : 'text/html',
        'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
        'content-security-policy': "frame-ancestors 'none'", 'strict-transport-security': 'max-age=31536000',
      },
    });
  });
  assert.ok(results.every(result => result.ok), JSON.stringify(results));
});

test('smoke reprova sucesso indevido de API privada e falhas de rede', async () => {
  const { smoke } = await import('../scripts/homologation-smoke.mjs');
  const results = await smoke('https://clareia.test', async url => {
    if (url.pathname === '/suporte') throw new Error('erro com informações privadas');
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  });
  assert.equal(results.find(result => result.path === '/api/data').ok, false);
  assert.deepEqual(results.find(result => result.path === '/suporte').issues, ['Falha de conexão ou tempo limite']);
});
