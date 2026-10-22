'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, ArrowUpRight, Building2, Check, Compass, Eye, EyeOff, LockKeyhole, Sparkles, Wallet } from 'lucide-react';
import { authClient } from '../../lib/auth-client';
import type { Space } from '../../lib/model';

type Mode = 'login' | 'signup';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [profile, setProfile] = useState<Space>('pf');
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoPassword, setDemoPassword] = useState('Clareia2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoPassword, setShowDemoPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoError, setDemoError] = useState('');

  const demoEmail = profile === 'pf' ? 'pf@teste.clareia.app' : 'mei@teste.clareia.app';
  const profileName = profile === 'mei' ? 'MEI' : 'pessoa física';

  function choose(p: Space) {
    setProfile(p);
    setError('');
    setDemoError('');
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = mode === 'signup'
        ? await authClient.signUp.email({ email: email.trim(), password, name: name.trim(), space: profile })
        : await authClient.signIn.email({ email: email.trim(), password });

      if (result.error) throw new Error(result.error.message || 'Não foi possível entrar.');
      const accountSpace = result.data?.user?.space;
      if (accountSpace && accountSpace !== profile) {
        await authClient.signOut();
        throw new Error(`Este e-mail já está cadastrado para ${accountSpace === 'mei' ? 'MEI' : 'pessoa física'}. Escolha esse acesso para entrar.`);
      }
      if (!result.data?.user) throw new Error('Não recebemos a confirmação da sua conta. Tente novamente.');
      onLogin();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDemoBusy(true);
    setDemoError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: demoEmail, password: demoPassword }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível abrir a demonstração.');
      onLogin();
    } catch (cause) {
      setDemoError(cause instanceof Error ? cause.message : 'Não foi possível abrir a demonstração.');
    } finally {
      setDemoBusy(false);
    }
  }

  return <div className="login-shell">
    <section className="login-story">
      <a className="login-brand" href="/"><Compass size={30}/>clareia<span>.</span></a>
      <div className="story-copy">
        <span className="login-pill"><Sparkles size={14}/>MENOS DÚVIDAS. MAIS DIREÇÃO.</span>
        <h1>Seu dinheiro.<br/>Seu próximo<br/><em>bom passo.</em></h1>
        <p>Um olhar inteligente sobre suas finanças, para cuidar do presente e decidir o futuro.</p>
        <div className="story-signal"><span><Sparkles size={20}/></span><div><strong>Seu radar já percebeu.</strong><p>Alimentação subiu neste mês. Vamos olhar juntos?</p></div><ArrowUpRight size={20}/></div>
      </div>
      <span className="story-footer">Feito para a sua vida. E para o seu negócio.</span>
      <div className="login-orbits" aria-hidden="true"/>
    </section>
    <section className="login-main">
      <div className="login-mobile-brand"><Compass size={27}/>clareia.</div>
      <div className="login-form-wrap">
        <span className="eyebrow">BEM-VINDO AO SEU PRÓXIMO PASSO</span>
        <h2>{mode === 'login' ? 'Entre na sua conta.' : 'Crie sua conta.'}</h2>
        <p className="login-intro">Cada conta Clareia fica ligada a um único perfil financeiro. Seus dados pessoais e do MEI permanecem separados.</p>

        <div className="profile-choices" role="group" aria-label="Tipo de acesso">
          <button type="button" aria-pressed={profile === 'pf'} className={profile === 'pf' ? 'selected' : ''} onClick={() => choose('pf')}><span className="profile-choice-icon"><Wallet size={20}/></span><strong>Pessoa física</strong><small>Minha vida pessoal</small>{profile === 'pf' && <Check size={14} className="profile-check"/>}</button>
          <button type="button" aria-pressed={profile === 'mei'} className={profile === 'mei' ? 'selected' : ''} onClick={() => choose('mei')}><span className="profile-choice-icon"><Building2 size={20}/></span><strong>MEI</strong><small>Meu negócio</small>{profile === 'mei' && <Check size={14} className="profile-check"/>}</button>
        </div>

        <p className="test-access-note"><strong>Ambiente de teste:</strong> crie uma conta para validar seu acesso. A venda e a liberação dos planos serão configuradas para a hospedagem.</p>

        <div className="auth-mode-switch" role="tablist" aria-label="Acesso à conta">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setError(''); }}>Criar conta</button>
        </div>

        <form className="account-auth-form" onSubmit={submitAccount}>
          {mode === 'signup' && <label>Seu nome<input type="text" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required/></label>}
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required/></label>
          <label>Senha<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={128} required/><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
          {error && <p role="alert" className="login-error">{error}</p>}
          <button className="button primary login-submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? `Entrar como ${profileName}` : `Criar acesso ${profile === 'mei' ? 'MEI' : 'PF'}`}<ArrowRight size={18}/></button>
        </form>

        <div className="login-note"><LockKeyhole size={17}/><p>O tipo de acesso escolhido fica fixo nesta conta. Para usar PF e MEI separadamente, cada perfil precisa de sua própria conta.</p></div>

        <details className="demo-access">
          <summary>Testar com uma conta de demonstração</summary>
          <div className="test-label"><span/>AMBIENTE DE DEMONSTRAÇÃO</div>
          <p className="small-text muted">Use dados fictícios para conhecer o Clareia. As contas de demonstração são compartilhadas.</p>
          <form onSubmit={submitDemo}>
            <label>E-mail da demonstração<input type="email" autoComplete="username" readOnly value={demoEmail}/></label>
            <label>Senha<div className="password-field"><input type={showDemoPassword ? 'text' : 'password'} autoComplete="current-password" value={demoPassword} onChange={event => setDemoPassword(event.target.value)} required/><button type="button" aria-label={showDemoPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowDemoPassword(!showDemoPassword)}>{showDemoPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
            {demoError && <p role="alert" className="login-error">{demoError}</p>}
            <button className="button secondary login-submit" disabled={demoBusy}>{demoBusy ? 'Entrando…' : `Abrir demonstração ${profile === 'mei' ? 'MEI' : 'PF'}`}<ArrowRight size={18}/></button>
          </form>
          <p className="test-password">Senha de demonstração: <strong>Clareia2026!</strong></p>
        </details>
      </div>
      <p className="login-bottom">Clareza para escolher. Espaço para viver.</p>
    </section>
  </div>;
}
