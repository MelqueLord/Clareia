'use client';

import { useState } from 'react';
import { ArrowDown, ArrowRight, Mic } from 'lucide-react';
import type { FinanceData, InvestmentPlan, Kind, Space, Transaction } from '../../lib/model';
import { categoriesFor, cents, firstCardDue, id } from '../../lib/model';
import { parseVoice, type VoiceDraft } from '../../lib/voice';
import MoneyInput from './MoneyInput';

const investmentTypes = ['Poupança', 'CDB ou RDB', 'Tesouro Direto', 'Fundos de investimento', 'Ações ou ETFs', 'Criptoativos'];

function suggestedInvestment(plan: InvestmentPlan | undefined, amountText: string) {
  if (!plan) return 0;
  const income = cents(amountText || '0');
  if (plan.mode === 'percent') return Math.max(0, Math.round(income * plan.value / 10000));
  return income > 0 ? Math.min(plan.value, income) : plan.value;
}

export default function TransactionForm({ data, space, asOf, tx, voice, initialType, initialGoalId, saving, submitLabel, onSave, onNeedAccount }: {
  data: FinanceData;
  space: Space;
  asOf: string;
  tx: Transaction | null;
  voice: VoiceDraft | null;
  initialType: Kind | null;
  initialGoalId?: string | null;
  saving: boolean;
  submitLabel?: string;
  onSave: (transaction: Transaction) => void;
  onNeedAccount: () => void;
}) {
  const [type, setType] = useState<Kind>(tx?.type || voice?.type || initialType || 'expense');
  const selectedSpace: Space = tx?.space || voice?.space || space;
  const firstIncomeCategory = categoriesFor(selectedSpace, 'income')[0] || 'Outros';
  const incomeAccounts = data.accounts.filter(account => account.space === selectedSpace);
  const isSpecialType = !['expense', 'income'].includes(type);
  const [showAdvanced, setShowAdvanced] = useState(!!tx || (!!voice && !['expense', 'income'].includes(voice.type)) || (!!initialType && !['expense', 'income'].includes(initialType)));
  const [description, setDescription] = useState(tx?.description || voice?.description || '');
  const [category, setCategory] = useState(tx?.category || voice?.category || ((voice?.type || initialType) === 'income' ? firstIncomeCategory : 'Outros'));
  const [categoryTouched, setCategoryTouched] = useState(!!tx || !!voice);
  const [goalId, setGoalId] = useState(tx?.goalId || voice?.goalId || initialGoalId || '');
  const [cardId, setCardId] = useState(tx?.cardId || voice?.cardId || '');
  const [accountId, setAccountId] = useState(tx?.accountId || voice?.accountId || (!voice && incomeAccounts.length === 1 ? incomeAccounts[0].id : ''));
  const [date, setDate] = useState(tx?.date || voice?.date || asOf);
  const [due, setDue] = useState(tx?.dueDate || voice?.dueDate || (voice?.type === 'card_payment' && voice.date ? voice.date : voice?.cardId && voice.date ? firstCardDue(voice.date, data.cards.find(card => card.id === voice.cardId)!) : voice?.date) || (initialType === 'card_debt' ? '' : asOf));
  const [paid, setPaid] = useState(tx?.paid ?? (voice ? voice.statusInferred ? voice.paid : false : true));
  const [estimated, setEstimated] = useState(tx?.estimated || false);
  const [amountText, setAmountText] = useState(tx ? String(tx.amount / 100) : voice?.amount ? String(voice.amount / 100) : '');
  const [investmentEnabled, setInvestmentEnabled] = useState((tx?.investmentAmount || 0) > 0 || (!tx && (voice?.type || initialType || type) === 'income' && !!(data.investmentPlans || []).find(plan => plan.space === selectedSpace && plan.incomeCategory === category)));
  const initialInvestmentPlan = (data.investmentPlans || []).find(plan => plan.space === selectedSpace && plan.incomeCategory === category);
  const [investmentAmount, setInvestmentAmount] = useState(tx?.investmentAmount !== undefined ? String(tx.investmentAmount / 100) : initialInvestmentPlan ? String(suggestedInvestment(initialInvestmentPlan, amountText) / 100) : '');
  const initialInvestmentKind = tx?.investmentType || initialInvestmentPlan?.investmentType || '';
  const [investmentTypeChoice, setInvestmentTypeChoice] = useState(investmentTypes.includes(initialInvestmentKind) ? initialInvestmentKind : initialInvestmentKind ? 'Outro' : '');
  const [customInvestmentType, setCustomInvestmentType] = useState(initialInvestmentKind && !investmentTypes.includes(initialInvestmentKind) ? initialInvestmentKind : '');
  const [investmentTouched, setInvestmentTouched] = useState(false);
  const [message, setMessage] = useState('');
  const card = data.cards.find(item => item.id === cardId);
  const investmentPlan = (data.investmentPlans || []).find(plan => plan.space === selectedSpace && plan.incomeCategory === category);

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    setCategoryTouched(true);
    const plan = (data.investmentPlans || []).find(item => item.space === selectedSpace && item.incomeCategory === nextCategory);
    const savedAmount = tx?.type === 'income' && tx.category === nextCategory ? tx.investmentAmount : undefined;
    setInvestmentEnabled(savedAmount !== undefined ? savedAmount > 0 : type === 'income' && !!plan);
    setInvestmentAmount(savedAmount !== undefined ? String(savedAmount / 100) : plan ? String(suggestedInvestment(plan, amountText) / 100) : '');
    setInvestmentTypeChoice(plan ? (investmentTypes.includes(plan.investmentType) ? plan.investmentType : plan.investmentType ? 'Outro' : '') : '');
    setCustomInvestmentType(plan?.investmentType && !investmentTypes.includes(plan.investmentType) ? plan.investmentType : '');
    setInvestmentTouched(false);
  }

  function chooseType(nextType: Kind) {
    if (type === 'card_debt' && nextType !== 'card_debt') setPaid(true);
    if (nextType === 'card_debt') setDue('');
    else if (type === 'card_debt') setDue(asOf);
    setType(nextType);
    if (!['expense', 'income'].includes(nextType)) setShowAdvanced(true);
    if (!['expense', 'income'].includes(nextType)) setCategoryTouched(true);
    setCardId('');
    const options = categoriesFor(selectedSpace, nextType === 'income' ? 'income' : 'expense');
    const nextCategory = options.includes(category) ? category : options[0] || 'Outros';
    setCategory(nextCategory);
    if (nextType === 'income') {
      const plan = (data.investmentPlans || []).find(item => item.space === selectedSpace && item.incomeCategory === nextCategory);
      const savedAmount = tx?.type === 'income' && tx.category === nextCategory ? tx.investmentAmount : undefined;
      setInvestmentEnabled(savedAmount !== undefined ? savedAmount > 0 : !!plan);
      setInvestmentAmount(savedAmount !== undefined ? String(savedAmount / 100) : plan ? String(suggestedInvestment(plan, amountText) / 100) : '');
      const savedType = tx?.type === 'income' && tx.category === nextCategory ? tx.investmentType || '' : plan?.investmentType || '';
      setInvestmentTypeChoice(investmentTypes.includes(savedType) ? savedType : savedType ? 'Outro' : '');
      setCustomInvestmentType(savedType && !investmentTypes.includes(savedType) ? savedType : '');
    } else {
      setInvestmentEnabled(false);
      if (nextType === 'card_debt') { setPaid(false); setEstimated(false); }
    }
    setInvestmentTouched(false);
  }

  function inferCategory() {
    if (categoryTouched || !description.trim()) return;
    const phrase = `${type === 'income' ? 'recebi' : 'gastei'} ${description}`;
    const suggested = parseVoice(phrase, data, selectedSpace, asOf).category;
    if (categoriesFor(selectedSpace, type === 'income' ? 'income' : 'expense').includes(suggested)) chooseCategory(suggested);
  }

  function changeAmount(nextAmount: string) {
    setAmountText(nextAmount);
    if (type === 'income' && investmentPlan && !investmentTouched) {
      setInvestmentAmount(String(suggestedInvestment(investmentPlan, nextAmount) / 100));
    }
  }

  function selectedInvestmentType() {
    return investmentTypeChoice === 'Outro' ? customInvestmentType.trim().slice(0, 80) : investmentTypeChoice;
  }

  return <form className="transaction-entry-form" onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const investmentValue = type === 'income' && investmentEnabled ? cents(investmentAmount || '0') : undefined;
    const transaction: Transaction = {
      id: tx?.id || id(),
      description: String(form.get('description')).trim(),
      amount: cents(amountText),
      type,
      category: String(form.get('category')),
      date,
      dueDate: type === 'card_payment' ? date : due,
      paid: cardId && type !== 'card_payment' && type !== 'card_debt' ? false : paid,
      estimated: type === 'income' && estimated,
      accountId: card?.accountId || accountId,
      toAccountId: type === 'transfer' ? String(form.get('toAccount')) : '',
      cardId,
      space: selectedSpace,
      installments: cardId && type !== 'card_payment' ? Number(form.get('installments')) || 1 : 1,
      recurring: type !== 'card_debt' && !cardId && form.get('recurring') === 'on',
      source: voice ? 'voice' : tx?.source || 'manual',
      createdAt: tx?.createdAt || new Date().toISOString(),
      goalId: ['reserve', 'release'].includes(type) && goalId ? goalId : undefined,
      investmentAmount: investmentValue,
      investmentType: (type === 'income' && investmentEnabled || ['reserve', 'release'].includes(type)) ? selectedInvestmentType() || undefined : undefined,
      sourceIncomeId: type === 'reserve' ? tx?.sourceIncomeId : undefined,
    };
    if (!transaction.amount || transaction.amount < 0) { setMessage('Informe um valor maior que zero.'); return; }
    if (transaction.paid && transaction.dueDate > asOf) { setMessage('Uma movimentação futura deve ficar como pendente.'); return; }
    if (investmentEnabled && type === 'income' && (!Number.isSafeInteger(investmentValue) || !investmentValue)) { setMessage('Informe quanto pretende separar ou desmarque a opção de investimento.'); return; }
    if (investmentValue !== undefined && investmentValue > transaction.amount) { setMessage('O valor separado não pode ser maior que esta receita.'); return; }
    if (investmentTypeChoice === 'Outro' && investmentEnabled && type === 'income' && !customInvestmentType.trim()) { setMessage('Informe o tipo de investimento ou escolha outra opção.'); return; }
    onSave(transaction);
  }}>
    {voice && <div className="voice-review-summary">
      <div className="voice-review-heading"><Mic size={16}/><strong>Entendi assim</strong><span>Confira antes de salvar</span></div>
      <div className="voice-review-tags"><span>{type === 'income' ? 'Receita' : type === 'card_debt' ? 'Parcelas' : type === 'card_payment' ? 'Fatura' : type === 'transfer' ? 'Transferência' : type === 'reserve' ? 'Reserva' : type === 'release' ? 'Resgate' : type === 'refund' ? 'Reembolso' : 'Despesa'}</span><span>{category}</span><span>{date.split('-').reverse().join('/')}{voice.dateWasInferred ? ' · hoje por padrão' : ''}</span>{voice.dueDate && voice.dueDate !== date && <span>Vence {voice.dueDate.split('-').reverse().join('/')}</span>}{voice.amount !== null && <span>R$ {(voice.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}{accountId && <span>{data.accounts.find(account => account.id === accountId)?.bank} · {data.accounts.find(account => account.id === accountId)?.name}</span>}{cardId && <span>{data.cards.find(item => item.id === cardId)?.name}</span>}</div>
      {voice.reviewHints.length > 0 && <ul>{voice.reviewHints.map(hint => <li key={hint}>{hint}</li>)}</ul>}
      {!voice.reviewHints.length && <small>Revise descrição, valor e situação. Nenhum registro é salvo sem sua confirmação.</small>}
    </div>}
    <section className="quick-entry">
      <p className="quick-entry-kicker">{selectedSpace === 'mei' ? 'Lançamento do MEI' : 'Lançamento pessoal'}</p>
      <div className="quick-type-switch" aria-label="Tipo de lançamento">
        <button type="button" className={type === 'expense' ? 'selected' : ''} aria-pressed={type === 'expense'} onClick={() => chooseType('expense')}>Despesa</button>
        <button type="button" className={type === 'income' ? 'selected' : ''} aria-pressed={type === 'income'} onClick={() => chooseType('income')}>Receita</button>
      </div>
      {isSpecialType && <div className="notice quick-special-note">Este lançamento tem campos próprios. Complete os detalhes abaixo.</div>}
      <label>{type === 'card_debt' ? 'O que foi comprado?' : type === 'income' && selectedSpace === 'pf' ? 'Salário ou outra renda' : selectedSpace === 'mei' && type === 'income' ? 'Cliente, serviço ou venda' : selectedSpace === 'mei' ? 'Fornecedor, custo ou DAS' : 'O que foi?'}<input required name="description" value={description} onChange={event => setDescription(event.target.value)} onBlur={inferCategory} placeholder={type === 'card_debt' ? 'Ex.: celular, geladeira' : type === 'income' && selectedSpace === 'pf' ? 'Ex.: salário, aluguel' : selectedSpace === 'mei' ? 'Ex.: venda, insumos, DAS' : 'Ex.: mercado, aluguel'} maxLength={180}/></label>
      {category !== 'Outros' && !isSpecialType && <small className="quick-category-hint">Categoria: {category}</small>}
      <label>{type === 'card_debt' ? 'Quanto falta pagar? (R$)' : 'Valor (R$)'}<MoneyInput required name="amount" value={amountText} onChange={changeAmount} placeholder="0,00"/></label>
      {incomeAccounts.length > 1 && !isSpecialType && <label className="quick-account-select">{type === 'income' ? 'Em qual banco entrou?' : 'Conta usada'}<select required value={card?.accountId || accountId} onChange={event => setAccountId(event.target.value)}><option value="">Escolha uma conta</option>{incomeAccounts.map(account => <option key={account.id} value={account.id}>{account.bank} · {account.name}</option>)}</select></label>}
      {incomeAccounts.length === 1 && !isSpecialType && <p className="quick-account-note">{type === 'income' ? 'Entrou em' : 'Conta'}: {incomeAccounts[0].bank} · {incomeAccounts[0].name}</p>}
      {!incomeAccounts.length && type !== 'card_debt' && <p className="quick-account-note">Sem conta bancária cadastrada. O lançamento pode ser vinculado depois.</p>}
      {!incomeAccounts.length && type === 'income' && <button type="button" className="text-link quick-add-account" onClick={onNeedAccount}>Cadastrar conta e banco <ArrowRight size={14}/></button>}
      {!isSpecialType && !cardId && <fieldset className="settlement-choice quick-settlement"><legend>{type === 'income' ? 'A receita já entrou?' : 'A conta já foi paga?'}</legend><div><label className={paid ? 'selected' : ''}><input type="radio" name="paidStatus" checked={paid} onChange={() => { setPaid(true); setEstimated(false); }}/><span>Sim</span></label><label className={!paid ? 'selected' : ''}><input type="radio" name="paidStatus" checked={!paid} onChange={() => setPaid(false)}/><span>Ainda não</span></label></div></fieldset>}
      {type === 'expense' && cardId && <p className="quick-account-note">Compra no cartão fica pendente até o pagamento da fatura.</p>}
      {type === 'income' && investmentEnabled && investmentPlan && <p className="quick-investment-hint">Seu plano separará {investmentPlan.mode === 'fixed' ? `R$ ${(suggestedInvestment(investmentPlan, amountText) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `${(investmentPlan.value / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`} desta receita. <span>Você pode alterar em Mais opções.</span></p>}
    </section>
    {!tx && !voice && !isSpecialType && <button className="quick-options-toggle" type="button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(!showAdvanced)}><span>{showAdvanced ? 'Ocultar opções' : 'Mais opções: categoria, data e repetição'}</span><ArrowDown size={15} className={showAdvanced ? 'rotated' : ''}/></button>}
    {(showAdvanced || isSpecialType || !!tx || !!voice) && <section className="advanced-entry">
      <div className="advanced-entry-title"><strong>{isSpecialType ? 'Detalhes do lançamento' : 'Mais opções'}</strong><span>{selectedSpace === 'mei' ? 'Meu MEI' : 'Pessoal'}</span></div>
      <label>Tipo de movimento<select value={type} onChange={event => chooseType(event.target.value as Kind)}><option value="expense">Despesa</option><option value="income">Receita</option><option value="card_debt">Parcelas de cartão que ainda faltam pagar</option><option value="transfer">Transferência</option><option value="refund">Estorno / reembolso</option><option value="reserve">Separar para reserva</option><option value="release">Liberar valor separado</option>{(tx?.type === 'card_payment' || initialType === 'card_payment' || voice?.type === 'card_payment') && <option value="card_payment">Pagamento de fatura</option>}</select></label>
      <p className="notice midmonth-note"><strong>Começando no meio do mês?</strong><span>Marque se já recebeu ou pagou e informe a data real. O Clareia não contará o movimento duas vezes.</span></p>
      <div className="form-grid"><label>{type === 'income' ? 'Categoria da receita' : 'Categoria'}<select name="category" value={category} onChange={event => chooseCategory(event.target.value)}>{[...new Set([tx?.category || voice?.category || 'Outros', ...categoriesFor(selectedSpace, type === 'income' ? 'income' : 'expense')])].map(item => <option key={item}>{item}</option>)}</select></label><label>{type === 'card_debt' ? 'Data do cadastro' : type === 'card_payment' ? 'Data do pagamento' : 'Data da movimentação'}<input required type="date" value={date} onChange={event => { setDate(event.target.value); if (type !== 'card_debt' && type !== 'card_payment') setDue(card ? firstCardDue(event.target.value, card) : event.target.value); }}/></label></div>
      {type !== 'card_payment' && <label>{type === 'card_debt' ? 'Próximo vencimento' : cardId ? 'Vencimento da 1ª parcela' : 'Pagamento / vencimento'}<input required type="date" value={due} onChange={event => setDue(event.target.value)}/></label>}
      {(type === 'reserve' || type === 'release') && <label>Associar a uma meta<select value={goalId} onChange={event => setGoalId(event.target.value)}><option value="">Reserva geral, sem meta</option>{(data.savingsGoals || []).filter(goal => goal.space === selectedSpace).map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select><small className="muted">Só valores separados vinculados à meta aparecem no progresso.</small></label>}
      {isSpecialType && <label>{type === 'income' ? 'Onde este valor entrou?' : type === 'card_debt' ? 'Conta do banco vinculado' : 'Conta'}<select required={incomeAccounts.length > 0} value={card?.accountId || accountId} disabled={!!card} onChange={event => setAccountId(event.target.value)}><option value="">{incomeAccounts.length ? 'Selecione a conta' : 'Sem conta cadastrada'}</option>{incomeAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.bank}</option>)}</select>{type === 'income' && <small className="muted">Escolha a conta de recebimento.</small>}</label>}
      {(type === 'expense' || type === 'refund' || type === 'card_payment' || type === 'card_debt') && <label>{type === 'card_debt' ? 'Cartão e banco da dívida' : 'Forma de pagamento'}<select value={cardId} onChange={event => { setCardId(event.target.value); const selectedCard = data.cards.find(item => item.id === event.target.value); if (selectedCard) { setAccountId(selectedCard.accountId); if (date && ['expense', 'refund'].includes(type)) setDue(firstCardDue(date, selectedCard)); if (type === 'expense') setPaid(false); } else if (type === 'expense') setPaid(true); }}><option value="">{type === 'card_debt' ? 'Selecione o cartão' : 'Débito / Pix / dinheiro'}</option>{data.cards.filter(item => item.space === selectedSpace).map(item => { const account = data.accounts.find(account => account.id === item.accountId); return <option key={item.id} value={item.id}>{item.name} · {account?.bank || 'Banco'} · {account?.name || 'Conta'}</option>; })}</select></label>}
      {type === 'card_debt' && <div className="notice card-debt-note"><strong>Inclua somente o que ainda falta pagar.</strong><span>Informe as parcelas que faltam e o próximo vencimento.</span></div>}
    {type === 'card_debt' && !data.cards.some(item => item.space === selectedSpace) && <div className="notice income-account-notice">Cadastre primeiro a conta e o cartão do banco que tem as parcelas.<button type="button" className="text-link" onClick={onNeedAccount}>Cadastrar conta e cartão <ArrowRight size={14}/></button></div>}
    {type === 'transfer' && <label>Conta de destino<select name="toAccount" required defaultValue={tx?.toAccountId || ''}><option value="">Selecione</option>{data.accounts.filter(account => account.space === selectedSpace && account.id !== accountId).map(account => <option key={account.id} value={account.id}>{account.name} · {account.bank}</option>)}<option value={selectedSpace === 'mei' ? 'external:pf' : 'external:mei'}>Conta {selectedSpace === 'mei' ? 'pessoal' : 'do MEI'} em outro acesso</option></select></label>}
      {cardId && type !== 'card_payment' && <label>{type === 'card_debt' ? 'Parcelas que ainda faltam' : 'Número de parcelas'}<input name="installments" type="number" min="1" max="36" defaultValue={tx?.installments || voice?.installments || 1}/></label>}
      {type === 'card_debt' && <label>Situação da parcela<select value={paid ? 'paid' : 'pending'} onChange={event => setPaid(event.target.value === 'paid')}><option value="pending">Ainda vou pagar</option><option value="paid">Já foi paga</option></select></label>}
      {(!cardId || type === 'card_payment') && type !== 'card_debt' && <>
      {['reserve', 'release'].includes(type) ? <label className="checkbox"><input type="checkbox" checked={paid} onChange={event => setPaid(event.target.checked)}/>Confirmo esta alteração no valor separado</label> : isSpecialType && <fieldset className="settlement-choice"><legend>{type === 'income' ? 'Situação da receita' : type === 'transfer' ? 'Situação da transferência' : 'Situação do pagamento'}</legend><div><label className={paid ? 'selected' : ''}><input type="radio" name="paidStatus" checked={paid} onChange={() => { setPaid(true); setEstimated(false); }}/><span>Já {type === 'income' || type === 'refund' ? 'recebi' : type === 'transfer' ? 'transferi' : 'paguei'}</span></label><label className={!paid ? 'selected' : ''}><input type="radio" name="paidStatus" checked={!paid} onChange={() => setPaid(false)}/><span>Ainda vou {type === 'income' || type === 'refund' ? 'receber' : type === 'transfer' ? 'transferir' : 'pagar'}</span></label></div></fieldset>}
      {type === 'income' && !paid && <label className="checkbox"><input type="checkbox" checked={estimated} onChange={event => setEstimated(event.target.checked)}/>Receita apenas estimada (fora do saldo projetado)</label>}
      {!['transfer', 'card_payment', 'card_debt', 'reserve', 'release'].includes(type) && <label className="checkbox"><input type="checkbox" name="recurring" defaultChecked={tx?.recurring}/>Repetir mensalmente na projeção</label>}
    </>}
    {type === 'income' && <section className="investment-entry">
      <label className="checkbox"><input type="checkbox" checked={investmentEnabled} onChange={event => { setInvestmentEnabled(event.target.checked); if (event.target.checked && !investmentAmount && investmentPlan) setInvestmentAmount(String(suggestedInvestment(investmentPlan, amountText) / 100)); }}/>Separar parte desta receita para investimento</label>
      {investmentPlan && <small className="muted investment-entry-plan">Plano para {category}: {investmentPlan.mode === 'fixed' ? `R$ ${(investmentPlan.value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `${(investmentPlan.value / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% da receita`}{investmentPlan.investmentType ? ` · ${investmentPlan.investmentType}` : ''}</small>}
      {investmentEnabled && <><label>Quanto pretende separar desta receita? (R$)<MoneyInput value={investmentAmount} onChange={value => { setInvestmentAmount(value); setInvestmentTouched(true); }} placeholder="0,00"/></label><label>Tipo de investimento <span className="muted">(opcional)</span><select value={investmentTypeChoice} onChange={event => { setInvestmentTypeChoice(event.target.value); if (event.target.value !== 'Outro') setCustomInvestmentType(''); }}><option value="">Ainda não decidi</option>{investmentTypes.map(item => <option key={item}>{item}</option>)}<option value="Outro">Outro</option></select></label>{investmentTypeChoice === 'Outro' && <label>Qual tipo de investimento?<input value={customInvestmentType} onChange={event => setCustomInvestmentType(event.target.value)} maxLength={80} placeholder="Ex.: LCI"/></label>}<p className="small-text muted">{paid ? 'Ao salvar, o Clareia registra o valor como separado. A aplicação ou transferência é feita por você.' : 'Como a receita ainda está pendente, a separação só entra no controle quando você confirmar o recebimento.'}</p></>}
    </section>}
    {(type === 'reserve' || type === 'release') && <label>Tipo de investimento <span className="muted">(opcional)</span><select value={investmentTypeChoice} onChange={event => { setInvestmentTypeChoice(event.target.value); if (event.target.value !== 'Outro') setCustomInvestmentType(''); }}><option value="">Sem tipo informado</option>{investmentTypes.map(item => <option key={item}>{item}</option>)}<option value="Outro">Outro</option></select>{investmentTypeChoice === 'Outro' && <input aria-label="Qual tipo de investimento" value={customInvestmentType} onChange={event => setCustomInvestmentType(event.target.value)} maxLength={80} placeholder="Escreva o tipo"/>}</label>}
    </section>}
    {!showAdvanced && !isSpecialType && <input type="hidden" name="category" value={category}/>}
    {message && <p className="negative" role="alert">{message}</p>}
    <button className="button primary full-width quick-submit" disabled={saving}>{saving ? 'Salvando…' : submitLabel || (type === 'card_debt' ? 'Salvar parcelas restantes' : voice ? 'Conferi, salvar lançamento' : 'Salvar lançamento')} <ArrowRight size={15}/></button>
  </form>;
}
