const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { createRuntime, request } = require('./helpers/runtime.cjs');
const runtime = createRuntime();
after(() => runtime.close());
const { emptyData, addMonths, firstCardDue } = runtime.loadSource('lib/model.ts');
const { balances, invoiceRows, invoiceOutstanding, forecast, spending, analyze, reserve } = runtime.loadSource('lib/engine.ts');
const { parseVoice } = runtime.loadSource('lib/voice.ts');
const { dataSchema } = runtime.loadSource('lib/validation.ts');

const day='2026-10-21';
function data(){const d=emptyData();d.configured=true;d.accounts=[{id:'a',name:'Principal',bank:'Nubank',space:'pf',balance:100000,openingDate:'2026-10-01'},{id:'b',name:'Empresa',bank:'Inter',space:'mei',balance:100000,openingDate:'2026-10-01'}];d.preferences.pf={floor:20000,complete:true,checkedOn:day,monthlyGoalsReviewed:true};return d;}
function tx(extra={}){return {id:crypto.randomUUID(),description:'Teste',amount:10000,type:'expense',category:'Alimentação',date:day,dueDate:day,paid:true,estimated:false,accountId:'a',toAccountId:'',cardId:'',space:'pf',installments:1,recurring:false,source:'manual',createdAt:day+'T12:00:00Z',...extra};}
test('datas de fim de mês e ciclo de cartão',()=>{assert.equal(addMonths('2026-01-31',1),'2026-02-28');const c={closingDay:23,dueDay:1};assert.equal(firstCardDue('2026-10-22',c),'2026-11-01');assert.equal(firstCardDue('2026-10-23',c),'2026-12-01');});
test('parcelas preservam todos os centavos',()=>{const d=data();d.transactions=[tx({cardId:'c',amount:10001,installments:3,dueDate:'2026-11-01',paid:false})];assert.deepEqual(['2026-11','2026-12','2027-01'].map(m=>invoiceRows(d,'c',m)[0].amount),[3334,3334,3333]);});
test('fatura não duplica despesa nem baixa caixa antes de pagar',()=>{const d=data();d.cards=[{id:'c',name:'Cartão',space:'pf',accountId:'a',limit:500000,closingDay:23,dueDay:1}];d.transactions=[tx({cardId:'c',paid:false,amount:30000,dueDate:'2026-11-01',installments:3})];assert.equal(balances(d,day).a,100000);d.transactions.push(tx({cardId:'c',type:'card_payment',date:'2026-11-01',amount:10000}));assert.equal(spending(d,'pf','2026-10').total,30000);assert.equal(balances(d,day).a,90000);assert.equal(invoiceOutstanding(d,'c','2026-11'),0);assert.equal(forecast(d,'pf',day).months[1].expense,0);});
test('transferência mantém total e separa PF/MEI',()=>{const d=data();d.transactions=[tx({type:'transfer',toAccountId:'b'})];const b=balances(d,day);assert.equal(b.a,90000);assert.equal(b.b,110000);assert.equal(spending(d,'pf','2026-10').total,0);});
test('receita estimada não financia despesas projetadas',()=>{const d=data();d.transactions=[tx({type:'income',paid:false,estimated:true,amount:500000,dueDate:'2026-11-01'}),tx({amount:150000,paid:false,dueDate:'2026-11-03'})];const f=forecast(d,'pf',day);assert.equal(f.lowest,-50000);assert.equal(f.deficitDate,'2026-11-03');assert.equal(f.months[1].estimated,500000);});
test('saldo já negativo gera aviso mesmo sem lançamentos',()=>{const d=data();d.accounts[0].balance=-100;assert.equal(forecast(d,'pf',day).deficitDate,day);assert.ok(analyze(d,'pf',day).some(i=>i.id.startsWith('cash-')));});
test('reserva exige piso e conferência recente',()=>{const d=data();assert.equal(reserve(d,'pf',day),80000);d.preferences.pf.monthlyGoalsReviewed=false;assert.equal(reserve(d,'pf',day),null);d.preferences.pf.monthlyGoalsReviewed=true;d.preferences.pf.floor=null;assert.equal(reserve(d,'pf',day),null);d.preferences.pf.floor=20000;d.preferences.pf.checkedOn='2026-10-01';assert.equal(reserve(d,'pf',day),null);});
test('orçamento e aumento histórico têm evidências',()=>{const d=data();d.budgets=[{id:'food',space:'pf',category:'Alimentação',limit:8000}];d.transactions=[tx({amount:16000}),...[1,2,3].map(n=>tx({amount:8000,date:addMonths(day,-n),dueDate:addMonths(day,-n)}))];const a=analyze(d,'pf',day);assert.ok(a.some(i=>i.id.startsWith('budget-')&&i.evidence.length===1));assert.ok(a.some(i=>i.id.startsWith('trend-')&&i.title.includes('100%')));});
test('voz reconhece português, sinaliza a data inferida e não escolhe entre contas ambíguas',()=>{let v=parseVoice('Gastei trinta e oito reais e cinquenta centavos no mercado hoje na conta principal',data(),'pf',day);assert.equal(v.amount,3850);assert.equal(v.date,day);assert.equal(v.accountId,'a');v=parseVoice('Paguei 50 reais',data(),'pf',day);assert.equal(v.date,day);assert.equal(v.dateWasInferred,true);assert.equal(v.needsReview,true);assert.ok(v.reviewHints.some(h=>h.includes('data')));assert.equal(v.accountId,'a');const ambiguous=data();ambiguous.accounts.push({...ambiguous.accounts[0],id:'other',name:'Outra',bank:'Caixa'});assert.equal(parseVoice('Paguei 50 reais',ambiguous,'pf',day).accountId,'');});
test('validação rejeita conta cruzada, data inválida e estimativa paga',()=>{for(const bad of [{accountId:'b'},{date:'2026-02-30'},{type:'income',estimated:true}]){const d=data();d.transactions=[tx(bad)];assert.equal(dataSchema.safeParse(d).success,false);}});

