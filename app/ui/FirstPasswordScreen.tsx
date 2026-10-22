'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Compass, LockKeyhole } from 'lucide-react';

export default function FirstPasswordScreen({ onComplete }: { onComplete: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError('As senhas novas não coincidem.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('Escolha uma senha diferente da senha temporária.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/auth/first-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a senha.');
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="first-password-shell">
    <section className="first-password-card">
      <a className="first-password-brand" href="/"><span className="brand-mark"><Compass size={24}/></span><span>clareia<span className="brand-dot">.</span></span></a>
      <span className="eyebrow">PROTEÇÃO DO SEU ACESSO</span>
      <h1>Defina sua senha pessoal.</h1>
      <p>A senha inicial libera apenas este primeiro acesso. Troque-a para abrir suas finanças e continuar com a Central de Inteligência.</p>
      <form onSubmit={submit}>
        <label>Senha atual<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required/></label>
        <label>Nova senha pessoal<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} required/><small className="muted">Use pelo menos 8 caracteres.</small></label>
        <label>Confirme a nova senha<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} required/></label>
        {error&&<p className="login-error" role="alert">{error}</p>}
        <button className="button primary full-width" disabled={busy}><LockKeyhole size={17}/>{busy?'Atualizando…':'Alterar senha e continuar'}<ArrowRight size={17}/></button>
      </form>
    </section>
  </div>;
}
