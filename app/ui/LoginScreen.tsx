'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Building2, Check, CheckCircle2, Compass, Eye, EyeOff, LockKeyhole, Mic, ShieldCheck, Sparkles, Target, Wallet } from 'lucide-react';
import { authClient } from '../../lib/auth-client';
import type { Space } from '../../lib/model';
import InstallAppCard from './InstallAppCard';

type InstallPrompt = { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };

export default function LoginScreen({ onLogin, installPrompt, onInstallUsed }: { onLogin: () => void; installPrompt: InstallPrompt | null; onInstallUsed: () => void }) {
  const [profile, setProfile] = useState<Space>('pf');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [demoPassword, setDemoPassword] = useState('Clareia2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoPassword, setShowDemoPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoError, setDemoError] = useState('');
  const [demoOpen, setDemoOpen] = useState(false);

  const demoEmail = profile === 'pf' ? 'pf@teste.clareia.app' : 'mei@teste.clareia.app';
  const profileName = profile === 'mei' ? 'MEI' : 'pessoa física';

  function choose(p: Space) {
    setProfile(p);
    setError('');
    setDemoError('');
  }

  function openDemoFor(p: Space = profile) {
    choose(p);
    setDemoOpen(true);
    window.setTimeout(() => document.getElementById('demo-access')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  }

  function startTrial(p: Space = profile) {
    choose(p);
    setMode('signup');
    window.setTimeout(() => document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup' && password !== confirmPassword) throw new Error('As senhas não conferem.');
      const normalizedEmail = email.trim().toLowerCase();
      const result = mode === 'signup'
        ? await authClient.signUp.email({ email: normalizedEmail, password, name: name.trim() || normalizedEmail.split('@')[0], space: profile })
        : await authClient.signIn.email({ email: normalizedEmail, password });

      if (result.error) throw new Error(result.error.message || (mode === 'signup' ? 'Não foi possível criar sua conta.' : 'Não foi possível entrar.'));
      const accountSpace = result.data?.user?.space;
      if (accountSpace && accountSpace !== profile) {
        await authClient.signOut();
        throw new Error(`Este e-mail já está cadastrado para ${accountSpace === 'mei' ? 'MEI' : 'pessoa física'}. Escolha esse acesso para entrar.`);
      }
      if (!result.data?.user) throw new Error(mode === 'signup' ? 'Não foi possível iniciar seu teste. Tente novamente.' : 'Não recebemos a confirmação da sua conta. Tente novamente.');
      onLogin();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecoveryBusy(true);
    setRecoveryError('');
    setRecoveryMessage('');
    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim().toLowerCase(), redirectTo: `${window.location.origin}/redefinir-senha` }),
      });
      if (!response.ok) throw new Error('Não foi possível registrar o pedido agora. Tente novamente.');
      setRecoveryMessage('Se este e-mail estiver cadastrado, o pedido foi encaminhado para recuperação. O envio automático de e-mail ainda não está configurado; fale com o suporte para receber o link temporário.');
    } catch (cause) {
      setRecoveryError(cause instanceof Error ? cause.message : 'Não foi possível registrar o pedido agora.');
    } finally {
      setRecoveryBusy(false);
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

  return <div className="clareia-landing" id="inicio">
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <a className="landing-brand" href="#inicio" aria-label="Clareia, início"><span><Compass size={21}/></span>clareia<span className="landing-brand-dot">.</span></a>
        <nav aria-label="Navegação principal"><a href="#como-funciona">Como funciona</a><a href="#planos">Para quem</a><a href="#duvidas">Dúvidas</a></nav>
        <div className="landing-nav-actions"><a className="landing-login-link" href="#acesso" onClick={() => setMode('login')}>Já tenho acesso</a><button className="landing-nav-cta" type="button" onClick={() => startTrial()} >Testar 30 dias grátis<ArrowRight size={15}/></button></div>
      </div>
    </header>

    <main className="landing-main">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><Sparkles size={14}/> PARA QUEM PRECISA CUIDAR DO DINHEIRO NA CORRERIA</span>
          <h1>O mês está acabando e você não sabe para onde foi o dinheiro?</h1>
          <p className="landing-hero-lead">Quando a rotina aperta, anotar cada gasto vira mais uma tarefa — e o mês continua correndo. Registre por áudio ou texto, confira cada lançamento e veja o que entrou, saiu e merece atenção para decidir o próximo passo com mais clareza.</p>
          <div className="landing-hero-actions"><button type="button" className="landing-primary-cta" onClick={() => startTrial()}><Mic size={17}/> Quero clareza para meu mês <ArrowRight size={17}/></button><a href="#como-funciona" className="landing-text-cta">Veja como funciona <ArrowUpRight size={15}/></a></div>
          <div className="landing-trust-note"><ShieldCheck size={17}/><span>30 dias grátis, sem cartão e sem cobrança automática.</span></div>
        </div>

        <div className="landing-product" aria-label="Exemplo ilustrativo do Clareia">
          <div className="landing-product-top"><span className="landing-product-mark"><Sparkles size={16}/></span><div><strong>Um jeito mais simples de acompanhar</strong><small>EXEMPLO ILUSTRATIVO</small></div><span className="landing-live-dot"/></div>
          <div className="landing-voice-card"><div className="landing-voice-head"><span><Mic size={15}/> Um registro por voz</span><span className="landing-wave" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></span></div><p>“Paguei R$ 48 no mercado com Pix.”</p><div className="landing-voice-result"><CheckCircle2 size={15}/><span>Você revisa e confirma antes de salvar</span></div></div>
          <div className="landing-insight-card"><div><span className="landing-insight-icon"><Sparkles size={16}/></span><div><small>EXEMPLO DE ORIENTAÇÃO</small><strong>Veja onde o mês está apertando</strong></div></div><p>Com base nos seus registros, a Central compara períodos e destaca mudanças que merecem atenção.</p><span className="landing-insight-link">Sugestões ligadas aos seus dados <ArrowRight size={13}/></span></div>
          <div className="landing-product-foot"><span><Wallet size={14}/> Pessoa física</span><span><Building2 size={14}/> MEI</span><small>acessos separados</small></div>
        </div>
      </section>

      <section className="landing-offer" aria-label="Teste grátis"><div className="landing-offer-icon"><CheckCircle2 size={20}/></div><div><span>EXPERIMENTE SEM PRESSÃO</span><strong>30 dias para enxergar seu mês com mais clareza.</strong><p>Sem cartão e sem cobrança automática. Comece com o que você já sabe e decida no final se quer assinar.</p></div><button type="button" onClick={() => startTrial()}>Começar meus 30 dias <ArrowRight size={16}/></button></section>

      <section id="como-funciona" className="landing-section landing-how">
        <div className="landing-section-heading"><span className="landing-eyebrow">SE ALGUMA DESTAS SITUAÇÕES É FAMILIAR</span><h2>A correria não deveria deixar suas finanças no escuro.</h2><p>Organizar não é falta de vontade. Lembrar de tudo e preencher formulários longos é que pesa.</p></div>
        <div className="landing-feature-grid">
          <article className="landing-feature"><span className="landing-feature-number">01</span><span className="landing-feature-icon"><Mic size={20}/></span><h3>“Eu anoto depois” — e esqueço</h3><p>Pequenos gastos somem da memória quando o dia está cheio. Registre por voz ou texto assim que acontecer.</p><span className="landing-feature-tag">Comece com uma frase</span></article>
          <article className="landing-feature"><span className="landing-feature-number">02</span><span className="landing-feature-icon"><BarChart3 size={20}/></span><h3>A fatura chega e muda o mês</h3><p>Parcelas e compromissos do cartão também pesam no orçamento. Acompanhe o que ainda vai sair.</p><span className="landing-feature-tag">Cartões e parcelas</span></article>
          <article className="landing-feature"><span className="landing-feature-number">03</span><span className="landing-feature-icon"><Target size={20}/></span><h3>Seu dinheiro pessoal não é o caixa do MEI</h3><p>Escolha o espaço certo para cada realidade: Pessoa Física e MEI têm acessos e dados separados.</p><span className="landing-feature-tag">Cada perfil no seu lugar</span></article>
        </div>
      </section>

      <section className="landing-voice-band">
        <div className="landing-voice-orb"><Mic size={27}/></div><div><span className="landing-eyebrow">COMECE PELO QUE ACONTECEU HOJE</span><h2>Uma frase. Um rascunho. Você confere.</h2><p>Diga “paguei 48 reais no mercado com Pix”. O Clareia prepara o lançamento para você revisar e confirmar, sem depender de lembrar tudo no fim do mês.</p></div><button type="button" onClick={() => startTrial()}>Quero experimentar <ArrowRight size={16}/></button>
      </section>

      <section id="planos" className="landing-section landing-plans">
        <div className="landing-section-heading"><span className="landing-eyebrow">PLANOS MENSAIS · PERFIS SEPARADOS</span><h2>Sua vida pessoal e seu MEI, cada um no seu lugar.</h2><p>Escolha o espaço que faz sentido para você. Cada perfil tem acesso e informações independentes.</p></div>
        <div className="landing-plan-grid">
          <article className="landing-plan-card"><div className="landing-plan-icon"><Wallet size={21}/></div><span className="landing-plan-label">PESSOA FÍSICA</span><h3>Suas finanças pessoais</h3><div className="landing-plan-price"><strong>R$ 19,90</strong><span>/ mês após o teste</span></div><p>Renda, contas do mês, cartão, metas para guardar e comparações para cuidar melhor do seu dinheiro.</p><ul><li><Check size={15}/> Receitas e despesas pessoais</li><li><Check size={15}/> Metas mensais e reserva</li><li><Check size={15}/> Comparações e próximos passos</li></ul><button type="button" className="landing-plan-cta" onClick={() => startTrial('pf')}>Testar PF por 30 dias <ArrowRight size={15}/></button></article>
          <article className="landing-plan-card landing-plan-mei"><div className="landing-plan-icon"><Building2 size={21}/></div><span className="landing-plan-label">MEI</span><h3>O caixa do seu negócio</h3><div className="landing-plan-price"><strong>R$ 29,90</strong><span>/ mês após o teste</span></div><p>Entradas, gastos, contas, cartões e previsões para enxergar o movimento do seu negócio.</p><ul><li><Check size={15}/> Receitas e despesas do MEI</li><li><Check size={15}/> Contas, cartões e compromissos</li><li><Check size={15}/> Visão do caixa e orientação</li></ul><button type="button" className="landing-plan-cta" onClick={() => startTrial('mei')}>Testar MEI por 30 dias <ArrowRight size={15}/></button></article>
        </div>
        <p className="landing-plan-footnote"><LockKeyhole size={14}/> O teste não solicita cartão e não gera cobrança automática. Ao final, escolha se deseja assinar; seus dados permanecem salvos.</p>
      </section>

      <section className="landing-final-cta"><span className="landing-eyebrow">NÃO PRECISA ORGANIZAR TUDO HOJE</span><h2>Comece pelo próximo gasto. Entenda o mês um passo de cada vez.</h2><p>Experimente por 30 dias, sem cartão e sem cobrança automática. No final, você decide.</p><button type="button" className="landing-primary-cta" onClick={() => startTrial()}><Mic size={17}/> Quero começar grátis <ArrowRight size={17}/></button></section>

      <section id="duvidas" className="landing-faq"><div className="landing-section-heading"><span className="landing-eyebrow">DÚVIDAS RÁPIDAS</span><h2>Começar pode ser simples.</h2></div><div className="landing-faq-grid"><details><summary>Como funciona o teste grátis?</summary><p>São 30 dias após o primeiro acesso, sem informar cartão. No fim, você escolhe se quer assinar; não há cobrança automática.</p></details><details><summary>Preciso preencher tudo de uma vez?</summary><p>Não. Você pode começar pelo que já sabe e completar as informações aos poucos. A Central mostra a próxima etapa sugerida.</p></details><details><summary>O áudio substitui minha revisão?</summary><p>Não. A fala vira um rascunho para você conferir e confirmar antes de salvar.</p></details><details><summary>Pessoa física e MEI ficam misturados?</summary><p>Não. Cada perfil tem um acesso e um conjunto de dados separado.</p></details><details><summary>O Clareia guarda minha gravação?</summary><p>O Clareia não armazena o áudio. O reconhecimento de voz depende do navegador e pode usar um serviço externo para transcrever.</p></details></div></section>

      <section id="acesso" className="landing-access">
        <div className="landing-access-intro"><span className="landing-eyebrow">SUA PRÓXIMA ETAPA</span><h2>Entre ou comece seu teste grátis.</h2><p>Escolha PF ou MEI. Cada conta tem seu próprio acesso, dados e período de teste.</p><div className="landing-access-note"><ShieldCheck size={18}/><span>30 dias grátis, sem informar cartão e sem cobrança automática.</span></div></div>
        <div className="landing-auth-card">
          <div className="landing-auth-heading"><span>ACESSO CLAREIA</span><h3>{mode === 'signup' ? 'Comece com 30 dias grátis.' : 'Bem-vindo ao seu próximo passo.'}</h3><p>Cada conta está ligada a um perfil financeiro.</p></div>
          <div className="profile-choices" role="group" aria-label="Tipo de acesso">
            <button type="button" aria-pressed={profile === 'pf'} className={profile === 'pf' ? 'selected' : ''} onClick={() => choose('pf')}><span className="profile-choice-icon"><Wallet size={20}/></span><strong>Pessoa física</strong><small>Minha vida pessoal</small>{profile === 'pf' && <Check size={14} className="profile-check"/>}</button>
            <button type="button" aria-pressed={profile === 'mei'} className={profile === 'mei' ? 'selected' : ''} onClick={() => choose('mei')}><span className="profile-choice-icon"><Building2 size={20}/></span><strong>MEI</strong><small>Meu negócio</small>{profile === 'mei' && <Check size={14} className="profile-check"/>}</button>
          </div>
          <form id="account-auth-form" className="account-auth-form" onSubmit={submitAccount}>
            {mode === 'signup' && <label>Como podemos chamar você?<input type="text" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required/></label>}
            <label>E-mail<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required/></label>
            <label>Senha<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={128} required/><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
            {mode === 'signup' && <label>Confirme a senha<div className="password-field"><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required/></div></label>}
            {error && <p role="alert" className="login-error">{error}</p>}
            <button className="button primary login-submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'signup' ? `Criar conta ${profile === 'mei' ? 'MEI' : 'PF'} grátis` : `Entrar como ${profileName}`}<ArrowRight size={18}/></button>
          </form>
          <button className="auth-mode-toggle" type="button" onClick={() => {setMode(mode === 'signup' ? 'login' : 'signup');setError('');}}>{mode === 'signup' ? 'Já tem uma conta? Entrar' : 'Ainda não tem conta? Começar 30 dias grátis'}</button>
          {mode === 'login' && <button className="auth-mode-toggle recovery-toggle" type="button" onClick={() => {setRecoveryOpen(!recoveryOpen);setRecoveryEmail(email);setRecoveryMessage('');setRecoveryError('');}}>Esqueceu sua senha?</button>}
          {mode === 'login' && recoveryOpen && <form className="account-auth-form recovery-form" onSubmit={requestRecovery}>
            <h4>Recuperar acesso</h4>
            <p>Informe o e-mail da conta. A recuperação respeita o acesso PF ou MEI cadastrado.</p>
            <label>E-mail da conta<input type="email" autoComplete="email" value={recoveryEmail} onChange={event => setRecoveryEmail(event.target.value)} maxLength={254} required/></label>
            {recoveryError && <p role="alert" className="login-error">{recoveryError}</p>}
            {recoveryMessage && <p role="status" className="recovery-status">{recoveryMessage} <a href="/suporte">Abrir suporte</a></p>}
            <button className="button secondary login-submit" disabled={recoveryBusy}>{recoveryBusy ? 'Registrando pedido…' : 'Solicitar recuperação'}</button>
          </form>}
          {mode === 'signup' && <p className="test-access-note"><strong>Teste grátis por 30 dias.</strong> Não pedimos cartão e não fazemos cobrança automática. No fim, você escolhe se quer assinar.</p>}
          <div className="login-note"><LockKeyhole size={16}/><p>Para usar PF e MEI separadamente, cada perfil precisa de sua própria conta.</p></div>
          <details id="demo-access" className="demo-access" open={demoOpen} onToggle={event => setDemoOpen(event.currentTarget.open)}>
            <summary>Testar com uma conta de demonstração</summary>
            <div className="test-label"><span/>AMBIENTE DE DEMONSTRAÇÃO</div>
            <p className="small-text muted">Use dados fictícios para conhecer o Clareia. As contas de demonstração são compartilhadas.</p>
            <form onSubmit={submitDemo}>
              <label>E-mail da demonstração<input type="email" autoComplete="username" readOnly value={demoEmail}/></label>
              <label>Senha<div className="password-field"><input type={showDemoPassword ? 'text' : 'password'} autoComplete="current-password" value={demoPassword} onChange={event => setDemoPassword(event.target.value)} required/><button type="button" aria-label={showDemoPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowDemoPassword(!showDemoPassword)}>{showDemoPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
              {demoError && <p role="alert" className="login-error">{demoError}</p>}
              <button className="button secondary login-submit" disabled={demoBusy}>{demoBusy ? 'Entrando…' : `Abrir demonstração ${profile === 'mei' ? 'MEI' : 'PF'}`}<ArrowRight size={18}/></button>
            </form>
            <p className="test-password">A demonstração usa um acesso compartilhado com dados fictícios.</p>
          </details>
        </div>
      </section>
      <div className="landing-install"><InstallAppCard prompt={installPrompt} onPromptUsed={onInstallUsed} variant="login"/></div>
    </main>
    <footer className="landing-footer"><a className="landing-brand" href="#inicio"><span><Compass size={18}/></span>clareia<span className="landing-brand-dot">.</span></a><p>Mais clareza para cuidar do que é seu. <a className="landing-privacy-link" href="/privacidade">Privacidade</a> · <a className="landing-privacy-link" href="/suporte">Suporte</a></p><a href="#acesso">Acessar o Clareia <ArrowUpRight size={14}/></a></footer>
  </div>;
}
