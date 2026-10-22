'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, PiggyBank, Target, Trash2 } from 'lucide-react';
import type { FinanceData, SavingsGoal, Space } from '../../lib/model';
import { addMonths, cents, id, money } from '../../lib/model';
import { goalPlan } from '../../lib/savings';

export default function SavingsGoals({ data, space, asOf, saving, onSave, onContribute }: {
  data: FinanceData;
  space: Space;
  asOf: string;
  saving: boolean;
  onSave: (next: FinanceData, action: string) => Promise<boolean>;
  onContribute: (goal: SavingsGoal) => void;
}) {
  const goals = useMemo(() => (data.savingsGoals || []).filter(goal => goal.space === space), [data.savingsGoals, space]);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState(addMonths(asOf, 3));
  const [message, setMessage] = useState('');

  function startEdit(goal: SavingsGoal) {
    setEditing(goal);
    setName(goal.name);
    setTarget(String(goal.target / 100));
    setTargetDate(goal.targetDate);
  }

  function clearForm() {
    setEditing(null);
    setName('');
    setTarget('');
    setTargetDate(addMonths(asOf, 3));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = cents(target);
    if (!Number.isSafeInteger(value) || value < 1 || !name.trim()) {
      setMessage('Informe o nome da meta e um valor maior que zero.');
      return;
    }
    if (targetDate < asOf) {
      setMessage('Escolha uma data de conclusão a partir de hoje.');
      return;
    }
    const goal: SavingsGoal = { id: editing?.id || id(), space, name: name.trim().slice(0, 100), target: value, targetDate };
    const all = data.savingsGoals || [];
    const nextGoals = editing ? all.map(current => current.id === editing.id ? goal : current) : [...all, goal];
    if (await onSave({ ...data, savingsGoals: nextGoals }, 'settings')) {
      setMessage(editing ? 'Meta atualizada. O progresso continua ligado às reservas registradas.' : 'Meta criada. Separe valores e associe os lançamentos a ela para acompanhar o progresso.');
      clearForm();
    }
  }

  async function remove(goal: SavingsGoal) {
    const all = data.savingsGoals || [];
    const nextGoals = all.filter(current => current.id !== goal.id);
    const transactions = data.transactions.map(transaction => transaction.goalId === goal.id ? { ...transaction, goalId: undefined } : transaction);
    if (await onSave({ ...data, savingsGoals: nextGoals, transactions }, 'settings')) {
      setMessage('Meta encerrada. Os valores seguem registrados na reserva geral.');
      if (editing?.id === goal.id) clearForm();
    }
  }

  return <section className="panel savings-goals">
    <div className="section-heading"><div><h2><Target size={19}/>Metas para guardar dinheiro</h2><p>Escolha um objetivo e acompanhe o que já separou.</p></div><span className="badge">Seu ritmo, seus planos</span></div>
    <div className="goal-list">{goals.map(goal => {
      const plan = goalPlan(data, goal, asOf);
      return <article className="goal-card" key={goal.id}><div className="goal-card-top"><span className="goal-icon">{plan.complete ? <CheckCircle2 size={20}/> : <PiggyBank size={20}/>}</span><div className="goal-title"><h3>{goal.name}</h3><small>Até {new Date(goal.targetDate + 'T12:00:00').toLocaleDateString('pt-BR')}</small></div><button className="text-link" type="button" onClick={() => startEdit(goal)}>Editar meta</button></div><div className="goal-progress-label"><strong>{money(plan.saved)} <span>de {money(goal.target)}</span></strong><b>{plan.progress}%</b></div><div className="progress goal-progress"><span style={{ width: `${plan.progress}%` }}/></div><p>{plan.complete ? 'Objetivo alcançado. Parabéns por manter esse valor separado.' : `Faltam ${money(plan.remaining)}. Para chegar até a data, o ritmo sugerido é ${money(plan.monthly)} por mês.`}</p><button className="button secondary" type="button" onClick={() => onContribute(goal)}>{plan.complete ? 'Registrar outro valor separado' : 'Separar um valor para esta meta'} <ArrowRight size={15}/></button><button className="goal-remove" type="button" onClick={() => void remove(goal)} disabled={saving} aria-label={`Encerrar meta ${goal.name}`}><Trash2 size={14}/> Encerrar meta</button></article>;
    })}</div>
    {!goals.length && <div className="goal-empty"><PiggyBank size={23}/><p>Você ainda não tem uma meta. Pode ser uma reserva para imprevistos, uma compra planejada ou um objetivo do negócio.</p></div>}
    <form className="goal-form" onSubmit={submit}><div className="goal-form-heading"><h3>{editing ? 'Ajustar esta meta' : 'Criar uma meta'}</h3>{editing && <button type="button" className="text-link" onClick={clearForm}>Cancelar edição</button>}</div><label>O que você quer alcançar?<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder={space === 'mei' ? 'Ex.: comprar equipamento' : 'Ex.: montar uma reserva'}/></label><div className="form-grid"><label>Valor da meta (R$)<input required inputMode="decimal" value={target} onChange={event => setTarget(event.target.value)} placeholder="0,00"/></label><label>Data desejada<input required type="date" min={asOf} value={targetDate} onChange={event => setTargetDate(event.target.value)}/></label></div><p className="small-text muted">O progresso considera apenas valores que você registrar como separados para esta meta. O Clareia não movimenta sua conta.</p>{message && <p className="guided-message" role="status">{message}</p>}<button className="button primary" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar meta'} <ArrowRight size={15}/></button></form>
  </section>;
}
