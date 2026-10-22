'use client';

import { useState } from 'react';
import { ArrowRight, Mic } from 'lucide-react';
import type { FinanceData, InvestmentPlan, Kind, Space, Transaction } from '../../lib/model';
import { categoriesFor, cents, firstCardDue, id } from '../../lib/model';
import { parseVoice } from '../../lib/voice';

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
  voice: ReturnType<typeof parseVoice> | null;
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
  const [category, setCategory] = useState(tx?.category || voice?.category || ((voice?.type || initialType) === 'income' ? firstIncomeCategory : 'Outros'));
  const [goalId, setGoalId] = useState(tx?.goalId || voice?.goalId || initialGoalId || '');
  const [cardId, setCardId] = useState(tx?.cardId || voice?.cardId || '');
  const [accountId, setAccountId] = useState(tx?.accountId || voice?.accountId || '');
  const [date, setDate] = useState(tx?.date || voice?.date || (voice ? '' : asOf));
  const [due, setDue] = useState(tx?.dueDate || (voice?.cardId && voice.date ? firstCardDue(voice.date, data.cards.find(card => card.id === voice.cardId)!) : voice?.date) || (voice ? '' : asOf));
  const [paid, setPaid] = useState(tx?.paid ?? true);
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
  const incomeAccounts = data.accounts.filter(account => account.space === selectedSpace);

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    const plan = (data.investmentPlans || []).find(item => item.space === selectedSpace && item.incomeCategory === nextCategory);
    const savedAmount = tx?.type === 'income' && tx.category === nextCategory ? tx.investmentAmount : undefined;
    setInvestmentEnabled(savedAmount !== undefined ? savedAmount > 0 : type === 'income' && !!plan);
    setInvestmentAmount(savedAmount !== undefined ? String(savedAmount / 100) : plan ? String(suggestedInvestment(plan, amountText) / 100) : '');
    setInvestmentTypeChoice(plan ? (investmentTypes.includes(plan.investmentType) ? plan.investmentType : plan.investmentType ? 'Outro' : '') : '');
    setCustomInvestmentType(plan?.investmentType && !investmentTypes.includes(plan.investmentType) ? plan.investmentType : '');
    setInvestmentTouched(false);
  }

  function chooseType(nextType: Kind) {
    setType(nextType);
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
    }
    setInvestmentTouched(false);
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

  return <form onSubmit={event => {
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
      dueDate: due,
      paid: cardId && type !== 'card_payment' ? false : paid,
      estimated: type === 'income' && estimated,
      accountId: card?.accountId || accountId,
      toAccountId: type === 'transfer' ? String(form.get('toAccount')) : '',
      cardId,
      space: selectedSpace,
      installments: cardId && type !== 'card_payment' ? Number(form.get('installments')) || 1 : 1,
      recurring: !cardId && form.get('recurring') === 'on',
      source: voice ? 'voice' : tx?.source || 'manual',
      createdAt: tx?.createdAt || new Date().toISOString(),
      goalId: ['reserve', 'release'].includes(type) && goalId ? goalId : undefined,
      investmentAmount: investmentValue,
      investmentType: (type === 'income' && investmentEnabled || ['reserve', 'release'].includes(type)) ? selectedInvestmentType() || undefined : undefined,
      sourceIncomeId: type === 'reserve' ? tx?.sourceIncomeId : undefined,
    };
    if (!transaction.amount || transaction.amount < 0) { setMessage('Informe um valor maior que zero.'); return; }
    if (transaction.paid && due > asOf) { setMessage('Uma movimentação futura deve ficar como pendente.'); return; }
    if (investmentEnabled && type === 'income' && (!Number.isSafeInteger(investmentValue) || !investmentValue)) { setMessage('Informe quanto pretende separar ou desmarque a opção de investimento.'); return; }
    if (investmentValue !== undefined && investmentValue > transaction.amount) { setMessage('O valor separado não pode ser maior que esta receita.'); return; }
    if (investmentTypeChoice === 'Outro' && investmentEnabled && type === 'income' && !customInvestmentType.trim()) { setMessage('Informe o tipo de investimento ou escolha outra opção.'); return; }
    onSave(transaction);
  }}>
    {voice && <div className="notice"><Mic size={17}/>Revise todos os campos. Nada foi salvo ainda.</div>}
    <div className="form-grid">
      <label>{selectedSpace === 'mei' ? 'Movimento do negócio' : 'Movimento pessoal'}<select value={type} onChange={event => chooseType(event.target.value as Kind)}><option value="expense">Despesa</option><option value="income">Receita</option><option value="transfer">Transferência</option><option value="refund">Estorno / reembolso</option><option value="reserve">Separar para reserva</option><option value="release">Liberar valor separado</option>{tx?.type === 'card_payment' && <option value="card_payment">Pagamento de fatura</option>}</select></label>
      <p className="muted small-text">Lançamento em {selectedSpace === 'mei' ? 'Meu MEI' : 'Pessoal'}</p>
    </div>
    <label>{type === 'income' && selectedSpace === 'pf' ? 'Salário ou outra renda — descreva qual' : selectedSpace === 'mei' && type === 'income' ? 'Cliente, serviço ou venda' : selectedSpace === 'mei' ? 'Fornecedor, custo ou DAS' : 'Descrição'}<input required name="description" defaultValue={tx?.description || voice?.description || ''} placeholder={type === 'income' && selectedSpace === 'pf' ? 'Ex.: salário da empresa, aluguel, renda extra' : selectedSpace === 'mei' ? 'Ex.: Cliente, insumos ou DAS' : 'Ex.: Mercado da semana'} maxLength={180}/></label>
    <div className="form-grid"><label>Valor total (R$)<input required name="amount" inputMode="decimal" value={amountText} onChange={event => changeAmount(event.target.value)} placeholder="0,00"/></label><label>{type === 'income' ? 'Tipo de receita' : 'Categoria'}<select name="category" value={category} onChange={event => chooseCategory(event.target.value)}>{[...new Set([tx?.category || voice?.category || 'Outros', ...categoriesFor(selectedSpace, type === 'income' ? 'income' : 'expense')])].map(item => <option key={item}>{item}</option>)}</select></label></div>
    {(type === 'reserve' || type === 'release') && <label>Associar a uma meta<select value={goalId} onChange={event => setGoalId(event.target.value)}><option value="">Reserva geral, sem meta</option>{(data.savingsGoals || []).filter(goal => goal.space === selectedSpace).map(goal => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select><small className="muted">Só valores separados vinculados à meta aparecem no progresso.</small></label>}
    <div className="form-grid"><label>Data da movimentação<input required type="date" value={date} onChange={event => { setDate(event.target.value); setDue(card ? firstCardDue(event.target.value, card) : event.target.value); }}/></label><label>{cardId ? 'Vencimento da 1ª parcela' : 'Pagamento / vencimento'}<input required type="date" value={due} onChange={event => setDue(event.target.value)}/></label></div>
    {type === 'income' && !incomeAccounts.length && <div className="notice income-account-notice">Cadastre primeiro uma conta para indicar onde esta renda entrou.<button type="button" className="text-link" onClick={onNeedAccount}>Cadastrar conta e banco <ArrowRight size={14}/></button></div>}
    <label>{type === 'income' ? 'Onde este valor entrou?' : 'Conta'}<select required value={card?.accountId || accountId} disabled={!!card} onChange={event => setAccountId(event.target.value)}><option value="">Selecione a conta</option>{incomeAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.bank}</option>)}</select>{type === 'income' && <small className="muted">Escolha a conta de recebimento. O banco aparece junto do nome.</small>}</label>
    {(type === 'expense' || type === 'refund' || type === 'card_payment') && <label>Forma de pagamento<select value={cardId} onChange={event => { setCardId(event.target.value); const selectedCard = data.cards.find(item => item.id === event.target.value); if (selectedCard) { setAccountId(selectedCard.accountId); if (date) setDue(firstCardDue(date, selectedCard)); } }}><option value="">Débito / Pix / dinheiro</option>{data.cards.filter(item => item.space === selectedSpace).map(item => <option key={item.id} value={item.id}>Cartão · {item.name}</option>)}</select></label>}
    {type === 'transfer' && <label>Conta de destino<select name="toAccount" required defaultValue={tx?.toAccountId || ''}><option value="">Selecione</option>{data.accounts.filter(account => account.space === selectedSpace && account.id !== accountId).map(account => <option key={account.id} value={account.id}>{account.name} · {account.bank}</option>)}<option value={selectedSpace === 'mei' ? 'external:pf' : 'external:mei'}>Conta {selectedSpace === 'mei' ? 'pessoal' : 'do MEI'} em outro acesso</option></select></label>}
    {cardId && type !== 'card_payment' && <label>Número de parcelas<input name="installments" type="number" min="1" max="36" defaultValue={tx?.installments || voice?.installments || 1}/></label>}
    {(!cardId || type === 'card_payment') && <>
      <label className="checkbox"><input type="checkbox" checked={paid} onChange={event => { setPaid(event.target.checked); if (event.target.checked) setEstimated(false); }}/>{['reserve', 'release'].includes(type) ? 'Confirmo esta alteração no valor separado' : <>Já {type === 'income' ? 'recebi' : 'paguei'} este valor</>}</label>
      {type === 'income' && !paid && <label className="checkbox"><input type="checkbox" checked={estimated} onChange={event => setEstimated(event.target.checked)}/>Receita apenas estimada (fora do saldo projetado)</label>}
      {!['transfer', 'card_payment', 'reserve', 'release'].includes(type) && <label className="checkbox"><input type="checkbox" name="recurring" defaultChecked={tx?.recurring}/>Repetir mensalmente na projeção</label>}
    </>}
    {type === 'income' && <section className="investment-entry">
      <label className="checkbox"><input type="checkbox" checked={investmentEnabled} onChange={event => { setInvestmentEnabled(event.target.checked); if (event.target.checked && !investmentAmount && investmentPlan) setInvestmentAmount(String(suggestedInvestment(investmentPlan, amountText) / 100)); }}/>Separar parte desta receita para investimento</label>
      {investmentPlan && <small className="muted investment-entry-plan">Plano para {category}: {investmentPlan.mode === 'fixed' ? `R$ ${(investmentPlan.value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `${(investmentPlan.value / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% da receita`}{investmentPlan.investmentType ? ` · ${investmentPlan.investmentType}` : ''}</small>}
      {investmentEnabled && <><label>Quanto pretende separar desta receita? (R$)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={investmentAmount} onChange={event => { setInvestmentAmount(event.target.value); setInvestmentTouched(true); }} placeholder="0,00"/></label><label>Tipo de investimento <span className="muted">(opcional)</span><select value={investmentTypeChoice} onChange={event => { setInvestmentTypeChoice(event.target.value); if (event.target.value !== 'Outro') setCustomInvestmentType(''); }}><option value="">Ainda não decidi</option>{investmentTypes.map(item => <option key={item}>{item}</option>)}<option value="Outro">Outro</option></select></label>{investmentTypeChoice === 'Outro' && <label>Qual tipo de investimento?<input value={customInvestmentType} onChange={event => setCustomInvestmentType(event.target.value)} maxLength={80} placeholder="Ex.: LCI"/></label>}<p className="small-text muted">{paid ? 'Ao salvar, o Clareia registra o valor como separado. A aplicação ou transferência é feita por você.' : 'Como a receita ainda está pendente, a separação só entra no controle quando você confirmar o recebimento.'}</p></>}
    </section>}
    {(type === 'reserve' || type === 'release') && <label>Tipo de investimento <span className="muted">(opcional)</span><select value={investmentTypeChoice} onChange={event => { setInvestmentTypeChoice(event.target.value); if (event.target.value !== 'Outro') setCustomInvestmentType(''); }}><option value="">Sem tipo informado</option>{investmentTypes.map(item => <option key={item}>{item}</option>)}<option value="Outro">Outro</option></select>{investmentTypeChoice === 'Outro' && <input aria-label="Qual tipo de investimento" value={customInvestmentType} onChange={event => setCustomInvestmentType(event.target.value)} maxLength={80} placeholder="Escreva o tipo"/>}</label>}
    {message && <p className="negative" role="alert">{message}</p>}
    <button className="button primary full-width" disabled={saving}>{saving ? 'Salvando…' : submitLabel || (voice ? 'Conferi, salvar lançamento' : 'Salvar lançamento')} <ArrowRight size={15}/></button>
  </form>;
}
