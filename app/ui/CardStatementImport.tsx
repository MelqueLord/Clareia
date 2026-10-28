'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, FileUp, LoaderCircle, Trash2 } from 'lucide-react';
import type { Card, FinanceData, Space, Transaction } from '../../lib/model';
import { categoriesFor, cents, id, withDay } from '../../lib/model';
import { invoiceRows } from '../../lib/engine';

type ImportRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  refund: boolean;
  category: string;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  installmentsLeft: number;
  selected: boolean;
  allowDuplicate?: boolean;
};

type TextItem = { str?: string; transform?: number[] };

function pdfLines(items: TextItem[]) {
  const positioned = items.filter(item => item.str?.trim() && item.transform?.length);
  const sorted = positioned.map(item => ({
    text: item.str!.trim(),
    x: item.transform![4],
    y: item.transform![5],
  })).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; items: typeof sorted }> = [];
  for (const item of sorted) {
    let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 2.5);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  return lines.map(line => line.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim());
}

function parseDate(line: string, statementMonth: string) {
  const match = line.match(/^\s*(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\s+(.+)$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const [statementYear, statementMonthNumber] = statementMonth.split('-').map(Number);
  let year = match[3] ? Number(match[3]) : statementYear;
  if (match[3] && year < 100) year += 2000;
  if (!match[3] && month > statementMonthNumber && month - statementMonthNumber > 6) year -= 1;
  const date = withDay(`${year}-${String(month).padStart(2, '0')}-01`, day);
  return { date, rest: match[4] };
}

function parseMoney(raw: string) {
  const negative = /(^\s*[-−]|-\s*$)/.test(raw);
  const digits = raw.replace(/R\$|\s|[-−]/gi, '');
  const amount = cents(digits);
  return { amount: Math.abs(amount), negative };
}

function parseInstallments(text: string) {
  const match = text.match(/(?:\b|\s)(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})(?:\b|\s)/i);
  if (!match) return { current: null, total: null };
  const current = Number(match[1]);
  const total = Number(match[2]);
  return current >= 1 && total >= current && total <= 36 ? { current, total } : { current: null, total: null };
}

function normalizeMerchant(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(word => word.length > 2).join(' ');
}

function merchantsMatch(left: string, right: string) {
  const a = normalizeMerchant(left);
  const b = normalizeMerchant(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const leftWords = new Set(a.split(' '));
  const rightWords = new Set(b.split(' '));
  const overlap = [...leftWords].filter(word => rightWords.has(word)).length;
  return overlap >= 2 && overlap / Math.min(leftWords.size, rightWords.size) >= 0.6;
}

function parseRows(lines: string[], statementMonth: string, categories: string[]): ImportRow[] {
  const rows: ImportRow[] = [];
  const moneyPattern = /(?:R\$\s*)?(?:[-−]\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?:\s*-)?/gi;
  for (const line of lines) {
    const dated = parseDate(line, statementMonth);
    if (!dated) continue;
    const matches = [...dated.rest.matchAll(moneyPattern)];
    const last = matches.at(-1);
    if (!last || last.index === undefined) continue;
    const description = dated.rest.slice(0, last.index).replace(/[|·•\s-]+$/g, '').trim();
    if (!/[a-zA-ZÀ-ÿ]/.test(description) || description.length < 2) continue;
    if (/^(total|subtotal|saldo anterior|pagamento recebido|pagamento efetuado|vencimento|valor total|encargos totais)\b/i.test(description)) continue;
    const parsedMoney = parseMoney(last[0]);
    if (!parsedMoney.amount) continue;
    const installments = parseInstallments(description);
    const refund = parsedMoney.negative || /\b(estorno|devolu[cç][aã]o|cr[eé]dito recebido)\b/i.test(description);
    rows.push({
      id: id(), date: dated.date, description: description.slice(0, 180), amount: parsedMoney.amount,
      refund, category: categories[0] || 'Outros', installmentCurrent: installments.current,
      installmentTotal: installments.total,
      installmentsLeft: installments.total && installments.current ? installments.total - installments.current + 1 : 1,
      selected: true,
    });
  }
  return rows;
}

export default function CardStatementImport({ cards, space, data, asOf, saving, onImport }: {
  cards: Card[];
  space: Space;
  data: FinanceData;
  asOf: string;
  saving: boolean;
  onImport: (transactions: Transaction[]) => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cardId, setCardId] = useState(cards[0]?.id || '');
  const [statementMonth, setStatementMonth] = useState(asOf.slice(0, 7));
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const card = cards.find(item => item.id === cardId);
  const categories = categoriesFor(space, 'expense');
  const dueDate = card ? withDay(`${statementMonth}-01`, card.dueDay) : `${statementMonth}-01`;
  const existingRows = useMemo(() => card ? invoiceRows(data, card.id, statementMonth) : [], [card, data, statementMonth]);
  const duplicateIds = useMemo(() => {
    const found = new Map<string, string>();
    rows.forEach((row, index) => {
      const match = existingRows.find(existing => {
        const original = data.transactions.find(transaction => transaction.id === existing.id);
        return original?.date === row.date && existing.amount === row.amount && merchantsMatch(existing.description, row.description);
      });
      const sameFile = rows.slice(0, index).find(previous => previous.date === row.date && previous.amount === row.amount && merchantsMatch(previous.description, row.description));
      if (match) found.set(row.id, match.description);
      else if (sameFile) found.set(row.id, `linha repetida · ${sameFile.description}`);
    });
    return found;
  }, [rows, existingRows, data.transactions]);
  const selectedRows = rows.filter(row => row.selected && (!duplicateIds.has(row.id) || row.allowDuplicate)).length;

  async function readPdf(file: File) {
    setError(''); setNotice(''); setRows([]); setFileName('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Selecione um arquivo PDF.'); return;
    }
    if (file.size > 15 * 1024 * 1024) { setError('O PDF precisa ter até 15 MB.'); return; }
    setBusy(true);
    try {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
      let parsed: ImportRow[] = [];
      try {
        if (pdf.numPages > 40) throw new Error('O PDF precisa ter até 40 páginas.');
        const lines: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          lines.push(...pdfLines(content.items as TextItem[]));
        }
        parsed = parseRows(lines, statementMonth, categories);
      } finally {
        await pdf.destroy();
      }
      if (!parsed.length) throw new Error('Não encontrei compras legíveis. Este PDF pode ser digitalizado ou usar um formato ainda não reconhecido.');
      if (parsed.length > 300) throw new Error('Encontrei mais de 300 linhas candidatas. Selecione uma única fatura em PDF e tente novamente.');
      setRows(parsed);
      setFileName(file.name);
      setNotice(`${parsed.length} lançamento(s) encontrado(s). Confira os dados antes de importar.`);
    } catch (cause) {
      setError(cause instanceof Error && cause.message !== 'No password given' ? cause.message : 'Não foi possível ler este PDF. Confira se ele não está protegido por senha.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function updateRow(rowId: string, patch: Partial<ImportRow>) {
    setRows(current => current.map(row => row.id === rowId ? { ...row, ...patch } : row));
  }

  async function confirmImport() {
    if (!card) return;
    setError('');
    if (!/^\d{4}-\d{2}$/.test(statementMonth) || rows.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !row.description.trim() || !Number.isSafeInteger(row.amount) || row.amount <= 0 || !Number.isInteger(row.installmentsLeft) || row.installmentsLeft < 1 || row.installmentsLeft > 36 || row.amount * row.installmentsLeft > 100000000000)) {
      setError('Confira mês, data, descrição e valores antes de importar.'); return;
    }
    const transactions = rows.filter(row => row.selected && (!duplicateIds.has(row.id) || row.allowDuplicate)).map((row): Transaction => {
      const installmentsLeft = row.installmentsLeft;
      const isInstallment = installmentsLeft > 1;
      return {
        id: id(), description: row.description, amount: row.amount * (isInstallment ? installmentsLeft : 1),
        type: row.refund ? 'refund' : isInstallment ? 'card_debt' : 'expense', category: row.category,
        date: row.date, dueDate, paid: false, estimated: false, accountId: '', toAccountId: '', cardId: card.id,
        space, installments: isInstallment ? installmentsLeft : 1, recurring: false,
        ...(row.refund ? {} : isInstallment ? {} : { paymentMethod: 'credit_card' as const }),
        source: 'import', createdAt: new Date().toISOString(),
      };
    });
    if (!transactions.length) { setError('Marque ao menos um lançamento novo para importar.'); return; }
    if (await onImport(transactions)) setNotice(`${transactions.length} lançamento(s) importado(s).`);
  }

  return <div className="statement-import">
    <p className="muted">A leitura acontece neste aparelho. O PDF não é enviado nem guardado pelo Clareia. Compras importadas entram como pendentes até o pagamento da fatura.</p>
    <div className="form-grid">
      <label>Cartão<select value={cardId} onChange={event => { setCardId(event.target.value); setRows([]); setFileName(''); setNotice(''); }}>
        {cards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Mês da fatura<input type="month" required value={statementMonth} onChange={event => { setStatementMonth(event.target.value); setRows([]); setFileName(''); setNotice(''); }} /></label>
    </div>
    <div className="statement-upload">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" aria-label="Selecionar fatura em PDF" onChange={event => { const file = event.target.files?.[0]; if (file) void readPdf(file); }} />
      <button type="button" className="button secondary" disabled={busy || !card} onClick={() => inputRef.current?.click()}>
        {busy ? <LoaderCircle size={17} className="spin"/> : <FileUp size={17}/>} {busy ? 'Lendo fatura…' : 'Escolher PDF'}
      </button>
      <span className="small-text muted">PDF de até 15 MB e 40 páginas</span>
      {fileName && <span className="small-text muted">{fileName}</span>}
    </div>
    {error && <p className="negative statement-message" role="alert"><AlertTriangle size={16}/>{error}</p>}
    {notice && <p className="notice statement-message" role="status"><Check size={16}/>{notice}</p>}
    {rows.length > 0 && <>
      <div className="statement-review-heading"><div><strong>Revise os lançamentos encontrados</strong><small>{selectedRows} novo(s) selecionado(s) · fatura com vencimento em {dueDate.split('-').reverse().join('/')}</small></div><button type="button" className="text-link" onClick={() => { setRows([]); setFileName(''); setNotice(''); }}><Trash2 size={15}/>Remover PDF</button></div>
      {duplicateIds.size > 0 && <p className="notice statement-message"><AlertTriangle size={16}/>{duplicateIds.size} possível(is) duplicata(s) foi(foram) desmarcada(s). Você pode conferir e marcar para importar mesmo assim.</p>}
      <div className="statement-rows">
        {rows.map(row => {
          const duplicate = duplicateIds.get(row.id);
          return <article className={'statement-row'+(duplicate ? ' duplicate' : '')} key={row.id}>
            <label className="statement-select"><input type="checkbox" checked={row.selected && (!duplicate || row.allowDuplicate)} onChange={event => updateRow(row.id, { selected: event.target.checked, ...(duplicate ? { allowDuplicate: event.target.checked } : {}) })}/><span className="sr-only">Importar {row.description}</span></label>
            <div className="statement-row-fields">
              <div className="form-grid">
                <label>Data<input type="date" value={row.date} onChange={event => updateRow(row.id, { date: event.target.value })}/></label>
                <label>Valor da parcela (R$)<input type="number" min="0.01" step="0.01" value={(row.amount / 100).toFixed(2)} onChange={event => updateRow(row.id, { amount: Math.round(Number(event.target.value) * 100) || 0 })}/></label>
              </div>
              <label>Descrição<input maxLength={180} value={row.description} onChange={event => updateRow(row.id, { description: event.target.value })}/></label>
              <div className="form-grid">
                <label>Categoria<select value={row.category} onChange={event => updateRow(row.id, { category: event.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
                <label className="statement-refund"><input type="checkbox" checked={row.refund} onChange={event => updateRow(row.id, { refund: event.target.checked })}/> Estorno ou devolução</label>
              </div>
              {row.installmentTotal && <small className="muted">Identificada parcela {row.installmentCurrent} de {row.installmentTotal}. Ajuste as parcelas restantes se necessário.</small>}
              <label>Parcelas restantes incluindo esta<input type="number" min="1" max="36" value={row.installmentsLeft} onChange={event => updateRow(row.id, { installmentsLeft: Math.max(1, Math.min(36, Number(event.target.value) || 1)) })}/></label>
              {duplicate && <small className="negative">Pode repetir “{duplicate}”. Confira antes de marcar.</small>}
            </div>
          </article>;
        })}
      </div>
      <button type="button" className="button primary full-width" disabled={saving || busy || selectedRows === 0} onClick={() => void confirmImport()}>
        {saving ? 'Salvando…' : `Importar ${selectedRows} lançamento(s)`}
      </button>
    </>}
  </div>;
}
