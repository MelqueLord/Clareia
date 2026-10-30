import type { FinanceData, Kind, PaymentMethod, Space } from './model';
import { categoriesFor } from './model';

export type VoiceDraft = {
  amount: number | null;
  space: Space;
  type: Kind;
  date: string;
  dueDate?: string;
  dateWasInferred: boolean;
  paid: boolean;
  statusInferred: boolean;
  category: string;
  description: string;
  accountId: string;
  cardId: string;
  paymentMethod?: PaymentMethod;
  installments: number;
  needsReview: true;
  reviewHints: string[];
  goalId?: string;
};

const units: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80,
  noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300,
  quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700,
  oitocentos: 800, novecentos: 900,
};
const numberWords = new Set([...Object.keys(units), 'e', 'mil', 'milhao', 'milhoes']);
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ç/g, 'c');
const numberToken = (value: string) => numberWords.has(normalize(value).replace(/[^a-z]/g, ''));

function wordNumber(value: string): number | null {
  const words = normalize(value).split(/\s+/).filter(Boolean);
  if (!words.length || words.some(word => !numberWords.has(word))) return null;
  let total = 0;
  let current = 0;
  for (const word of words) {
    if (word === 'e') continue;
    if (word === 'mil') {
      total += (current || 1) * 1000;
      current = 0;
    } else if (word === 'milhao' || word === 'milhoes') {
      total += (current || 1) * 1_000_000;
      current = 0;
    } else current += units[word] || 0;
  }
  return total + current;
}

function numericMoney(value: string): number | null {
  const raw = value.replace(/\s/g, '');
  if (!raw || !/^\d[\d.,]*$/.test(raw)) return null;
  let normalized: string;
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{1,2}$/.test(raw)) normalized = raw;
  else normalized = raw.replace(/\./g, '');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 99_999_999) return null;
  return Math.round(amount * 100);
}

function trailingNumberWords(before: string): string {
  const words = before.trim().split(/\s+/).filter(Boolean);
  const numeric: string[] = [];
  for (let index = words.length - 1; index >= 0 && numeric.length < 8; index--) {
    const word = words[index].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!numberToken(word)) break;
    numeric.unshift(word);
  }
  return numeric.join(' ');
}

function addSpokenCents(amount: number | null, suffix: string): number | null {
  if (amount === null || amount % 100 !== 0) return amount;
  const match = suffix.match(/^\s+(?:e\s+)?(\d{1,2}|[a-z]+(?:\s+[a-z]+){0,7})\s+centavos?\b/i);
  if (!match) return amount;
  const cents = /^\d+$/.test(match[1]) ? Number(match[1]) : wordNumber(match[1]);
  return cents !== null && cents >= 0 && cents < 100 ? amount + cents : amount;
}