function apiRuntime(t) {
  const instance = createRuntime();
  t.after(() => instance.close());
  return instance;
}
function saveRequest(cookie, data, revision = 0, mutationId = crypto.randomUUID()) {
  return request('data', { method: 'POST', cookie, body: { data, revision, mutationId, action: 'settings' } });
}

test('API exige sessão individual e mantém encerrado o login compartilhado', async t => {
  const rt = apiRuntime(t), api = rt.loadSource('app/api/data/route.ts');
  const demoAuth = rt.loadSource('app/api/auth/route.ts');
  assert.equal((await api.GET(request('data'))).status, 401);
  assert.equal((await api.POST(saveRequest('', emptyData()))).status, 401);
  const response = await demoAuth.POST(request('auth', { method: 'POST', body: { username: 'pf@teste.clareia.app', password: 'Clareia2026!' } }));
  assert.equal(response.status, 410);
  assert.equal(response.headers.has('set-cookie'), false);
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM test_sessions').get().n, 0);
  assert.equal((await demoAuth.POST(request('auth', { method: 'POST', headers: { origin: 'https://evil.test' } }))).status, 403);
});

test('sessões individuais respeitam expiração e revogação no provedor', async t => {
  const rt = apiRuntime(t), api = rt.loadSource('app/api/data/route.ts');
  const active = rt.createSession({ id: 'active' }), expired = rt.createSession({ id: 'expired' });
  rt.sql.prepare('UPDATE session SET expires_at=0 WHERE token=?').run(expired.token);
  assert.equal((await api.GET(request('data', { cookie: expired.cookie }))).status, 401);
  const response = await api.GET(request('data', { cookie: active.cookie }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.id, 'personal:active:pf');
  rt.sql.prepare('DELETE FROM session WHERE token=?').run(active.token);
  assert.equal((await api.GET(request('data', { cookie: active.cookie }))).status, 401);
});

test('demonstrações antigas são somente leitura e o logout revoga seu token', async t => {
  const rt = apiRuntime(t), api = rt.loadSource('app/api/data/route.ts');
  const demoAuth = rt.loadSource('app/api/auth/route.ts');
  const { tokenHash } = rt.loadSource('lib/session.ts');
  const token = 'a'.repeat(64), cookie = 'clareia_session=' + token;
  rt.sql.prepare('INSERT INTO test_sessions(token_hash,user_id,display_name,email,space,expires_at) VALUES(?,?,?,?,?,?)')
    .run(await tokenHash(token), 'test_pf', 'Demo', 'pf@teste.clareia.app', 'pf', new Date(Date.now() + 60000).toISOString());
  assert.equal((await api.GET(request('data', { cookie }))).status, 200);
  assert.equal((await api.POST(saveRequest(cookie, emptyData()))).status, 403);
  assert.equal((await api.DELETE(request('data', { method: 'DELETE', cookie, headers: { 'x-confirm-delete': 'EXCLUIR' } }))).status, 403);
  const logout = await demoAuth.DELETE(request('auth', { method: 'DELETE', cookie }));
  assert.match(logout.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=0; Secure/);
  assert.equal((await api.GET(request('data', { cookie }))).status, 401);
});

test('salvamento individual é idempotente e recusa edições com revisão antiga', async t => {
  const rt = apiRuntime(t), api = rt.loadSource('app/api/data/route.ts');
  const { cookie, userId } = rt.createSession();
  const data = emptyData(), mutationId = crypto.randomUUID();
  data.profiles.pf.incomeSource = 'Renda original';
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await api.POST(saveRequest(cookie, data, 0, mutationId));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).revision, 1);
  }
  assert.equal(rt.sql.prepare('SELECT COUNT(*) AS n FROM finance_audit').get().n, 1);
  assert.equal((await api.POST(saveRequest(cookie, data))).status, 409);
  data.profiles.pf.incomeSource = 'Renda atualizada';
  assert.equal((await api.POST(saveRequest(cookie, data, 1))).status, 200);
  assert.equal((await api.POST(saveRequest(cookie, emptyData(), 1))).status, 409);
  const saved = await (await api.GET(request('data', { cookie }))).json();
  assert.equal(saved.revision, 2);
  assert.equal(saved.data.profiles.pf.incomeSource, 'Renda atualizada');
  assert.equal(rt.sql.prepare('SELECT revision FROM finance_documents WHERE user_id=?').get(userId).revision, 2);
});

