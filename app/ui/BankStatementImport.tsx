'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, Check, FileUp, LoaderCircle, Trash2 } from 'lucide-react';
import type { Account, FinanceData, Space, Transaction } from '../../lib/model';
import { categoriesFor, cents, id, withDay } from '../../lib/model';

type MovementType = 'income' | 'expense';
type ImportRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: MovementType;
  category: string;
  selected: boolean;
  needsTypeReview: boolean;
  allowDuplicate?: boolean;
};
type TextItem = { str?: string; transform?: number[] };

function pdfLines(items: TextItem[]) {
  const positioned = items.filter(item => item.str?.trim() && item.transform?.length);
  const sorted = positioned.map(item => ({ text: item.str!.trim(), x: item.transform![4], y: item.transform![5] }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Array<{ y: number; items: typeof sorted }> = [];
  for (const item of sorted) {
    let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 2.5);
    if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
    line.items.push(item);
  }
  return lines.map(line => line.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim());
}

function parseDate(raw: string, fallbackMonth: string) {
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const [fallbackYear, fallbackMonthNumber] = fallbackMonth.split('-').map(Number);
  let year = match[3] ? Number(match[3]) : fallbackYear;
  if (match[3] && year < 100) year += 2000;
  if (!match[3] && month - fallbackMonthNumber > 6) year -= 1;
  if (!match[3] && fallbackMonthNumber - month > 6) year += 1;
  const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const check = new Date(`${value}T12:00:00Z`);
  return check.getUTCFullYear() === year && check.getUTCMonth() + 1 === month && check.getUTCDate() === day ? value : null;
}

function parseMoney(raw: string) {
  const marker = raw.trim().match(/([DC])\s*$/i)?.[1]?.toUpperCase();
  const negative = /^\s*[-−]/.test(raw) || /-\s*$/.test(raw) || marker === 'D';
  const amount = Math.abs(cents(raw.replace(/R\$|\s|[-−]|[DC]$/gi, '')));
  return { amount, type: marker === 'C' ? 'income' as const : negative ? 'expense' as const : null };
}

function merchantsMatch(left: string, right: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function parseRows(lines: string[], month: string): ImportRow[] {
  const result: ImportRow[] = [];
  const datePattern = /^(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\s+(.+)$/;
  const moneyPattern = /(?:R\$\s*)?(?:[-−]\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?:\s*[DC])?(?:\s*-)?/gi;
  const debitHints = /\b(debito|d[eé]bito|pix enviado|ted enviada|doc enviado|compra|pagamento|saque|tarifa|d[eé]bito autom[aá]tico|boleto pago)\b/i;
  const creditHints = /\b(cr[eé]dito|pix recebido|ted recebida|doc recebido|dep[oó]sito|sal[aá]rio|estorno|reembolso|resgate)\b/i;
  for (const line of lines) {
    const dated = line.match(datePattern);
    if (!dated) continue;
    const date = parseDate(dated[1], month);
    if (!date) continue;
    const rest = dated[2];
    if (/\b(saldo anterior|saldo do dia|saldo final|saldo inicial|saldo em conta|total de lan[cç]amentos|lan[cç]amentos do per[ií]odo|extrato banc[aá]rio)\b/i.test(rest)) continue;
    const amounts = [...rest.matchAll(moneyPattern)].filter(match => match.index !== undefined);
    if (!amounts.length) continue;
    // Extratos costumam terminar a linha com o saldo após o movimento. Quando há
    // mais de um valor, usa o penúltimo e deixa a conferência explícita na tela.
    const picked = amounts.length > 1 ? amounts[amounts.length - 2] : amounts[0];
    if (picked.index === undefined) continue;
    const money = parseMoney(picked[0]);
    if (!money.amount) continue;
    const description = rest.slice(0, picked.index).replace(/[|·•\s-]+$/g, '').trim();
    if (description.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(description)) continue;
    if (/^(saldo|total|subtotal|lan[cç]amento|data|descri[cç][aã]o)\b/i.test(description)) continue;
    const descriptionType = creditHints.test(description) ? 'income' : debitHints.test(description) ? 'expense' : null;
    const type = money.type || descriptionType || 'expense';
    const needsTypeReview = !money.type && !descriptionType;
    result.push({ id: id(), date, description: description.slice(0, 180), amount: money.amount, type, category: 'Outros', selected: !needsTypeReview, needsTypeReview });
  }
  return result;
}

export default function BankStatementImport({ accounts, space, data, asOf, saving, onImport }: {
  accounts: Account[];
  space: Space;
  data: FinanceData;
  asOf: string;
  saving: boolean;
  onImport: (transactions: Transaction[]) => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [statementMonth, setStatementMonth] = useState(asOf.slice(0, 7));
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const account = accounts.find(item => item.id === accountId);

  const duplicateIds = (() => {
    const found = new Map<string, string>();
    rows.forEach((row, index) => {
      const duplicate = data.transactions.find(transaction => transaction.space === space && transaction.accountId === accountId && transaction.date === row.date && transaction.amount === row.amount && transaction.type === row.type && merchantsMatch(transaction.description, row.description));
      const sameFile = rows.slice(0, index).find(previous => previous.date === row.date && previous.amount === row.amount && previous.type === row.type && merchantsMatch(previous.description, row.description));
      if (duplicate) found.set(row.id, duplicate.description);
      else if (sameFile) found.set(row.id, `linha repetida · ${sameFile.description}`);
    });
    return found;
  })();
  const selectedRows = rows.filter(row => row.selected && (!duplicateIds.has(row.id) || row.allowDuplicate)).length;

  async function readPdf(file: File) {
    setError(''); setNotice(''); setRows([]); setFileName('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('Selecione um arquivo PDF.'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('O PDF precisa ter até 15 MB.'); return; }
    setBusy(true);
    try {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      let parsed: ImportRow[] = [];
      try {
        const pdf = await loadingTask.promise;
        if (pdf.numPages > 40) throw new Error('O PDF precisa ter até 40 páginas.');
        const lines: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          lines.push(...pdfLines(content.items as TextItem[]));
        }
        parsed = parseRows(lines, statementMonth);
      } finally { await loadingTask.destroy(); }
      if (!parsed.length) throw new Error('Não encontrei movimentações legíveis. Este PDF pode ser digitalizado ou usar um formato ainda não reconhecido.');
      if (parsed.length > 500) throw new Error('Encontrei mais de 500 linhas candidatas. Selecione um período menor e tente novamente.');
      setRows(parsed);
      setFileName(file.name);
      setNotice(`${parsed.length} possível(is) movimentação(ões) encontrado(s). Revise cada linha antes de importar.`);
    } catch (cause) {
      setError(cause instanceof Error && cause.message !== 'No password given' ? cause.message : 'Não foi possível ler este PDF. Confira se ele não está protegido por senha.');
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  function updateRow(rowId: string, patch: Partial<ImportRow>) {
    setRows(current => current.map(row => row.id === rowId ? { ...row, ...patch, ...(patch.type ? { category: 'Outros', needsTypeReview: false } : {}) } : row));
  }

  async function confirmImport() {
    if (!account) return;
    setError('');
    if (!/^\d{4}-\d{2}$/.test(statementMonth) || rows.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !row.description.trim() || !Number.isSafeInteger(row.amount) || row.amount <= 0)) {
      setError('Confira mês, data, descrição e valores antes de importar.'); return;
    }
    const transactions = rows.filter(row => row.selected && (!duplicateIds.has(row.id) || row.allowDuplicate)).map((row): Transaction => ({
      id: id(), description: row.description, amount: row.amount, type: row.type, category: row.category,
      date: row.date, dueDate: row.date, paid: true, estimated: false, accountId: account.id, toAccountId: '', cardId: '',
      space, installments: 1, recurring: false, source: 'import', createdAt: new Date().toISOString(),
    }));
    if (!transactions.length) { setError('Marque ao menos uma movimentação nova para importar.'); return; }
    if (await onImport(transactions)) setNotice(`${transactions.length} movimentação(ões) importada(s) na conta ${account.name}.`);
  }

  return <div className="statement-import">
    <p className="muted">O PDF é lido neste aparelho e não é enviado nem guardado pelo Clareia. Os extratos variam; confira data, descrição, valor e tipo antes de importar. Transferências entre suas contas devem ser registradas como transferência para não duplicar saldos.</p>
    <div className="form-grid">
      <label>Conta<select value={accountId} onChange={event => { setAccountId(event.target.value); setRows([]); setFileName(''); setNotice(''); }}>
        {accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.bank}</option>)}
      </select></label>
      <label>Mês do extrato<input type="month" required value={statementMonth} onChange={event => { setStatementMonth(event.target.value); setRows([]); setFileName(''); setNotice(''); }} /></label>
    </div>
    <div className="statement-upload">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" aria-label="Selecionar extrato bancário em PDF" onChange={event => { const file = event.target.files?.[0]; if (file) void readPdf(file); }} />
      <button type="button" className="button secondary" disabled={busy || !account} onClick={() => inputRef.current?.click()}>
        {busy ? <LoaderCircle size={17} className="spin"/> : <FileUp size={17}/>} {busy ? 'Lendo extrato…' : 'Escolher PDF'}
      </button>
      <span className="small-text muted">PDF de até 15 MB e 40 páginas · texto selecionável</span>
      {fileName && <span className="small-text muted">{fileName}</span>}
    </div>
    {error && <p className="negative statement-message" role="alert"><AlertTriangle size={16}/>{error}</p>}
    {notice && <p className="notice statement-message" role="status"><Check size={16}/>{notice}</p>}
    {rows.length > 0 && <>
      <div className="statement-review-heading"><div><strong>Revise as movimentações encontradas</strong><small>{selectedRows} nova(s) selecionada(s) · mês de referência {statementMonth.split('-').reverse().join('/')}</small></div><button type="button" className="text-link" onClick={() => { setRows([]); setFileName(''); setNotice(''); }}><Trash2 size={15}/>Remover PDF</button></div>
      {duplicateIds.size > 0 && <p className="notice statement-message"><AlertTriangle size={16}/>{duplicateIds.size} possível(is) duplicata(s) foi(foram) desmarcada(s). Confira e marque novamente se quiser importar mesmo assim.</p>}
      <div className="statement-rows">
        {rows.map(row => {
          const duplicate = duplicateIds.get(row.id);
          return <article className={'statement-row'+(duplicate ? ' duplicate' : '')} key={row.id}>
            <label className="statement-select"><input type="checkbox" checked={row.selected && (!duplicate || row.allowDuplicate)} onChange={event => updateRow(row.id, { selected: event.target.checked, ...(duplicate ? { allowDuplicate: event.target.checked } : {}) })}/><span className="sr-only">Importar {row.description}</span></label>
            <div className="statement-row-fields">
              <div className="form-grid">
                <label>Data<input type="date" value={row.date} onChange={event => updateRow(row.id, { date: event.target.value })}/></label>
                <label>Valor (R$)<input type="number" min="0.01" step="0.01" value={(row.amount / 100).toFixed(2)} onChange={event => updateRow(row.id, { amount: Math.round(Number(event.target.value) * 100) || 0 })}/></label>
              </div>
              <label>Descrição<input maxLength={180} value={row.description} onChange={event => updateRow(row.id, { description: event.target.value })}/></label>
              <div className="form-grid">
                <label>Tipo<select value={row.type} onChange={event => updateRow(row.id, { type: event.target.value as MovementType })}><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
                <label>Categoria<select value={row.category} onChange={event => updateRow(row.id, { category: event.target.value })}>{categoriesFor(space, row.type).map(category => <option key={category}>{category}</option>)}</select></label>
              </div>
              {row.needsTypeReview && <small className="muted">Tipo sugerido como despesa. Confira no extrato e selecione a linha para importar.</small>}
              {duplicate && <small className="negative">Pode repetir “{duplicate}”. Confira antes de marcar.</small>}
            </div>
          </article>;
        })}
      </div>
      <button type="button" className="button primary full-width" disabled={saving || busy || selectedRows === 0} onClick={() => void confirmImport()}>
        {saving ? 'Salvando…' : `Importar ${selectedRows} movimentação(ões)`}
      </button>
    </>}
  </div>;
}
