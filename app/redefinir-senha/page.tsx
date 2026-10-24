'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Compass, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token') || '';
    const invalid = params.get('error');
    setToken(resetToken);
    if (invalid || !resetToken) setError('Este link é inválido ou expirou. Solicite uma nova recuperação.');
    window.history.replaceState({}, '', '/redefinir-senha');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirm) { setError('As senhas não conferem.'); return; }
    if (password.length < 8) { setError('Use pelo menos 8 caracteres.'); return; }
    if (!token) { setError('Solicite um novo link de recuperação.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password, token }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string; code?: string };
      if (!response.ok) throw new Error('Este link não é mais válido. Solicite uma nova recuperação.');
      setToken('');
      setPassword('');
      setConfirm('');
      setMessage('Senha atualizada. Entre novamente com sua nova senha.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="support-page"><header className="support-topbar"><a className="support-brand" href="/"><span><Compass size={18}/></span>clareia<span>.</span></a><a className="support-back" href="/#acesso"><ArrowLeft size={15}/> Voltar ao acesso</a></header>
    <section className="support-card reset-card"><div className="support-mark"><LockKeyhole size={22}/></div><span className="support-kicker">RECUPERAÇÃO DE ACESSO</span><h1>Defina uma nova senha.</h1><p>Escolha uma senha com pelo menos 8 caracteres. A senha vale apenas para este acesso PF ou MEI.</p>
      {message ? <div className="support-success" role="status"><ShieldCheck size={18}/><span>{message}</span><a className="button primary" href="/#acesso">Ir para o login</a></div> : <form className="account-auth-form reset-form" onSubmit={submit}>
        <label>Nova senha<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required/><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        <label>Confirme a nova senha<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} required/></label>
        {error && <p role="alert" className="login-error">{error}</p>}
        <button className="button primary login-submit" disabled={busy || !token}>{busy ? 'Atualizando senha…' : 'Salvar nova senha'}</button>
      </form>}
      {error && !token && <a className="button secondary support-retry" href="/#acesso">Solicitar outro link</a>}
      <p className="support-small"><ShieldCheck size={14}/> Por segurança, o link de redefinição vale por 1 hora e encerra as sessões existentes.</p>
    </section>
  </main>;
}