test('origem e confirmação protegem a exclusão, sem afetar outro cliente', async t => {
  const rt = apiRuntime(t), api = rt.loadSource('app/api/data/route.ts');
  const clients = [rt.createSession({ id: 'a' }), rt.createSession({ id: 'b' })];
  for (const client of clients) assert.equal((await api.POST(saveRequest(client.cookie, emptyData()))).status, 200);
  const cookie = clients[0].cookie;
  assert.equal((await api.POST(request('data', { method: 'POST', cookie, headers: { origin: 'https://evil.test' }, body: {} }))).status, 403);
  assert.equal((await api.POST(request('data', { method: 'POST', cookie, headers: { 'content-type': 'text/plain' }, body: {} }))).status, 403);
  assert.equal((await api.DELETE(request('data', { method: 'DELETE', cookie }))).status, 400);
  assert.equal((await api.DELETE(request('data', { method: 'DELETE', cookie, headers: { 'x-confirm-delete': 'EXCLUIR' } }))).status, 200);
  for (const table of ['finance_documents', 'finance_snapshots', 'finance_audit']) {
    assert.equal(rt.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(clients[0].userId).n, 0);
    assert.equal(rt.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(clients[1].userId).n, 1);
  }
});

test('teste vencido bloqueia uso e gravação, mas mantém a exportação dos dados', async t => {
  const rt = apiRuntime(t), api = rt.loadSource('app/api/data/route.ts');
  const exportApi = rt.loadSource('app/api/data/export/route.ts');
  const client = rt.createSession();
  const data = emptyData(); data.profiles.pf.incomeSource = 'Dados preservados';
  assert.equal((await api.POST(saveRequest(client.cookie, data))).status, 200);
  rt.sql.prepare('UPDATE account_access SET trial_ends_at=0 WHERE user_id=?').run(client.id);
  assert.equal((await api.GET(request('data', { cookie: client.cookie }))).status, 402);
  assert.equal((await api.POST(saveRequest(client.cookie, data, 1))).status, 402);
  const response = await exportApi.GET(request('data/export', { cookie: client.cookie }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.profiles.pf.incomeSource, 'Dados preservados');
});

test('primeira senha é obrigatória nas contas novas e preserva contas legadas', async t => {
  const rt = apiRuntime(t), api = rt.loadSource('app/api/data/route.ts');
  const pending = rt.createSession({ mustChangePassword: true });
  assert.equal((await api.GET(request('data', { cookie: pending.cookie }))).status, 428);
  assert.equal((await api.POST(saveRequest(pending.cookie, emptyData()))).status, 403);
  const legacy = rt.createSession({ mustChangePassword: true, createdAt: '2026-10-01T12:00:00Z' });
  assert.equal((await api.GET(request('data', { cookie: legacy.cookie }))).status, 200);
});

test('push recusa destinos arbitrários e deduplica sinais e resumos semanais', async t => {
  const rt = apiRuntime(t), push = rt.loadSource('lib/push.ts');
  for (const endpoint of ['https://localhost/private', 'https://fcm.googleapis.com.evil.test/a', 'http://fcm.googleapis.com/a']) assert.equal(push.validPushEndpoint(endpoint), false);
  assert.equal(push.validPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  const client = rt.createSession();
  const notices = rt.loadSource('app/api/notifications/route.ts');
  assert.equal((await notices.POST(request('notifications', { method: 'POST', cookie: client.cookie, body: { endpoint: 'https://localhost/private', frequency: 'daily' } }))).status, 400);
  const notifyData = data(); notifyData.accounts[0].balance = -1;
  const decision = push.notificationDecision(notifyData, 'daily', '', '', '', day);
  assert.equal(decision.send, true);
  assert.equal(push.notificationDecision(notifyData, 'daily', decision.digest, '2026-10-20', '', day).send, false);
  assert.equal(push.notificationDecision(notifyData, 'daily', 'old', day, '', day).send, false);
  assert.equal(push.notificationDecision(data(), 'weekly', '', '', '', '2026-10-26').send, true);
  assert.equal(push.notificationDecision(data(), 'weekly', '', '', '2026-10-26', '2026-10-26').send, false);
});

test('push assina VAPID válido e não envia dados financeiros', async t => {
  const rt = apiRuntime(t), push = rt.loadSource('lib/push.ts');
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  rt.env.VAPID_PRIVATE_JWK = JSON.stringify(await crypto.subtle.exportKey('jwk', keys.privateKey));
  rt.env.VAPID_PUBLIC_KEY = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('base64url');
  let pushed;
  t.mock.method(globalThis, 'fetch', async (url, options) => { pushed = { url, options }; return new Response(null, { status: 201 }); });
  await push.sendPush('https://fcm.googleapis.com/fcm/send/test');
  const jwt = pushed.options.headers.Authorization.match(/t=([^,]+)/)[1], pieces = jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(pieces[1], 'base64url')).aud, 'https://fcm.googleapis.com');
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.publicKey, Buffer.from(pieces[2], 'base64url'), new TextEncoder().encode(pieces[0] + '.' + pieces[1])), true);
  assert.equal(pushed.options.redirect, 'error');
  assert.equal(pushed.options.body, undefined);
});

