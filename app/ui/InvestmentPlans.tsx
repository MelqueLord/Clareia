'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Check, PiggyBank, Trash2 } from 'lucide-react';
import type { FinanceData, InvestmentPlan, Space } from '../../lib/model';
import { categoriesFor, cents, dateLabel, id, money } from '../../lib/model';

const investmentTypes = ['Poupança', 'CDB ou RDB', 'Tesouro Direto', 'Fundos de investimento', 'Ações ou ETFs', 'Criptoativos'];

export default function InvestmentPlans({ data, space, saving, onSave }: {
  data: FinanceData;
  space: Space;
  saving: boolean;
  onSave: (next: FinanceData, action: string) => Promise<boolean>;
}) {
  const plans = (data.investmentPlans || []).filter(plan => plan.space === space);
  const categories = useMemo(() => categoriesFor(space, 'income'), [space]);
  const events = data.transactions
    .filter(transaction => transaction.space === space && ['reserve', 'release'].includes(transaction.type) && (transaction.category === 'Investimentos' || !!transaction.investmentType))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.createdAt.localeCompare(a.createdAt));
  const totals = events.reduce<Record<string, number>>((all, transaction) => {
    const type = transaction.investmentType || 'Tipo não informado';
    all[type] = (all[type] || 0) + (transaction.type === 'reserve' ? transaction.amount : -transaction.amount);
    return all;
  }, {});
  const [editing, setEditing] = useState<InvestmentPlan | null>(null);
  const [category, setCategory] = useState(categories[0] || 'Outros');
  const [mode, setMode] = useState<'fixed' | 'percent'>('fixed');
  const [value, setValue] = useState('');
  const [typeChoice, setTypeChoice] = useState('');
  const [customType, setCustomType] = useState('');
  const [message, setMessage] = useState('');

  function edit(plan: InvestmentPlan) {
    setEditing(plan);
    setCategory(plan.incomeCategory);
    setMode(plan.mode);
    setValue(plan.mode === 'fixed' ? String(plan.value / 100) : String(plan.value / 100));
    setTypeChoice(investmentTypes.includes(plan.investmentType) ? plan.investmentType : plan.investmentType ? 'Outro' : '');
    setCustomType(plan.investmentType && !investmentTypes.includes(plan.investmentType) ? plan.investmentType : '');
    setMessage('');
  }

  function clear() {
    setEditing(null);
    setMode('fixed');
    setValue('');
    setTypeChoice('');
    setCustomType('');
    setMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericValue = mode === 'fixed' ? cents(value) : Math.round(Number(value.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(numericValue) || numericValue < 1 || (mode === 'percent' && numericValue > 10000)) {
      setMessage(mode === 'fixed' ? 'Informe um valor maior que zero.' : 'Informe um percentual entre 0,01% e 100%.');
      return;
    }
    const investmentType = typeChoice === 'Outro' ? customType.trim().slice(0, 80) : typeChoice;
    if (typeChoice === 'Outro' && !investmentType) {
      setMessage('Escreva o tipo de investimento ou escolha outra opção.');
      return;
    }
    const all = data.investmentPlans || [];
    const existing = all.find(plan => plan.space === space && plan.incomeCategory === category);
    const plan: InvestmentPlan = { id: existing?.id || editing?.id || id(), space, incomeCategory: category, mode, value: numericValue, investmentType };
    const next = [...all.filter(item => item.id !== plan.id && !(item.space === space && item.incomeCategory === category)), plan];
    if (await onSave({ ...data, investmentPlans: next }, 'settings')) {
      clear();
      setMessage('Plano de investimento salvo. Ele será sugerido ao registrar uma receita desta categoria.');
    }
  }

  async function remove(plan: InvestmentPlan) {
    if (await onSave({ ...data, investmentPlans: (data.investmentPlans || []).filter(item => item.id !== plan.id) }, 'settings')) {
      if (editing?.id === plan.id) clear();
      setMessage('Plano removido. Os valores já registrados continuam no histórico.');
    }
  }

  const amountLabel = (plan: InvestmentPlan) => plan.mode === 'fixed'
    ? `${money(plan.value)} de cada receita`
    : `${(plan.value / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% de cada receita`;

  return <section id="investment-plans" className="panel investment-panel">
    <div className="section-heading"><div><h2><PiggyBank size={19}/>Investimentos</h2><p>Defina quanto pretende separar quando cada tipo de renda entrar.</p></div><span className="badge">Você decide</span></div>
    <p className="small-text muted investment-disclaimer">O Clareia registra o valor planejado e o que você já separou. Ele não transfere dinheiro nem executa aplicações.</p>

    <div className="investment-plan-list">
      {plans.map(plan => <article className="investment-plan-card" key={plan.id}>
        <div><span className="eyebrow">{plan.incomeCategory.toUpperCase()}</span><strong>{amountLabel(plan)}</strong><small>{plan.investmentType || 'Tipo de investimento não informado'}</small></div>
        <div className="investment-plan-actions"><button type="button" className="text-link" onClick={() => edit(plan)}>Editar</button><button type="button" className="text-link" onClick={() => void remove(plan)} disabled={saving} aria-label={`Remover plano para ${plan.incomeCategory}`}><Trash2 size={14}/> Remover</button></div>
      </article>)}
      {!plans.length && <p className="investment-empty">Ainda não há planos. Crie um para o salário ou outra categoria de renda.</p>}
    </div>

    <form className="investment-plan-form" onSubmit={submit}>
      <div className="investment-form-heading"><h3>{editing ? 'Editar plano' : 'Planejar um investimento'}</h3>{editing && <button type="button" className="text-link" onClick={clear}>Cancelar</button>}</div>
      <div className="form-grid">
        <label>Quando esta receita entrar<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Quanto pretende separar?<select value={mode} onChange={event => { setMode(event.target.value as 'fixed' | 'percent'); setValue(''); }}><option value="fixed">Valor fixo por recebimento</option><option value="percent">Percentual da receita</option></select></label>
      </div>
      <label>{mode === 'fixed' ? 'Valor a separar (R$)' : 'Percentual da receita (%)'}<input required type="number" min="0.01" max={mode === 'percent' ? '100' : undefined} step="0.01" inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} placeholder={mode === 'fixed' ? 'Ex.: 300,00' : 'Ex.: 10'}/></label>
      <label>Tipo de investimento <span className="muted">(opcional)</span><select value={typeChoice} onChange={event => setTypeChoice(event.target.value)}><option value="">Ainda não decidi</option>{investmentTypes.map(item => <option key={item}>{item}</option>)}<option value="Outro">Outro</option></select></label>
      {typeChoice === 'Outro' && <label>Qual tipo de investimento?<input value={customType} onChange={event => setCustomType(event.target.value)} maxLength={80} placeholder="Escreva o nome"/></label>}
      <p className="small-text muted">O valor será sugerido no próximo lançamento de receita. Você poderá ajustar ou desmarcar antes de salvar.</p>
      {message && <p className="guided-message" role="status">{message}</p>}
      <button className="button primary" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar plano' : 'Adicionar plano'} <ArrowRight size={15}/></button>
    </form>

    <div className="investment-history">
      <div className="investment-history-heading"><div><h3><Check size={16}/>Valores separados</h3><p>Somente registros confirmados de investimentos.</p></div><strong>{money(Object.values(totals).reduce((sum, total) => sum + total, 0))}</strong></div>
      {events.length ? <div className="investment-event-list">{events.slice(0, 8).map(transaction => <div className="investment-event" key={transaction.id}><span><strong>{transaction.investmentType || 'Tipo não informado'}</strong><small>{transaction.description} · {dateLabel(transaction.dueDate)}</small></span><b className={transaction.type === 'release' ? 'muted' : ''}>{transaction.type === 'release' ? '− ' : '+ '}{money(transaction.amount)}</b></div>)}</div> : <p className="investment-empty">Quando confirmar uma separação para investimento, ela aparecerá aqui.</p>}
    </div>
  </section>;
}
