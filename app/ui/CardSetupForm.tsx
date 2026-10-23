'use client';

import { useState } from 'react';
import type { Account, Card, Space } from '../../lib/model';
import { cents } from '../../lib/model';
import MoneyInput from './MoneyInput';

const issuers = [
  'Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Santander', 'Caixa', 'Inter',
  'C6 Bank', 'Banco PAN', 'PicPay', 'Mercado Pago', 'PagBank', 'Neon', 'BTG Pactual',
  'XP', 'Safra', 'Porto Bank', 'Sicredi', 'Sicoob', 'Banrisul', 'Outro',
];

export default function CardSetupForm({ accounts, space, saving, onSave, onNeedAccount }: {
  accounts: Account[];
  space: Space;
  saving: boolean;
  onSave: (card: Omit<Card, 'id'>) => Promise<void>;
  onNeedAccount: () => void;
}) {
  const [issuer, setIssuer] = useState('');
  const [otherIssuer, setOtherIssuer] = useState('');
  const [nickname, setNickname] = useState('');
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : '');
  const [message, setMessage] = useState('');

  if (!accounts.length) return <div className="card-setup-empty">
    <p>Cadastre primeiro a conta de onde sairá o pagamento da fatura.</p>
    <button type="button" className="button primary full-width" onClick={onNeedAccount}>Cadastrar conta</button>
  </div>;

  return <form className="card-setup-form" onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bank = issuer === 'Outro' ? otherIssuer.trim() : issuer;
    if (!bank) { setMessage('Escolha um emissor ou informe o nome do banco.'); return; }
    const name = nickname.trim() ? `${bank} · ${nickname.trim().slice(0, 40)}` : bank;
    await onSave({
      name,
      accountId: accounts.length === 1 ? accounts[0].id : String(form.get('account')),
      space,
      limit: cents(String(form.get('limit'))),
      closingDay: Number(form.get('close')),
      dueDay: Number(form.get('due')),
    });
  }}>
    <label>Banco ou emissor<select required value={issuer} onChange={event => setIssuer(event.target.value)}>
      <option value="">Selecione o emissor</option>{issuers.map(name => <option key={name}>{name}</option>)}
    </select></label>
    {issuer === 'Outro' && <label>Nome do banco ou emissor<input value={otherIssuer} onChange={event => setOtherIssuer(event.target.value)} maxLength={80} required placeholder="Digite o nome"/></label>}
    <details className="card-nickname-option"><summary>Tenho mais de um cartão deste emissor</summary><label>Identificação opcional<input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={40} placeholder="Ex.: principal, virtual, final 1234"/></label></details>
    {accounts.length > 1 ? <label>Conta que paga a fatura<select name="account" required value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">Selecione a conta</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label> : <p className="card-account-note">Fatura vinculada à conta {accounts[0].name}.</p>}
    <label>Limite do cartão (R$)<MoneyInput name="limit" required placeholder="0,00"/></label>
    <div className="form-grid"><label>Fecha a fatura no dia<input type="number" name="close" min="1" max="28" defaultValue="23" required/></label><label>Vence no dia<input type="number" name="due" min="1" max="28" defaultValue="1" required/></label></div>
    {message && <p className="negative" role="alert">{message}</p>}
    <button className="button primary full-width" disabled={saving}>{saving ? 'Salvando…' : 'Salvar cartão'}</button>
  </form>;
}