function findAmount(text: string): number | null {
  const currency = text.match(/r\$\s*(\d[\d.,]*)/i);
  if (currency) {
    const suffix = text.slice((currency.index ?? 0) + currency[0].length).replace(/^\s*(?:real|reais)\b/i, '');
    return addSpokenCents(numericMoney(currency[1]), suffix);
  }

  const numericWithCurrency = text.match(/(\d[\d.,]*)\s*(?:(?:real|reais)|conto?s?)\b/i);
  if (numericWithCurrency) return addSpokenCents(numericMoney(numericWithCurrency[1]), text.slice((numericWithCurrency.index ?? 0) + numericWithCurrency[0].length));

  const beforeCurrency = text.match(/\b(?:(?:real|reais)|conto?s?)\b/i);
  if (beforeCurrency?.index !== undefined) {
    const words = trailingNumberWords(text.slice(0, beforeCurrency.index));
    const value = words ? wordNumber(words) : null;
    if (value !== null) return addSpokenCents(value * 100, text.slice(beforeCurrency.index + beforeCurrency[0].length));
  }

  const command = text.match(/\b(?:recebi|receber|paguei|pagar|gastei|gastar|comprei|comprar|custou|custa|deu|salario|faturamento|renda|vendi|venda|separei|separar|reservei|reservar|liberei|liberar|transferi|transferir)\b\s+(?:r\$\s*)?(\d[\d.,]*)/i);
  if (command) return numericMoney(command[1]);

  const wordsAfterCommand = text.match(/\b(?:recebi|receber|paguei|pagar|gastei|gastar|comprei|comprar|custou|custa|deu|separei|separar|reservei|reservar|liberei|liberar|transferi|transferir)\b\s+((?:[a-z]+\s+){0,7}[a-z]+)\b/i);
  if (wordsAfterCommand) {
    const words = wordsAfterCommand[1].trim().split(/\s+/).filter(numberToken).join(' ');
    const value = wordNumber(words);
    if (value !== null && words) return value * 100;
  }

  const numbers = [...text.matchAll(/\d[\d.,]*/g)];
  for (const match of numbers) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 12), index);
    const after = text.slice(index + match[0].length, index + match[0].length + 14);
    if (/\b(?:dia|no dia)\s*$/.test(before) || /\b(?:em|por)\s*$/.test(before) && /^(?:\s*)(?:vezes|parcelas|x\b)/.test(after)) continue;
    if (/^\s*(?:x\b|vezes\b|parcelas?\b)/.test(after)) continue;
    const value = numericMoney(match[0]);
    if (value !== null) return value;
  }

  return null;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function naturalDate(text: string, asOf: string): string | undefined {
  if (/\banteontem\b/.test(text)) return shiftDate(asOf, -2);
  if (/\bontem\b/.test(text)) return shiftDate(asOf, -1);
  if (/\bhoje\b/.test(text)) return asOf;
  if (/\bamanha\b/.test(text)) return shiftDate(asOf, 1);

  const full = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (full) {
    const year = Number(full[3].length === 2 ? `20${full[3]}` : full[3]);
    const month = Number(full[2]);
    const day = Number(full[1]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  if (!/\b\d{1,2}\s*(?:x|vezes|parcelas)\b/.test(text)) {
    const dayMatch = text.match(/\b(?:dia|no dia)\s+(\d{1,2})\b/);
    if (dayMatch) {
      const day = Number(dayMatch[1]);
      const year = Number(asOf.slice(0, 4));
      const month = Number(asOf.slice(5, 7));
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (day >= 1 && day <= lastDay) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return undefined;
}

function detectCategory(text: string, space: Space, type: Kind): string {
  const source = normalize(text);
  const kind = type === 'income' || type === 'refund' ? 'income' : 'expense';
  const options = categoriesFor(space, kind);
  if (space === 'pf' && kind === 'income' && /horas?\s*extras?|comissao|bonus|gratificacao|\bplr\b|adicional|renda variavel|renda extra/.test(source)) return 'Renda extra';
  const exact = options.find(category => source.includes(normalize(category)));
  if (exact) return exact;

  const rules: Array<[RegExp, string]> = space === 'mei'
    ? kind === 'income'
      ? [[/servic|cliente|diaria|freela/, 'Serviços prestados'], [/venda|produto|encomenda/, 'Venda de produtos'], [/reembolso|estorno/, 'Reembolso recebido']]
      : [[/das|tributo|imposto|mei/, 'DAS e tributos'], [/material|insumo|materia prima/, 'Materiais e insumos'], [/fornecedor|mercadoria/, 'Fornecedores'], [/ferrament|equipamento|maquina/, 'Ferramentas e equipamentos'], [/aluguel|sala|estrutura/, 'Aluguel e estrutura'], [/internet|telefone|celular/, 'Internet e telefone'], [/marketing|anuncio|publicidade/, 'Marketing'], [/entrega|combustivel|gasolina|uber|onibus/, 'Transporte e entregas'], [/contador|contabilidade/, 'Contabilidade'], [/tarifa|taxa bancaria|maquininha/, 'Taxas bancárias'], [/pro labore|retirada/, 'Pró-labore']]
    : kind === 'income'
      ? [[/salario|holerite|pagamento mensal/, 'Salário'], [/beneficio|aposentadoria|inss|auxilio/, 'Benefícios'], [/rendimento|juros|dividendo/, 'Rendimentos'], [/freelance|freela|bico|extra|aluguel recebido/, 'Renda extra']]
      : [[/mercado|aliment|restaurante|almoco|jantar|cafe|padaria|delivery|ifood/, 'Alimentação'], [/aluguel|condominio|luz|energia|agua|gas de cozinha|moradia/, 'Moradia'], [/uber|combustivel|gasolina|onibus|metro|transporte|estacionamento/, 'Transporte'], [/farmacia|medico|consulta|saude|dentista/, 'Saúde'], [/escola|curso|faculdade|material escolar/, 'Educação'], [/cinema|viagem|lazer|show|streaming|netflix|spotify/, 'Lazer'], [/compra|roupa|calcado|loja|celular/, 'Compras'], [/assinatura|netflix|spotify|mensalidade/, 'Assinaturas'], [/internet|telefone|servico|conserto/, 'Serviços'], [/iptu|ipva|imposto|multa/, 'Impostos']];

  const match = rules.find(([pattern]) => pattern.test(source));
  return match && options.includes(match[1]) ? match[1] : 'Outros';
}

function cleanDescription(raw: string, data: FinanceData, space: Space): string {
  const ignored = new Set([
    'eu', 'meu', 'minha', 'para', 'por', 'com', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'ao', 'aos',
    'um', 'uma', 'uns', 'umas', 'e', 'o', 'a', 'os', 'as', 'que', 'foi', 'valor', 'reais', 'real', 'centavos', 'conto', 'contos',
    'hoje', 'ontem', 'anteontem', 'amanha', 'dia', 'recebi', 'receber', 'entrou', 'caiu', 'ganhei', 'salario', 'paguei', 'pagar',
    'gastei', 'gastar', 'comprei', 'comprar', 'custou', 'custa', 'deu', 'separei', 'separar', 'reservei', 'reservar', 'liberei', 'liberar',
    'transferi', 'transferir', 'transferencia', 'fatura', 'cartao', 'credito', 'debito', 'pix', 'dinheiro', 'vezes', 'parcela', 'parcelas',
    'pendente', 'vencimento', 'vence', 'vencera', 'vou', 'ainda', 'ja', 'pago', 'paga', 'pague', 'recebido', 'recebida', 'receber',
    'r$', 'r', 'mais', 'tambem', 'depois', 'no', 'na',
  ]);
  const accountWords = data.accounts.filter(account => account.space === space).flatMap(account => [account.name, account.bank]);
  const cardWords = data.cards.filter(card => card.space === space).map(card => card.name);
  for (const name of [...accountWords, ...cardWords]) {
    for (const word of normalize(name).split(/\s+/)) if (word.length > 1) ignored.add(word);
  }
  const numeric = new Set(numberWords);
  const result = raw.split(/\s+/).map(word => ({
    original: word,
    clean: normalize(word).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''),
  })).filter(({ clean }) => clean && !ignored.has(clean) && !numeric.has(clean) && !/^\d[\d.,]*$/.test(clean));
  const description = result.map(({ original }) => original.replace(/^[,;:.!?]+|[,;:.!?]+$/g, '')).join(' ').replace(/\s+/g, ' ').trim();
  return description.slice(0, 180) || '';
}

function parseOne(text: string, data: FinanceData, currentSpace: Space, asOf: string): VoiceDraft {
  const source = normalize(text).replace(/\s+/g, ' ').trim();
  const dateMarker = /\b(?:vence|vencimento|para pagar|pagar ate|pagar dia)\b[^,;]*/.exec(source)?.[0];
  const dueDate = dateMarker ? naturalDate(dateMarker, asOf) : undefined;
  const dateText = dateMarker ? source.replace(dateMarker, '') : source;
  const date = naturalDate(dateText, asOf) || asOf;

  let type: Kind = 'expense';
  if (/\b(?:parcelas? (?:do|de) cartao|divida (?:do|de) cartao|ainda faltam pagar|parcelas restantes)\b/.test(source)) type = 'card_debt';
  else if (/\b(?:paguei|pagar|pagamento) (?:a |da |do )?fatura\b|\bfatura (?:do |da )?cartao\b/.test(source)) type = 'card_payment';
  else if (/\b(?:separei|separar|reservei|reservar|guardar|guardei)\b/.test(source)) type = 'reserve';
  else if (/\b(?:liberei|liberar|retirei|retirar)\b.*\b(?:reserva|investimento|valor separado)\b/.test(source)) type = 'release';
  else if (/\b(?:transferi|transferir|transferencia|retirada do mei)\b/.test(source)) type = 'transfer';
  else if (/\b(?:estorno|reembolso|devolveram|devolucao)\b/.test(source)) type = 'refund';
  else if (/\b(?:recebi|receber|receita|entrou|caiu|ganhei|salario|renda|faturamento|faturei|venda|vendi)\b/.test(source) || /horas?\s*extras?|comissao|bonus|gratificacao|\bplr\b|adicional/.test(source)) type = 'income';

  const amount = findAmount(source);
  const paidWords = /\b(?:paguei|pago|paga|recebi|recebido|recebida|entrou|caiu|ganhei|gastei|gasto|comprei|ja foi|ja paguei|ja recebi)\b/.test(source);
  const pendingWords = /\b(?:vou pagar|vou receber|a pagar|a receber|pendente|em aberto|ainda nao paguei|ainda nao recebi|nao recebi|nao paguei|vence|vencimento|para pagar|cartao de credito|no credito)\b/.test(source);
  const statusInferred = paidWords || pendingWords || type === 'card_debt' || type === 'card_payment';
  let paid = paidWords && !pendingWords;
  if (type === 'card_debt') paid = false;
  if (type === 'card_payment') paid = true;

  const accounts = data.accounts.filter(account => account.space === currentSpace && [account.name, account.bank].some(value => normalize(value).length > 2 && source.includes(normalize(value))));
  const cardIntent = type === 'card_payment' || type === 'card_debt' ||
    /\b(?:cartao|credito)\b/.test(source) && !/\b(?:pix|debito)\b/.test(source);
  const mentionedCards = cardIntent ? data.cards.filter(card => card.space === currentSpace && source.includes(normalize(card.name))) : [];
  const genericCard = cardIntent && mentionedCards.length === 0
    ? data.cards.filter(card => card.space === currentSpace)
    : mentionedCards;
  const card = mentionedCards.length === 1 ? mentionedCards[0] : genericCard.length === 1 ? genericCard[0] : undefined;
  const account = card
    ? data.accounts.find(item => item.id === card.accountId)
    : accounts.length === 1 ? accounts[0] : data.accounts.filter(item => item.space === currentSpace).length === 1 ? data.accounts.find(item => item.space === currentSpace) : undefined;
  const goal = (data.savingsGoals || []).find(item => item.space === currentSpace && source.includes(normalize(item.name)));

  const installmentMatch = source.match(/\b(\d{1,2})\s*(?:x|vezes|parcelas?)\b/) || source.match(/\bem\s+(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+vezes\b/);
  const spokenInstallments = installmentMatch?.[1] ? Number(installmentMatch[1]) : installmentMatch?.[0] ? wordNumber(installmentMatch[0].replace(/^em\s+|\s+vezes$/g, '')) || 1 : 1;
  const installments = Math.max(1, Math.min(36, spokenInstallments));
  const category = detectCategory(source, currentSpace, type);
  const paymentMethod: PaymentMethod | undefined = type !== 'expense' ? undefined
    : /\bpix\b/.test(source) ? 'pix'
    : /\b(?:debito|cartao de debito)\b/.test(source) ? 'debit'
    : /\b(?:credito|cartao|cartao de credito)\b/.test(source) ? 'credit_card'
    : undefined;
  const description = cleanDescription(text, data, currentSpace) || (category !== 'Outros' ? category : type === 'income' ? 'Receita' : type === 'transfer' ? 'Transferência' : type === 'reserve' ? 'Separação para reserva' : type === 'card_debt' ? 'Parcelas de cartão' : type === 'card_payment' ? 'Pagamento de fatura' : type === 'refund' ? 'Reembolso' : 'Despesa');
  const reviewHints: string[] = [];
  if (amount === null) reviewHints.push('Não encontrei o valor. Confira ou preencha o campo de valor.');
  if (!statusInferred) reviewHints.push(type === 'income' ? 'Confirme se a receita já entrou ou ainda vai entrar.' : 'Confirme se a despesa já foi paga ou ainda está pendente.');
  if (!naturalDate(dateText, asOf)) reviewHints.push('Não foi mencionada uma data; deixei hoje como padrão.');
  if (data.accounts.filter(item => item.space === currentSpace).length > 1 && !account) reviewHints.push('Escolha a conta ou o banco para este lançamento.');
  if (cardIntent && !card && data.cards.filter(item => item.space === currentSpace).length > 1) reviewHints.push('Escolha qual cartão foi usado.');
  if (type === 'expense' && !paymentMethod) reviewHints.push('Confirme se pagou no Pix, débito ou crédito.');

  return {
    amount, space: currentSpace, type, date, dueDate, dateWasInferred: !naturalDate(dateText, asOf), paid, statusInferred,
    category, description, accountId: account?.id || '', cardId: card?.id || '', paymentMethod, installments, needsReview: true,
    reviewHints, goalId: ['reserve', 'release'].includes(type) ? goal?.id : undefined,
  };
}

const movementStart = /(?:eu\s+)?(?:recebi|receber|ganhei|entrou|caiu|salario|renda|faturamento|faturei|vendi|venda|paguei|pagar|gastei|gastar|comprei|comprar|transferi|transferir|separei|separar|reservei|reservar|liberei|liberar|retirei|retirar|estorno|reembolso|fatura|parcela|horas?\s*extras?|comissao|bonus|gratificacao|plr|adicional)\b/i;

export function isFinancialMovement(text: string): boolean {
  const source = normalize(text).replace(/\s+/g, ' ').trim();
  if (!source || source.endsWith('?') || /^(?:onde|quanto|qual|quais|como|quando|por que|porque|compare|me mostre|me diga|o que)\b/.test(source)) return false;
  return movementStart.test(source);
}

export function parseVoice(text: string, data: FinanceData, currentSpace: Space, asOf: string): VoiceDraft {
  return parseOne(text, data, currentSpace, asOf);
}

export function parseVoiceBatch(text: string, data: FinanceData, space: Space, asOf: string): VoiceDraft[] {
  const chunks = text
    .split(/[;\n]+|,\s*(?=(?:eu\s+)?(?:recebi|receber|ganhei|entrou|caiu|paguei|pagar|gastei|gastar|comprei|comprar|transferi|transferir|separei|separar|reservei|reservar|liberei|liberar|retirei|retirar|vendi|venda)\b)|\s+e\s+(?=(?:eu\s+)?(?:recebi|receber|ganhei|entrou|caiu|paguei|pagar|gastei|gastar|comprei|comprar|transferi|transferir|separei|separar|reservei|reservar|liberei|liberar|retirei|retirar|vendi|venda)\b)/i)
    .map(value => value.trim())
    .filter(Boolean);
  if (chunks.length > 10) throw new Error('Use até dez movimentos por frase. Divida a gravação para revisar todos.');
  return chunks.map(chunk => parseOne(chunk, data, space, asOf));
}
