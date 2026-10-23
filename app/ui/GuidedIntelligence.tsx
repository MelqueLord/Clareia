'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Mic, Sparkles, Square, Wallet, Building2 } from 'lucide-react';
import type { FinanceData, Space } from '../../lib/model';
import useSpeechCapture from './useSpeechCapture';
import MoneyInput from './MoneyInput';

export type GuideDestination = 'profile' | 'account' | 'income' | 'expense' | 'monthlyGoals' | 'investments' | 'floor';

const valueFromText = (text: string) => {
  const match = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?:\s*(mil|k))?/i);
  if (!match) return null;
  let value = match[1];
  if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}$/.test(value)) value = value.replace(/\./g, '');
  const parsed = Number(value) * (/^(mil|k)$/i.test(match[2] || '') ? 1000 : 1);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
};

export function guidedSetupStatus(data: FinanceData, space: Space) {
  const expectedIncome = space === 'pf' ? data.profiles.pf.monthlyIncomeTarget : data.profiles.mei.monthlyRevenueTarget;
  const source = space === 'pf' ? data.profiles.pf.incomeSource : data.profiles.mei.activity;
  const hasIncomePlan = !!source.trim() && expectedIncome !== null;
  const hasAccount = data.accounts.some(account => account.space === space);
  const hasIncome = data.transactions.some(transaction => transaction.space === space && transaction.type === 'income');
  const hasExpense = data.transactions.some(transaction => transaction.space === space && transaction.type === 'expense');
  const steps = [hasIncomePlan, hasAccount, hasIncome, hasExpense];
  const currentStep = steps.findIndex(done => !done);
  return { steps, ready: currentStep < 0, currentStep: currentStep < 0 ? steps.length : currentStep, percent: Math.round(steps.filter(Boolean).length / steps.length * 100) };
}

