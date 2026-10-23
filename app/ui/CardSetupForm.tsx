'use client';

import { useState } from 'react';
import type { Card, Space } from '../../lib/model';
import { cents } from '../../lib/model';
import MoneyInput from './MoneyInput';

const issuers = [
  'Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Santander', 'Caixa', 'Inter',
  'C6 Bank', 'Banco PAN', 'PicPay', 'Mercado Pago', 'PagBank', 'Neon', 'BTG Pactual',
  'XP', 'Safra', 'Porto Bank', 'Sicredi', 'Sicoob', 'Banrisul', 'Outro',
];

export default function CardSetupForm({ space, saving, onSave }: {
  space: Space;
  saving: boolean;
  onSave: (card: Omit<Card, 'id'>) => Promise<void>;
}) {
  const [issuer, setIssuer] = useState('');
  const [otherIssuer, setOtherIssuer] = useState('');
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');

  return <form className="card-setup-form" onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const bank = issuer === 'Outro' ? otherIssuer.trim() : issuer;
    if (!bank) { setMessage('Escolha um emissor ou informe o nome do banco.'); return; }
    const limitText = String(form.get('limit') || '').trim();
    const limit = limitText ? cents(limitText) : null;
    if (limitText && (!Number.isSafeInteger(limit) || !limit)) { setMessage('Informe um limite maior que zero ou deixe em branco.'); return; }
    const name = nickname.trim() ? `${bank} · ${nickname.trim().slice(0, 40)}` : bank;
    await onSave({
      name,
      accountId: '',
      space,
      limit,
      closingDay: Number(form.get('close')),
      dueDay: Number(form.get('due')),
    });
  }}>
    <p className="card-account-note">Você não precisa cadastrar uma conta bancária para incluir o cartão. Se quiser, escolha uma conta ao registrar o pagamento da fatura.</p>
    <label>Cartão ou emissor<select required value={issuer} onChange={event => setIssuer(event.target.value)}>
      <option value="">Selecione o emissor</option>{issuers.map(name => <option key={name}>{name}</option>)}
    </select></label>
    {issuer === 'Outro' && <label>Nome do cartão<input value={otherIssuer} onChange={event => setOtherIssuer(event.target.value)} maxLength={80} required placeholder="Digite o nome"/></label>}
    <details className="card-nickname-option"><summary>Tenho mais de um cartão deste emissor</summary><label>Identificação opcional<input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={40} placeholder="Ex.: principal, virtual, final 1234"/></label></details>
    <label>Limite do cartão (R$) <span className="muted">(opcional)</span><MoneyInput name="limit" placeholder="Se souber, informe o limite"/></label>
    <div className="form-grid"><label>Fecha a fatura no dia<input type="number" name="close" min="1" max="28" defaultValue="23" required/></label><label>Vence no dia<input type="number" name="due" min="1" max="28" defaultValue="1" required/></label></div>
    {message && <p className="negative" role="alert">{message}</p>}
    <button className="button primary full-width" disabled={saving}>{saving ? 'Salvando…' : 'Salvar cartão'}</button>
  </form>;
}
