const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { createRuntime } = require('./helpers/runtime.cjs');
const runtime = createRuntime();
after(() => runtime.close());
const { emptyData, normalizeMonthlyGoals } = runtime.loadSource('lib/model.ts');
const { forecast, balances, reserve, monthlyGoalFlows } = runtime.loadSource('lib/engine.ts');
const { availableToSpend, businessView, comparePurchase, answerQuestion } = runtime.loadSource('lib/intelligence.ts');
const { parseVoiceBatch } = runtime.loadSource('lib/voice.ts');

const asOf='2026-10-21';function d(){const x=emptyData();x.configured=true;x.accounts=[{id:'pf',name:'Principal',bank:'Nubank',space:'pf',balance:100000,openingDate:'2026-10-01'},{id:'mei',name:'Negócio',bank:'Inter',space:'mei',balance:100000,openingDate:'2026-10-01'}];x.preferences.pf={floor:20000,complete:true,checkedOn:asOf,monthlyGoalsReviewed:true};x.preferences.mei={floor:20000,complete:true,checkedOn:asOf,monthlyGoalsReviewed:true};x.budgets=[{id:'food',space:'pf',category:'Alimentação',limit:30000}];return x;}
 function tx(extra={}){return {id:crypto.randomUUID(),description:'Teste',amount:10000,type:'expense',category:'Alimentação',date:asOf,dueDate:asOf,paid:true,estimated:false,accountId:'pf',toAccountId:'',cardId:'',space:'pf',installments:1,recurring:false,source:'manual',createdAt:asOf+'T12:00:00Z',...extra};}
 test('metas mensais completam o total e preservam centavos',()=>{const x=d();x.transactions=[tx()];const rows=monthlyGoalFlows(x,'pf',asOf,'2026-11-01');assert.equal(rows.reduce((s,e)=>s-e.amount,0),20000);assert.equal(forecast(x,'pf',asOf).months[0].balance,70000);assert.ok(rows.every(e=>e.date>=asOf));});
 test('metas mensais não duplicam compra no cartão nem recorrência',()=>{const x=d();x.transactions=[tx({cardId:'card',paid:false,amount:30000,dueDate:'2026-11-01'})];assert.equal(monthlyGoalFlows(x,'pf',asOf,'2026-11-01').length,0);x.transactions=[tx({amount:30000,recurring:true})];assert.equal(monthlyGoalFlows(x,'pf',asOf,'2026-12-01').length,0);});
 test('margem não antecipa renda e exige metas mensais conferidas',()=>{const x=d();x.transactions=[tx({amount:50000,type:'income',paid:false,dueDate:'2026-10-25'}),tx({amount:900000,type:'income',paid:false,estimated:true,dueDate:'2026-10-23'})];const a=availableToSpend(x,'pf',asOf);assert.equal(a.end,'2026-10-25');assert.equal(a.monthlyGoals,10911);assert.equal(a.available,69089);x.preferences.pf.monthlyGoalsReviewed=false;assert.equal(availableToSpend(x,'pf',asOf).available,null);});
 test('sem renda usa 30 dias; fim de mês cobre metas mensais futuras',()=>{const x=d();const a=availableToSpend(x,'pf',asOf);assert.equal(a.end,'2026-11-20');assert.equal(a.days,30);assert.equal(a.monthlyGoals,49000);assert.equal(a.available,31000);});
 test('separar reserva não cria despesa nem altera o banco',()=>{const x=d();x.budgets=[];x.transactions=[tx({type:'reserve',amount:15000}),tx({type:'release',amount:5000})];assert.equal(balances(x,asOf).pf,100000);assert.equal(availableToSpend(x,'pf',asOf).available,70000);assert.equal(reserve(x,'pf',asOf),70000);});
 test('MEI separa recebíveis, estimativas e retirada',()=>{const x=d();x.transactions=[tx({space:'mei',accountId:'mei',type:'income',paid:false,amount:20000}),tx({space:'mei',accountId:'mei',type:'income',paid:false,estimated:true,amount:90000}),tx({space:'mei',accountId:'mei',type:'transfer',toAccountId:'pf',amount:10000})];const b=businessView(x,asOf);assert.equal(b.receivable,20000);assert.equal(b.estimated,90000);assert.equal(b.withdrawn,10000);assert.equal(b.withdrawal,70000);});
 test('comparação mostra falta de margem e parcelas fora do horizonte',()=>{const x=d();x.budgets=[];const c=comparePurchase(x,'pf',asOf,120000,12,'2026-11-01',110000);assert.equal(c.cash.gap,30000);assert.equal(c.installments.outside,70000);assert.ok(c.maxTotal<=120000);assert.equal(c.reliable,true);});
 test('voz composta mantém três movimentos e conta não vira cartão',()=>{const x=d();x.cards=[{id:'c',space:'pf',name:'Nubank',accountId:'pf',limit:200000,closingDay:20,dueDay:1}];const v=parseVoiceBatch('Recebi 800 de um cliente hoje, paguei 150 de material hoje e separei 100 para reserva hoje',x,'mei',asOf);assert.equal(v.length,3);assert.deepEqual(v.map(t=>t.type),['income','expense','reserve']);assert.deepEqual(v.map(t=>t.amount),[80000,15000,10000]);const a=parseVoiceBatch('Paguei 20 reais hoje na conta Nubank',x,'pf',asOf)[0];assert.equal(a.cardId,'');assert.equal(a.accountId,'pf');assert.equal(v[0].accountId,'mei');assert.ok(v.every(row=>row.needsReview));});
 test('consulta explica dados sem modificá-los',()=>{const x=d(),before=JSON.stringify(x);assert.match(answerQuestion('Quanto posso gastar?',x,'pf',asOf),/disponíveis/);assert.equal(answerQuestion('Gastei 20 reais',x,'pf',asOf),null);assert.equal(JSON.stringify(x),before);});


test('dados legados migram para metas mensais sem duplicar nem modificar o original', () => {
  const original = emptyData();
  original.budgets = [{ id: 'existing', space: 'pf', category: 'Alimentação', limit: 10000 }];
  original.preferences.pf = { floor: 20000, complete: true, checkedOn: asOf, essentialsReviewed: true, essentials: [{ category: 'Alimentação', monthly: 30000 }] };
  const before = JSON.stringify(original);
  const migrated = normalizeMonthlyGoals(original);
  assert.equal(migrated.budgets.length, 1);
  assert.equal(migrated.budgets[0].id, 'existing');
  assert.equal(migrated.budgets[0].limit, 30000);
  assert.equal(migrated.preferences.pf.monthlyGoalsReviewed, true);
  assert.equal(migrated.preferences.pf.essentials, undefined);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(normalizeMonthlyGoals(migrated), migrated);
});

test('migração não marca metas como conferidas contra uma escolha explícita', () => {
  const original = d();
  original.preferences.pf.monthlyGoalsReviewed = false;
  original.preferences.pf.essentialsReviewed = true;
  const migrated = normalizeMonthlyGoals(original);
  assert.equal(migrated.preferences.pf.monthlyGoalsReviewed, false);
  assert.equal(availableToSpend(migrated, 'pf', asOf).available, null);
  assert.equal(reserve(migrated, 'pf', asOf), null);
});