export default function GuidedIntelligence({
  data, space, saving, onSave, onAddAccount, onAddTransaction, onOpenSettings, onGoHome, onNavigate,
}: {
  data: FinanceData;
  space: Space;
  saving: boolean;
  onSave: (next: FinanceData, action: string) => Promise<boolean>;
  onAddAccount: () => void;
  onAddTransaction: (type: 'income' | 'expense') => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
  onNavigate: (destination: GuideDestination) => void;
}) {
  const status = guidedSetupStatus(data, space);
  const preference = data.preferences[space];
  const monthlyGoalsReviewed = !!preference.monthlyGoalsReviewed;
  const hasInvestmentPlan = (data.investmentPlans || []).some(plan => plan.space === space);
  const floorReviewed = preference.floor !== null && preference.complete && !!preference.checkedOn;
  const initialSource = space === 'pf' ? data.profiles.pf.incomeSource : data.profiles.mei.activity;
  const initialAmount = space === 'pf' ? data.profiles.pf.monthlyIncomeTarget : data.profiles.mei.monthlyRevenueTarget;
  const [note, setNote] = useState('');
  const [source, setSource] = useState(initialSource);
  const [amount, setAmount] = useState(initialAmount === null ? '' : String(initialAmount / 100));
  const { listening, message, setMessage, record } = useSpeechCapture(setNote);

  function applySentence() {
    const clean = note.trim();
    if (!clean) {
      setMessage('Digite ou dite de onde vem sua renda e o valor mensal aproximado.');
      return;
    }
    setSource(clean.slice(0, space === 'pf' ? 80 : 120));
    const parsed = valueFromText(clean);
    if (parsed !== null) setAmount(String(parsed / 100));
    setMessage(parsed === null ? 'A origem foi preenchida. Informe o valor mensal esperado no campo abaixo.' : 'Confira a origem e o valor que foram preenchidos antes de salvar.');
  }

  async function saveIncomeProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = amount.trim() === '' ? null : Math.round(Number(amount.replace(',', '.')) * 100);
    if (target === null || !Number.isFinite(target) || target < 0) {
      setMessage('Informe o valor mensal esperado. Se ainda não recebe, use 0.');
      return;
    }
    const description = source.trim();
    if (!description) {
      setMessage(space === 'pf' ? 'Informe a principal fonte de renda.' : 'Informe a atividade que gera ou deverá gerar faturamento.');
      return;
    }
    const next = space === 'pf'
      ? { ...data, profiles: { ...data.profiles, pf: { ...data.profiles.pf, incomeSource: description, monthlyIncomeTarget: target } } }
      : { ...data, profiles: { ...data.profiles, mei: { ...data.profiles.mei, activity: description, monthlyRevenueTarget: target } } };
    if (await onSave(next, 'settings')) setMessage('Receita de referência salva. Agora vamos cadastrar a conta ou o caixa.');
  }

  const steps = space === 'pf'
    ? ['Defina sua renda mensal', 'Cadastre uma conta e o saldo atual', 'Registre um recebimento', 'Registre uma despesa ou compromisso']
    : ['Defina seu faturamento mensal', 'Cadastre uma conta ou caixa do MEI', 'Registre um recebimento do negócio', 'Registre um custo ou compromisso'];
  const step = status.currentStep;
  const currentTitle = steps[step] || 'Base inicial pronta';

  return <section className="guided-setup panel">
    <div className="guided-heading">
      <span className="guided-icon"><Sparkles size={20}/></span>
      <div><span className="eyebrow">CENTRAL DE INTELIGÊNCIA · SEU PRÓXIMO PASSO</span><h2>{status.ready ? 'Sua base inicial está pronta.' : 'Vamos preparar suas finanças juntos.'}</h2><p>{status.ready ? 'Receitas, saldo e despesas já dão ao Clareia uma base para começar a analisar seus dados.' : 'Siga a ordem sugerida ou toque em qualquer etapa para abrir a tela. Você também pode digitar ou ditar a primeira informação aqui.'}</p></div>
    </div>
    <div className="guided-progress-row"><div className="guided-progress"><span style={{ width: `${status.percent}%` }}/></div><strong>{status.ready ? '4 de 4 etapas' : `Etapa ${step + 1} de 4`}</strong></div>
    <div className="guided-checklist" aria-label="Etapas para organizar suas finanças">
      {steps.map((label, index) => <button type="button" key={label} className={`guided-check ${status.steps[index] ? 'done' : index === step ? 'current' : ''}`} aria-current={index === step ? 'step' : undefined} title={`Ir para: ${label}`} onClick={() => onNavigate((['profile', 'account', 'income', 'expense'] as GuideDestination[])[index])}><span>{status.steps[index] ? <Check size={14}/> : index + 1}</span><small>{label}</small><ArrowRight size={13} aria-hidden="true"/></button>)}
    </div>

    {!status.ready && <div className="guided-current-step">
      <div className="guided-step-title">{space === 'mei' ? <Building2 size={18}/> : <Wallet size={18}/>}<div><span className="eyebrow">PRÓXIMO DADO</span><h3>{currentTitle}</h3></div></div>
      {step === 0 && <form onSubmit={saveIncomeProfile}>
        <p className="muted">{space === 'pf' ? 'Conte de onde vem sua renda e quanto espera receber por mês. Se sua renda ainda não começou, informe 0.' : 'Conte o que o MEI vende ou presta e quanto espera faturar por mês. Se ainda não faturou, informe 0.'}</p>
        <label className="guided-note-label">Fale ou digite sua frase<textarea value={note} rows={2} onChange={event => setNote(event.target.value)} placeholder={space === 'pf' ? 'Ex.: Recebo R$ 3.500 por mês de salário' : 'Ex.: Faço bolos e faturo cerca de R$ 4.000 por mês'}/></label>
        <div className="guided-note-actions"><button type="button" className={`button secondary ${listening ? 'listening-button' : ''}`} onClick={record}>{listening ? <Square size={16}/> : <Mic size={16}/>} {listening ? 'Parar de ouvir' : 'Ditar'}</button><button type="button" className="text-link" disabled={!note.trim()} onClick={applySentence}>Usar frase para preencher <ArrowRight size={14}/></button></div>
        <div className="form-grid guided-fields"><label>{space === 'pf' ? 'Principal fonte de renda' : 'Atividade que gera faturamento'}<input value={source} onChange={event => setSource(event.target.value)} maxLength={space === 'pf' ? 80 : 120} required placeholder={space === 'pf' ? 'Salário, autônomo, benefício…' : 'Serviços, vendas, alimentação…'}/></label><label>{space === 'pf' ? 'Renda mensal esperada (R$)' : 'Faturamento mensal esperado (R$)'}<MoneyInput value={amount} onChange={setAmount} required placeholder="0,00"/></label></div>
        <p className="small-text muted">A transcrição pode usar o serviço de voz do navegador. O áudio não é armazenado; revise os campos antes de salvar.</p>
        {message && <p className="guided-message" role="status">{message}</p>}
        <button className="button primary" disabled={saving || listening}>{saving ? 'Salvando…' : 'Salvar receita de referência'} <ArrowRight size={16}/></button>
      </form>}
      {step === 1 && <div className="guided-action"><p className="muted">Cadastre uma conta bancária, carteira ou caixa do negócio e informe o saldo de hoje. Esse saldo será o ponto de partida das projeções.</p><button className="button primary" onClick={onAddAccount}>Cadastrar conta ou caixa <ArrowRight size={16}/></button></div>}
      {step === 2 && <div className="guided-action"><p className="muted">Se já recebeu salário ou outra renda neste mês, use a data em que o dinheiro entrou e marque “Já recebi”. Se ainda vai entrar, deixe como pendente.</p><button className="button primary" onClick={() => onAddTransaction('income')}>Registrar recebimento deste mês <ArrowRight size={16}/></button></div>}
      {step === 3 && <div className="guided-action"><p className="muted">Começou no meio do mês? Cadastre também as contas que já pagou, com as datas reais, e marque “Já paguei”. Compromissos futuros ficam pendentes.</p><button className="button primary" onClick={() => onAddTransaction('expense')}>Registrar contas pagas ou futuras <ArrowRight size={16}/></button></div>}
      {message && step !== 0 && <p className="guided-message" role="status">{message}</p>}
    </div>}

    {status.ready && <div className="guided-ready"><CheckCircle2 size={22}/><div><strong>O Clareia já pode analisar sua base inicial.</strong><p>Continue registrando movimentos para refinar as projeções. Depois, complete os dados pessoais ou do MEI e defina metas mensais de gastos para receber orientações mais precisas.</p></div><button className="button primary" onClick={onGoHome}>Abrir visão geral <ArrowRight size={16}/></button></div>}
    <div className="guided-later">
      <div><span className="eyebrow">DEPOIS DA BASE INICIAL</span><h3>Deixe as orientações mais precisas</h3><p>Revise estes ajustes complementares no seu tempo.</p></div>
      <button type="button" className={`guided-later-link ${monthlyGoalsReviewed ? 'done' : ''}`} onClick={() => onNavigate('monthlyGoals')}><span className="guided-later-status">{monthlyGoalsReviewed ? <Check size={14}/> : '5'}</span><span><strong>Definir metas mensais de gastos</strong><small>{monthlyGoalsReviewed ? 'Revisadas · Planejamento' : 'Planejamento · uma meta mensal por categoria'}</small></span><ArrowRight size={15}/></button>
      <button type="button" className={`guided-later-link ${hasInvestmentPlan ? 'done' : ''}`} onClick={() => onNavigate('investments')}><span className="guided-later-status">{hasInvestmentPlan ? <Check size={14}/> : '6'}</span><span><strong>Planejar investimentos</strong><small>{hasInvestmentPlan ? 'Plano ativo · Planejamento' : 'Planejamento · valor por salário ou outra receita'}</small></span><ArrowRight size={15}/></button>
      <button type="button" className={`guided-later-link ${floorReviewed ? 'done' : ''}`} onClick={() => onNavigate('floor')}><span className="guided-later-status">{floorReviewed ? <Check size={14}/> : '7'}</span><span><strong>Conferir dados e piso de segurança</strong><small>{floorReviewed ? 'Conferido · Ajustes' : space === 'mei' ? 'Ajustes · capital de giro do negócio' : 'Ajustes · valor mínimo para manter disponível'}</small></span><ArrowRight size={15}/></button>
    </div>
    {!status.ready && <div className="guided-footnote">Você pode pausar e voltar a esta central quando quiser. Dados só são salvos depois que você confirma cada etapa.</div>}
    {status.ready && <button className="guided-refine-link" onClick={onOpenSettings}>Refinar perfil e preferências <ArrowRight size={14}/></button>}
  </section>;
}
