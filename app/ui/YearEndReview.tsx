'use client';

import { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, CreditCard, Repeat2 } from 'lucide-react';
import type { FinanceData, Space, Transaction } from '../../lib/model';
import { addMonths, id, money } from '../../lib/model';

function nextJanuary(date: string, year: number) {
  return `${year}-01-${date.slice(8, 10)}`;
}

function activeRecurring(transaction: Transaction, space: Space, year: number) {
  return transaction.space === space
    && transaction.recurring
    && !transaction.cardId
    && !['reserve', 'release'].includes(transaction.type)
    && transaction.dueDate <= `${year}-12-31`
    && (!transaction.recurrenceEndDate || transaction.recurrenceEndDate >= `${year}-12-31`);
}

export default function YearEndReview({ data, space, asOf, saving, onSave }: {
  data: FinanceData;
  space: Space;
  asOf: string;
  saving: boolean;
  onSave: (next: FinanceData, action: string) => Promise<boolean>;
}) {
  const year = Number(asOf.slice(0, 4));
  const nextYear = year + 1;
  const [reviewing, setReviewing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (asOf.slice(5, 7) !== '12' || (data.preferences[space].closedYears || []).includes(year)) return null;

  const recurring = data.transactions.filter(transaction => activeRecurring(transaction, space, year));
  const installments = data.transactions.flatMap(transaction => {
    if (transaction.space !== space || !transaction.cardId || !['expense', 'card_debt'].includes(transaction.type)) return [];
    const dates = Array.from({ length: transaction.installments }, (_, index) => addMonths(transaction.dueDate, index))
      .filter(date => date.startsWith(`${nextYear}-`));
    return dates.length ? [{ transaction, count: dates.length }] : [];
  });

  function startReview() {
    setSelectedIds(recurring.map(transaction => transaction.id));
    setReviewing(true);
  }

  function toggle(idToToggle: string) {
    setSelectedIds(current => current.includes(idToToggle)
      ? current.filter(item => item !== idToToggle)
      : [...current, idToToggle]);
  }

  async function finishYear() {
    const yearEnd = `${year}-12-31`;
    const nextYearEnd = `${nextYear}-12-31`;
    const transactions = data.transactions.flatMap(transaction => {
      if (!activeRecurring(transaction, space, year)) return [transaction];
      const ended = { ...transaction, recurrenceEndDate: yearEnd };
      if (!selectedIds.includes(transaction.id)) return [ended];
      const copy: Transaction = {
        ...transaction,
        id: id(),
        date: nextJanuary(transaction.date, nextYear),
        dueDate: nextJanuary(transaction.dueDate, nextYear),
        paid: false,
        recurrenceEndDate: nextYearEnd,
        source: 'manual',
        createdAt: new Date().toISOString(),
      };
      return [ended, copy];
    });
    const preferences = data.preferences[space];
    const closedYears = [...new Set([...(preferences.closedYears || []), year])].sort((a, b) => a - b);
    const next = {
      ...data,
      transactions,
      preferences: { ...data.preferences, [space]: { ...preferences, closedYears } },
    };
    await onSave(next, 'settings');
  }

  return <section className="panel year-end-review">
    <div className="year-end-heading"><span className="year-end-icon"><CalendarDays size={20}/></span><div><span className="eyebrow">FECHAMENTO ANUAL</span><h2>Vamos preparar {nextYear}?</h2><p>Revise o que continua no próximo ano. Seus lançamentos antigos permanecem no histórico.</p></div></div>
    {!reviewing ? <button className="button secondary" type="button" onClick={startReview}>Revisar o próximo ano <ArrowRight size={16}/></button> : <div className="year-end-content">
      <section className="year-end-group"><h3><Repeat2 size={17}/> O que continua todo mês?</h3><p className="small-text muted">As recorrências estão marcadas para continuar. Desmarque as que terminam neste ano.</p>
        {recurring.length ? <div className="year-end-list">{recurring.map(transaction => <label className="year-end-item" key={transaction.id}><input type="checkbox" checked={selectedIds.includes(transaction.id)} onChange={() => toggle(transaction.id)}/><span><strong>{transaction.description}</strong><small>{transaction.type === 'income' ? 'Entrada' : transaction.type === 'transfer' ? 'Transferência' : 'Saída'} · {money(transaction.amount)} por mês</small></span></label>)}</div> : <p className="year-end-empty">Não há lançamentos mensais para copiar.</p>}
      </section>
      <section className="year-end-group"><h3><CreditCard size={17}/> Parcelas que seguem para {nextYear}</h3>
        {installments.length ? <div className="year-end-list">{installments.map(({ transaction, count }) => <div className="year-end-item installment" key={transaction.id}><span><strong>{transaction.description}</strong><small>{data.cards.find(card => card.id === transaction.cardId)?.name || 'Cartão'} · {count} parcela(s) no próximo ano</small></span><CheckCircle2 size={17}/></div>)}</div> : <p className="year-end-empty">Nenhuma parcela de cartão atravessa esta virada.</p>}
        <p className="small-text muted">Essas parcelas já estão previstas automaticamente; não as cadastre de novo.</p>
      </section>
      <div className="year-end-actions"><button className="button secondary" type="button" onClick={() => setReviewing(false)}>Voltar</button><button className="button primary" type="button" disabled={saving} onClick={() => void finishYear()}>{saving ? 'Salvando…' : `Encerrar ${year} e preparar ${nextYear}`} <ArrowRight size={16}/></button></div>
    </div>}
  </section>;
}
