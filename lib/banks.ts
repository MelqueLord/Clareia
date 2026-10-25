export const bankInstitutions = [
  'Banco do Brasil', 'Bradesco', 'Caixa Econômica Federal', 'Itaú Unibanco',
  'Santander', 'Nubank', 'Banco Inter', 'C6 Bank', 'Banco Original',
  'BTG Pactual', 'Sicoob', 'Sicredi', 'Banco do Nordeste', 'Banrisul',
  'Banco PAN', 'Mercado Pago', 'PagBank', 'PicPay', 'Neon', 'Banco Safra',
  'Banco BMG', 'Banestes', 'BRB', 'Banco BV', 'Banco BS2', 'Stone', 'XP',
  'Digio', 'Outro',
];

export function bankSearchKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '');
}

const aliases: Record<string, string> = {
  bb: 'Banco do Brasil',
  itau: 'Itaú Unibanco',
  caixa: 'Caixa Econômica Federal',
  caixaeconomica: 'Caixa Econômica Federal',
  inter: 'Banco Inter',
  nu: 'Nubank',
  nubank: 'Nubank',
  c6: 'C6 Bank',
  mp: 'Mercado Pago',
  bancopan: 'Banco PAN',
  xp: 'XP',
  bv: 'Banco BV',
};

export function normalizeBankName(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const key = bankSearchKey(clean);
  const known = bankInstitutions.find(bank => bank !== 'Outro' && bankSearchKey(bank) === key);
  if (known) return known;
  if (aliases[key]) return aliases[key];
  return clean.split(' ').map(word => word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR')).join(' ');
}

export function uniqueBankNames(values: string[]) {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeBankName(value);
    if (normalized) byKey.set(bankSearchKey(normalized), normalized);
  }
  return [...byKey.values()].slice(0, 50);
}