test('voz preserva centavos por extenso e em valores numéricos', () => {
  for (const phrase of ['Gastei trinta e oito reais e cinquenta centavos', 'Paguei 38 reais e 50 centavos', 'Paguei R$ 38 reais e cinquenta centavos', 'Paguei R$ 38,50']) {
    assert.equal(parseVoice(phrase, data(), 'pf', day).amount, 3850, phrase);
  }
  assert.equal(parseVoice('Paguei um real e cinquenta centavos', data(), 'pf', day).amount, 150);
  assert.equal(parseVoice('Paguei trinta e oito reais e cinco centavos', data(), 'pf', day).amount, 3805);
});

test('voz distingue conta bancária, Pix e débito de uma compra no crédito', () => {
  const fixture = data();
  fixture.cards = [{ id: 'card', name: 'Nubank', space: 'pf', accountId: 'a', limit: 200000, closingDay: 20, dueDay: 1 }];
  for (const phrase of ['Paguei 20 reais hoje na conta Nubank', 'Paguei 20 reais hoje no Pix Nubank', 'Paguei 20 reais hoje no cartão de débito Nubank']) {
    const draft = parseVoice(phrase, fixture, 'pf', day);
    assert.equal(draft.accountId, 'a', phrase);
    assert.equal(draft.cardId, '', phrase);
  }
  const credit = parseVoice('Comprei 20 reais hoje no cartão de crédito Nubank', fixture, 'pf', day);
  assert.equal(credit.cardId, 'card');
  assert.equal(credit.paymentMethod, 'credit_card');
});
