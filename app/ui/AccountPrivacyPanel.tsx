'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react';

type AccountPrivacyPanelProps = {
  user: { id: string; email: string; isTest: boolean } | null;
};

export default function AccountPrivacyPanel({ user }: AccountPrivacyPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function removeAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || user.isTest || email.trim().toLowerCase() !== user.email.trim().toLowerCase() || !confirmed) return;

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string; code?: string; error?: string };
      if (!response.ok) {
        const reason = `${result.code || ''} ${result.message || result.error || ''}`.toLowerCase();
        if (reason.includes('invalid_password') || reason.includes('invalid password')) {
          throw new Error('A senha atual está incorreta. Confira e tente novamente.');
        }
        throw new Error('Não foi possível excluir sua conta agora. Tente novamente.');
      }

      localStorage.removeItem(`clareia-drafts:${user.id}`);
      window.location.assign('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir sua conta.');
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <section className="panel privacy-account-card">
      <div className="privacy-account-heading">
        <span className="privacy-account-icon"><ShieldCheck size={19}/></span>
        <div>
          <h2>Privacidade e sua conta</h2>
          <p className="muted">Veja como usamos seus dados e controle sua conta.</p>
        </div>
      </div>
      <a className="text-link privacy-policy-link" href="/privacidade">Ler a política de privacidade <ExternalLink size={14}/></a>

      {user.isTest ? (
        <p className="privacy-demo-note">Contas de demonstração usam dados fictícios compartilhados e não podem ser excluídas por este painel.</p>
      ) : (
        <details className="privacy-delete-details">
          <summary><Trash2 size={15}/> Excluir minha conta e meus dados</summary>
          <div className="privacy-delete-content">
            <div className="privacy-delete-warning"><AlertTriangle size={17}/><p>A exclusão apaga seu acesso e os dados financeiros dos perfis Pessoa Física e MEI. Essa ação não pode ser desfeita.</p></div>
            <form onSubmit={removeAccount}>
              <label>E-mail da conta
                <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={user.email} required/>
              </label>
              <label>Senha atual
                <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={128} required/>
              </label>
              <label className="privacy-delete-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/> Entendo que não poderei recuperar a conta nem os lançamentos.</label>
              {error && <p className="privacy-delete-error" role="alert">{error}</p>}
              <button className="button danger-button" disabled={busy || !confirmed || email.trim().toLowerCase() !== user.email.trim().toLowerCase() || !password}>
                <Trash2 size={15}/>{busy ? 'Excluindo conta…' : 'Excluir conta permanentemente'}
              </button>
            </form>
          </div>
        </details>
      )}
    </section>
  );
}
