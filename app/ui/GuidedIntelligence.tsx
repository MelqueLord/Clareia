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
  const setupActive = !status.ready;
  const firstRun = setupActive && !status.steps.some(Boolean);
  const preference = data.preferences[space];
  const monthlyGoalsReviewed = !!preference.monthlyGoalsReviewed;
  const hasInvestmentPlan = (data.investmentPlans || []).some(plan => plan.space === space);
  const floorReviewed = preference.floor !== null && preference.complete && !!preference.checkedOn;
  const nextRefinement: { destination: GuideDestination; title: string; description: string } | null = !monthlyGoalsReviewed
    ? { destination: 'monthlyGoals', title: 'Definir metas mensais de gastos', description: 'Planejamento · uma meta mensal por categoria' }
    : !hasInvestmentPlan
      ? { destination: 'investments', title: 'Planejar investimentos', description: 'Planejamento · valor por salário ou outra receita' }
      : !floorReviewed
        ? { destination: 'floor', title: 'Conferir dados e piso de segurança', description: space === 'mei' ? 'Ajustes · capital de giro do negócio' : 'Ajustes · valor mínimo para manter disponível' }
        : null;
  const initialSource = space === 'pf' ? data.profiles.pf.incomeSource : data.profiles.mei.activity;
  const initialAmount = space === 'pf' ? data.profiles.pf.monthlyIncomeTarget : data.profiles.mei.monthlyRevenueTarget;
  const initialIncomePattern = data.profiles.pf.incomePattern || 'fixed';
  const [note, setNote] = useState('');
  const [source, setSource] = useState(initialSource);
  const [amount, setAmount] = useState(initialAmount === null ? '' : String(initialAmount / 100));
  const [incomePattern, setIncomePattern] = useState<'fixed'|'fixed_plus_variable'|'variable'>(initialIncomePattern);
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
    if (space === 'pf' && /horas?\s*extras?|comiss[aã]o|b[oô]nus|gratifica[cç][aã]o|renda\s+vari[aá]vel|renda\s+varia/i.test(clean)) setIncomePattern('fixed_plus_variable');
    setMessage(parsed === null ? 'A origem foi preenchida. Informe o valor mensal de referência no campo abaixo.' : 'Confira a origem, o tipo de renda e o valor antes de salvar.');
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
      ? { ...data, profiles: { ...data.profiles, pf: { ...data.profiles.pf, incomeSource: description, monthlyIncomeTarget: target, incomePattern } } }
      : { ...data, profiles: { ...data.profiles, mei: { ...data.profiles.mei, activity: description, monthlyRevenueTarget: target } } };
    if (await onSave(next, 'settings')) setMessage(space === 'pf' && incomePattern === 'fixed_plus_variable' ? 'Salário-base salvo. Registre horas extras e outros adicionais como “Extra do mês” somente quando receber.' : 'Referência de renda salva. Agora vamos cadastrar a conta ou o caixa.');
  }

  const steps = space === 'pf'
    ? ['Informe sua renda', 'Cadastre conta e saldo', 'Registre valor recebido', 'Registre uma despesa']
    : ['Informe seu faturamento', 'Cadastre conta ou caixa', 'Registre receita recebida', 'Registre um custo'];
  const step = status.currentStep;
  const currentTitle = steps[step] || 'Base inicial pronta';

  return <section className={`guided-setup panel${setupActive ? ' guided-first-run' : ''}`}>
    {setupActive && <div className="guided-first-run-badge"><Sparkles size={15}/> {firstRun ? 'COMECE AQUI' : 'PASSO A PASSO'} <span>{firstRun ? '4 etapas simples' : 'Continue na ordem indicada'}</span></div>}
    <div className="guided-heading">
      <span className="guided-icon"><Sparkles size={20}/></span>
      <div><span className="eyebrow">SEU ASSISTENTE FINANCEIRO · CENTRAL DE INTELIGÊNCIA</span><h2>{status.ready ? 'Sua base inicial está pronta.' : 'Vamos preparar suas finanças juntos.'}</h2><p>{status.ready ? 'Receitas, saldo e despesas já dão ao seu assistente uma base para acompanhar o mês e orientar os próximos passos.' : firstRun ? 'Sou seu assistente financeiro. Vou simplificar o começo e guiar uma etapa por vez. Primeiro, me conte sua renda mensal.' : 'Siga a ordem indicada. Eu abro a tela certa e explico o que informar. Você pode digitar ou ditar.'}</p></div>
    </div>
    <div className="guided-progress-row"><div className="guided-progress"><span style={{ width: `${status.percent}%` }}/></div><strong>{status.ready ? '4 de 4 etapas' : `Etapa ${step + 1} de 4`}</strong></div>
    <div className="guided-checklist" aria-label="Etapas para organizar suas finanças">
      {steps.map((label, index) => <button type="button" key={label} className={`guided-check ${status.steps[index] ? 'done' : index === step ? 'current' : ''}`} aria-current={index === step ? 'step' : undefined} title={`Ir para: ${label}`} onClick={() => onNavigate((['profile', 'account', 'income', 'expense'] as GuideDestination[])[index])}><span>{status.steps[index] ? <Check size={14}/> : index + 1}</span><small>{label}</small><ArrowRight size={13} aria-hidden="true"/></button>)}
    </div>

    {!status.ready && <div className="guided-current-step">
      <div className="guided-step-title">{space === 'mei' ? <Building2 size={18}/> : <Wallet size={18}/>}<div><span className="eyebrow">PRÓXIMO DADO</span><h3>{currentTitle}</h3></div></div>
      {step === 0 && <form onSubmit={saveIncomeProfile}>
        <p className="muted">{firstRun ? 'Informe de onde vem o dinheiro e seu valor mensal de referência. Pode escrever ou ditar.' : space === 'pf' ? 'Conte de onde vem sua renda e informe o valor mensal de referência. Se ainda não recebe, informe 0.' : 'Conte o que o MEI vende ou presta e quanto espera faturar por mês. Se ainda não faturou, informe 0.'}</p>
        <label className="guided-note-label">Escreva ou dite em uma frase<textarea value={note} rows={2} onChange={event => setNote(event.target.value)} placeholder={space === 'pf' ? 'Ex.: Recebo R$ 3.500 por mês de salário' : 'Ex.: Faço bolos e faturo cerca de R$ 4.000 por mês'}/></label>
        <div className="guided-note-actions"><button type="button" className={`button secondary ${listening ? 'listening-button' : ''}`} onClick={record}>{listening ? <Square size={16}/> : <Mic size={16}/>} {listening ? 'Parar de ouvir' : 'Ditar'}</button><button type="button" className="text-link" disabled={!note.trim()} onClick={applySentence}>Preencher os campos <ArrowRight size={14}/></button></div>
        {space === 'pf' && <label>Como sua renda funciona?<select value={incomePattern} onChange={event => setIncomePattern(event.target.value as typeof incomePattern)}><option value="fixed">Tenho um salário ou valor fixo</option><option value="fixed_plus_variable">Tenho uma base fixa e alguns meses recebo extras</option><option value="variable">Minha renda varia de um mês para outro</option></select></label>}
        <div className="form-grid guided-fields"><label>{space === 'pf' ? 'Principal fonte de renda' : 'Atividade que gera faturamento'}<input value={source} onChange={event => setSource(event.target.value)} maxLength={space === 'pf' ? 80 : 120} required placeholder={space === 'pf' ? 'Salário, autônomo, benefício…' : 'Serviços, vendas, alimentação…'}/></label><label>{space === 'pf' ? incomePattern === 'fixed_plus_variable' ? 'Salário-base mensal (R$)' : incomePattern === 'variable' ? 'Média mensal de referência (R$)' : 'Renda mensal esperada (R$)' : 'Faturamento mensal esperado (R$)'}<MoneyInput value={amount} onChange={setAmount} required placeholder="0,00"/></label></div>
        {space === 'pf' && incomePattern === 'fixed_plus_variable' && <p className="small-text muted">Informe só o salário-base aqui. Horas extras, comissão, bônus e adicionais serão lançados à parte, no mês em que entrarem.</p>}
        {space === 'pf' && incomePattern === 'variable' && <p className="small-text muted">Use uma média aproximada como referência. Lance cada recebimento pelo valor real quando entrar.</p>}
        <p className="small-text muted">A transcrição pode usar o serviço de voz do navegador. O áudio não é armazenado; revise os campos antes de salvar.</p>
        {message && <p className="guided-message" role="status">{message}</p>}
        <button className="button primary" disabled={saving || listening}>{saving ? 'Salvando…' : 'Salvar e continuar'} <ArrowRight size={16}/></button>
      </form>}
      {step === 1 && <div className="guided-action"><p className="muted">Cadastre uma conta bancária, carteira ou caixa do negócio e informe o saldo de hoje. Esse saldo será o ponto de partida das projeções.</p><button className="button primary" onClick={onAddAccount}>Cadastrar conta ou caixa <ArrowRight size={16}/></button></div>}
      {step === 2 && <div className="guided-action"><p className="muted">Se já recebeu salário ou outra renda neste mês, use a data em que o dinheiro entrou e marque “Já recebi”. Se ainda vai entrar, deixe como pendente.</p><button className="button primary" onClick={() => onAddTransaction('income')}>Registrar recebimento deste mês <ArrowRight size={16}/></button></div>}
      {step === 3 && <div className="guided-action"><p className="muted">Começou no meio do mês? Cadastre também as contas que já pagou, com as datas reais, e marque “Já paguei”. Compromissos futuros ficam pendentes.</p><button className="button primary" onClick={() => onAddTransaction('expense')}>Registrar contas pagas ou futuras <ArrowRight size={16}/></button></div>}
      {message && step !== 0 && <p className="guided-message" role="status">{message}</p>}
    </div>}

    {status.ready && <div className="guided-ready"><CheckCircle2 size={22}/><div><strong>Seu assistente já pode acompanhar suas finanças.</strong><p>Continue registrando movimentos para atualizar as projeções. As orientações ficam mais úteis conforme você completa os dados pessoais ou do MEI e define suas metas mensais.</p></div><button className="button primary" onClick={onGoHome}>Abrir visão geral <ArrowRight size={16}/></button></div>}
    {status.ready && <div className="guided-later">
      <div><span className="eyebrow">DEPOIS DA BASE INICIAL</span><h3>{nextRefinement ? 'Seu próximo passo' : 'Tudo em dia'}</h3><p>{nextRefinement ? 'Uma orientação por vez. O próximo item aparece depois que você concluir este.' : 'Metas, investimentos e piso de segurança já foram revisados.'}</p></div>
      {nextRefinement ? <button type="button" className="guided-later-link" onClick={() => onNavigate(nextRefinement.destination)}><span className="guided-later-status">5</span><span><strong>{nextRefinement.title}</strong><small>{nextRefinement.description}</small></span><ArrowRight size={15}/></button> : <div className="guided-later-complete"><CheckCircle2 size={18}/><span>Sem outra etapa pendente agora.</span></div>}
    </div>}
    {!status.ready && <div className="guided-footnote">Você pode pausar e voltar a esta central quando quiser. Dados só são salvos depois que você confirma cada etapa.</div>}
    {status.ready && <button className="guided-refine-link" onClick={onOpenSettings}>Refinar perfil e preferências <ArrowRight size={14}/></button>}
  </section>;
}
