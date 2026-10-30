'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Building2, Check, CheckCircle2, Compass, Download, Eye, EyeOff, FileText, LockKeyhole, Mic, ShieldCheck, Sparkles, Target, Wallet } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const profileName = profile === 'mei' ? 'MEI' : 'pessoa física';

  function choose(p: Space) {
    setProfile(p);
    setError('');
  }

  function startTrial(p: Space = profile) {
    choose(p);
    setMode('signup');
    window.setTimeout(() => document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
  }

  async function installFromTop() {
    if (!installPrompt) {
      document.querySelector('.landing-install')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      onInstallUsed();
    }
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
      setRecoveryMessage('Se este e-mail estiver cadastrado, enviaremos as instruções. Confira sua caixa de entrada e o spam. Se a mensagem não chegar, fale com o suporte.');
    } catch (cause) {
      setRecoveryError(cause instanceof Error ? cause.message : 'Não foi possível registrar o pedido agora.');
    } finally {
      setRecoveryBusy(false);
    }
  }

  return <div className="clareia-landing" id="inicio">
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <a className="landing-brand" href="#inicio" aria-label="Clareia, início"><span><Compass size={21}/></span>clareia<span className="landing-brand-dot">.</span></a>
        <nav aria-label="Navegação principal"><a href="#como-funciona">Como funciona</a><a href="#fatura-pdf">Fatura PDF</a><a href="#planos">Para quem</a><a href="#duvidas">Dúvidas</a></nav>
        <div className="landing-nav-actions"><button className="landing-install-top" type="button" onClick={() => void installFromTop()} aria-label="Instalar Clareia na tela inicial"><Download size={15}/>Instalar app</button><a className="landing-login-link" href="#acesso" onClick={() => setMode('login')}>Já tenho acesso</a><button className="landing-nav-cta" type="button" onClick={() => startTrial()} >Testar grátis por 7 dias<ArrowRight size={15}/></button></div>
      </div>
    </header>

    <main className="landing-main">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><Sparkles size={14}/> MAIS CLAREZA PARA DECIDIR SOBRE O SEU DINHEIRO</span>
          <h1>Entenda seu mês antes que ele termine.</h1>
          <p className="landing-hero-lead">Veja o que entra, o que sai e o que ainda vem pela frente. Registre por voz ou texto, importe extratos e faturas em PDFs compatíveis e revise tudo antes de salvar.</p>
          <div className="landing-hero-actions"><button type="button" className="landing-primary-cta" onClick={() => startTrial()}><Mic size={17}/> Começar grátis por 7 dias <ArrowRight size={17}/></button><a href="#como-funciona" className="landing-text-cta">Descobrir como funciona <ArrowUpRight size={15}/></a></div>
          <div className="landing-trust-note"><ShieldCheck size={17}/><span>Sem cartão. Sem cobrança automática. Você decide ao final.</span></div>
          <div className="landing-install-explainer"><Download size={16}/><span><strong>Quer o Clareia na tela inicial?</strong> Toque em <b>Instalar app</b>. No Android, confirme a instalação. No iPhone, siga <b>Compartilhar › Adicionar à Tela de Início</b>.</span></div>
        </div>

        <div className="landing-product" aria-label="Exemplo ilustrativo do Clareia">
          <div className="landing-product-top"><span className="landing-product-mark"><Sparkles size={16}/></span><div><strong>Seu assistente financeiro Clareia</strong><small>EXEMPLO ILUSTRATIVO</small></div><span className="landing-live-dot"/></div>
          <div className="landing-voice-card"><div className="landing-voice-head"><span><Mic size={15}/> Um registro por voz</span><span className="landing-wave" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></span></div><p>“Paguei R$ 48 no mercado com Pix.”</p><div className="landing-voice-result"><CheckCircle2 size={15}/><span>Você revisa e confirma antes de salvar</span></div></div>
          <div className="landing-insight-card"><div><span className="landing-insight-icon"><Sparkles size={16}/></span><div><small>EXEMPLO DE RESPOSTA DO ASSISTENTE</small><strong>O que merece atenção este mês?</strong></div></div><p>Com base nos seus registros, a Central compara períodos e destaca mudanças que merecem atenção.</p><span className="landing-insight-link">Orientação com base nos seus dados <ArrowRight size={13}/></span></div>
          <div className="landing-product-foot"><span><Wallet size={14}/> Pessoa física</span><span><Building2 size={14}/> MEI</span><small>acessos separados</small></div>
        </div>
      </section>

      <section className="landing-offer" aria-label="Teste grátis"><div className="landing-offer-icon"><CheckCircle2 size={20}/></div><div><span>SEU PRIMEIRO PASSO, SEM COMPLICAÇÃO</span><strong>Comece pelo próximo gasto — não precisa organizar tudo de uma vez.</strong><p>Registre aos poucos, acompanhe suas contas e veja o mês ganhar forma. São 7 dias grátis, sem cartão; depois, você decide se quer assinar.</p></div><button type="button" onClick={() => startTrial()}>Quero começar grátis <ArrowRight size={16}/></button></section>

      <section id="como-funciona" className="landing-section landing-how">
        <div className="landing-section-heading"><span className="landing-eyebrow">MENOS SURPRESA NO FIM DO MÊS</span><h2>Mais clareza para decidir. Menos coisas para lembrar.</h2><p>O Clareia ajuda com passos simples: registre, confira e acompanhe. Seus dados continuam sob sua revisão.</p></div>
        <div className="landing-feature-grid">
          <article className="landing-feature"><span className="landing-feature-number">01</span><span className="landing-feature-icon"><Mic size={20}/></span><h3>Registre o gasto enquanto ele ainda está fresco</h3><p>Diga ou digite o que pagou. Confira os detalhes e confirme em poucos passos.</p><span className="landing-feature-tag">Comece com uma frase</span></article>
          <article className="landing-feature"><span className="landing-feature-number">02</span><span className="landing-feature-icon"><BarChart3 size={20}/></span><h3>Importe o extrato e confira cada movimento</h3><p>Envie um extrato bancário em PDF com texto selecionável. Revise data, valor e tipo; os formatos variam entre bancos, então você confirma tudo antes de salvar.</p><span className="landing-feature-tag">Leitura no seu aparelho</span></article>
          <article className="landing-feature"><span className="landing-feature-number">03</span><span className="landing-feature-icon"><Target size={20}/></span><h3>Veja quais contas ainda vêm pela frente</h3><p>Anote vencimentos e compromissos para saber o que ainda precisa sair do caixa.</p><span className="landing-feature-tag">Veja o que vem pela frente</span></article>
          <article className="landing-feature"><span className="landing-feature-number">04</span><span className="landing-feature-icon"><Wallet size={20}/></span><h3>Transforme a vontade de guardar em uma meta</h3><p>Defina uma meta e acompanhe o valor reservado para dar um passo possível, mês a mês.</p><span className="landing-feature-tag">Uma meta de cada vez</span></article>
          <article className="landing-feature"><span className="landing-feature-number">05</span><span className="landing-feature-icon"><Building2 size={20}/></span><h3>Separe as contas do negócio das pessoais</h3><p>Acompanhe o MEI e sua vida pessoal em espaços separados, cada um com seus próprios dados.</p><span className="landing-feature-tag">PF e MEI separados</span></article>
          <article className="landing-feature"><span className="landing-feature-number">06</span><span className="landing-feature-icon"><Sparkles size={20}/></span><h3>Descubra o que mudou de um mês para o outro</h3><p>Compare seus registros entre períodos e identifique mudanças que podem merecer sua atenção.</p><span className="landing-feature-tag">Orientação com base nos seus registros</span></article>
        </div>
      </section>

      <section id="fatura-pdf" className="landing-statement">
        <div className="landing-statement-copy">
          <span className="landing-eyebrow"><FileText size={14}/> MENOS DIGITAÇÃO, MAIS CONTROLE SOBRE A FATURA</span>
          <h2>Sua fatura organizada para você revisar com calma.</h2>
          <p>Cadastre o cartão e envie um PDF compatível. O Clareia prepara uma lista de possíveis compras; você confere e corrige cada item antes de importar.</p>
          <ul className="landing-statement-benefits">
            <li><CheckCircle2 size={17}/> Veja as compras organizadas antes de confirmar</li>
            <li><CheckCircle2 size={17}/> Confira valores, datas e categorias com calma</li>
            <li><ShieldCheck size={17}/> O PDF é lido no seu aparelho e não é armazenado pelo Clareia</li>
          </ul>
          <p className="landing-statement-limit">Funciona com PDFs que têm texto selecionável, de até 15 MB e 40 páginas. Faturas digitalizadas podem não ser reconhecidas.</p>
          <button type="button" className="landing-primary-cta" onClick={() => startTrial()}><FileText size={17}/> Quero simplificar minha fatura <ArrowRight size={17}/></button>
          <span className="landing-statement-reassurance">Seu teste começa aqui. Sem cartão e sem cobrança automática.</span>
        </div>
        <div className="landing-statement-preview" aria-label="Exemplo ilustrativo da revisão de uma fatura">
          <div className="landing-statement-paper">
            <div className="landing-statement-paper-head"><span className="landing-statement-file-icon"><FileText size={19}/></span><span><strong>Fatura-cartao.pdf</strong><small>PRÉVIA ILUSTRATIVA · REVISÃO ANTES DE IMPORTAR</small></span><CheckCircle2 size={18}/></div>
            <div className="landing-statement-total"><span>Compras identificadas</span><strong>Confira cada lançamento</strong></div>
            <div className="landing-statement-row"><span><b>Mercado Central</b><small>12 mai · Alimentação</small></span><strong>R$ 186,40</strong><Check size={16}/></div>
            <div className="landing-statement-row"><span><b>Farmácia Saúde</b><small>14 mai · Saúde</small></span><strong>R$ 72,90</strong><Check size={16}/></div>
            <div className="landing-statement-row"><span><b>Loja Casa & Cia</b><small>Parcela 2 de 4 · revisar</small></span><strong>R$ 119,90</strong><Check size={16}/></div>
            <div className="landing-statement-review"><ShieldCheck size={16}/><span>Você confere os dados antes de salvar. Nada entra automaticamente.</span></div>
            <div className="landing-statement-confirm">Revisar e importar lançamentos <ArrowRight size={14}/></div>
          </div>
        </div>
      </section>

      <section className="landing-voice-band">
        <div className="landing-voice-orb"><Mic size={27}/></div><div><span className="landing-eyebrow">UM GASTO, UM REGISTRO, MENOS COISAS PARA LEMBRAR</span><h2>Registre do seu jeito. Confira. Volte ao seu dia.</h2><p>Diga “paguei 48 reais no mercado com Pix”. O Clareia prepara o registro para você conferir, sem depender da memória no fim do mês.</p></div><button type="button" onClick={() => startTrial()}>Quero começar grátis <ArrowRight size={16}/></button>
      </section>

      <section id="planos" className="landing-section landing-plans">
        <div className="landing-section-heading"><span className="landing-eyebrow">COMECE GRÁTIS POR 7 DIAS</span><h2>Pessoa física ou MEI: comece pelo que importa para você.</h2><p>Use o Clareia por 7 dias sem informar cartão. Depois, escolha se quer continuar: PF por R$ 19,90/mês ou MEI por R$ 29,90/mês.</p></div>
        <div className="landing-plan-grid">
          <article className="landing-plan-card"><div className="landing-plan-icon"><Wallet size={21}/></div><span className="landing-plan-label">PESSOA FÍSICA</span><h3>Tenha mais clareza sobre sua vida financeira</h3><div className="landing-plan-price"><strong>R$ 19,90</strong><span>/ mês após o teste</span></div><p>Acompanhe renda, despesas, contas, cartão e metas para decidir com mais clareza como usar seu dinheiro.</p><ul><li><Check size={15}/> Receitas e despesas pessoais</li><li><Check size={15}/> Metas mensais e reserva</li><li><Check size={15}/> Comparações e próximos passos</li></ul><button type="button" className="landing-plan-cta" onClick={() => startTrial('pf')}>Testar PF grátis por 7 dias <ArrowRight size={15}/></button></article>
          <article className="landing-plan-card landing-plan-mei"><div className="landing-plan-icon"><Building2 size={21}/></div><span className="landing-plan-label">MEI</span><h3>Cuide do caixa do seu negócio com mais clareza</h3><div className="landing-plan-price"><strong>R$ 29,90</strong><span>/ mês após o teste</span></div><p>Acompanhe entradas, despesas e compromissos do negócio, mantendo o financeiro pessoal em outro espaço.</p><ul><li><Check size={15}/> Receitas e despesas do MEI</li><li><Check size={15}/> Contas, cartões e compromissos</li><li><Check size={15}/> Visão do caixa e orientação</li></ul><button type="button" className="landing-plan-cta" onClick={() => startTrial('mei')}>Testar MEI grátis por 7 dias <ArrowRight size={15}/></button></article>
        </div>
        <p className="landing-plan-footnote"><LockKeyhole size={14}/> O teste não solicita cartão e não gera cobrança automática. Ao final, escolha se deseja assinar; seus dados permanecem salvos.</p>
      </section>

      <section className="landing-final-cta"><span className="landing-eyebrow">UM PASSO PEQUENO JÁ MUDA O JEITO DE OLHAR O MÊS</span><h2>Comece registrando o próximo gasto.</h2><p>São 7 dias grátis, sem cartão e sem cobrança automática. Você decide se quer continuar.</p><button type="button" className="landing-primary-cta" onClick={() => startTrial()}><Mic size={17}/> Quero começar grátis <ArrowRight size={17}/></button></section>

      <section id="duvidas" className="landing-faq"><div className="landing-section-heading"><span className="landing-eyebrow">ANTES DE COMEÇAR</span><h2>O que você precisa saber para começar.</h2></div><div className="landing-faq-grid"><details><summary>Como funciona o teste grátis?</summary><p>São 7 dias após o primeiro acesso, sem informar cartão. No fim, você escolhe se quer assinar; não há cobrança automática.</p></details><details><summary>Preciso preencher tudo de uma vez?</summary><p>Não. Você pode começar pelo que já sabe e completar as informações aos poucos. A Central mostra a próxima etapa sugerida.</p></details><details><summary>O áudio substitui minha revisão?</summary><p>Não. A fala vira um rascunho para você conferir e confirmar antes de salvar.</p></details><details><summary>O assistente acessa ou movimenta minha conta bancária?</summary><p>Não. O Clareia acompanha os dados que você registra, compara períodos e sugere próximos passos. Você revisa os lançamentos e decide o que fazer.</p></details><details><summary>Pessoa física e MEI ficam misturados?</summary><p>Não. Cada perfil tem um acesso e um conjunto de dados separado.</p></details><details><summary>O Clareia guarda minha gravação?</summary><p>O Clareia não armazena o áudio. O reconhecimento de voz depende do navegador e pode usar um serviço externo para transcrever.</p></details></div></section>

      <section id="acesso" className="landing-access">
        <div className="landing-access-intro"><span className="landing-eyebrow">SEU PRIMEIRO PASSO PARA MAIS CLAREZA</span><h2>Organize seu dinheiro a partir de hoje.</h2><p>Escolha Pessoa Física ou MEI e crie sua conta. Você começa com 7 dias grátis para conhecer o Clareia.</p><div className="landing-access-note"><ShieldCheck size={18}/><span>7 dias grátis, sem informar cartão e sem cobrança automática.</span></div></div>
        <div className="landing-auth-card">
          <div className="landing-auth-heading"><span>ACESSO CLAREIA</span><h3>{mode === 'signup' ? 'Seu teste começa aqui.' : 'Bem-vindo ao seu próximo passo.'}</h3><p>Escolha o perfil que quer organizar primeiro.</p></div>
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
            <button className="button primary login-submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'signup' ? `Criar minha conta ${profile === 'mei' ? 'MEI' : 'PF'} grátis` : `Entrar como ${profileName}`}<ArrowRight size={18}/></button>
          </form>
          <button className="auth-mode-toggle" type="button" onClick={() => {setMode(mode === 'signup' ? 'login' : 'signup');setError('');}}>{mode === 'signup' ? 'Já tem uma conta? Entrar' : 'Ainda não tem conta? Testar grátis por 7 dias'}</button>
          {mode === 'login' && <button className="auth-mode-toggle recovery-toggle" type="button" onClick={() => {setRecoveryOpen(!recoveryOpen);setRecoveryEmail(email);setRecoveryMessage('');setRecoveryError('');}}>Esqueceu sua senha?</button>}
          {mode === 'login' && recoveryOpen && <form className="account-auth-form recovery-form" onSubmit={requestRecovery}>
            <h4>Recuperar acesso</h4>
            <p>Informe o e-mail da conta. A recuperação respeita o acesso PF ou MEI cadastrado.</p>
            <label>E-mail da conta<input type="email" autoComplete="email" value={recoveryEmail} onChange={event => setRecoveryEmail(event.target.value)} maxLength={254} required/></label>
            {recoveryError && <p role="alert" className="login-error">{recoveryError}</p>}
            {recoveryMessage && <p role="status" className="recovery-status">{recoveryMessage} <a href="/suporte">Abrir suporte</a></p>}
            <button className="button secondary login-submit" disabled={recoveryBusy}>{recoveryBusy ? 'Registrando pedido…' : 'Solicitar recuperação'}</button>
          </form>}
          {mode === 'signup' && <p className="test-access-note">Teste grátis por 7 dias, sem cartão e sem cobrança automática. No fim, você escolhe se quer assinar.</p>}
          <div className="login-note"><LockKeyhole size={16}/><p>Para usar PF e MEI separadamente, cada perfil precisa de sua própria conta.</p></div>
        </div>
      </section>
      <div className="landing-install"><InstallAppCard prompt={installPrompt} onPromptUsed={onInstallUsed} variant="login"/></div>
    </main>
    <footer className="landing-footer"><a className="landing-brand" href="#inicio"><span><Compass size={18}/></span>clareia<span className="landing-brand-dot">.</span></a><p>Mais clareza para cuidar do que é seu. <a className="landing-privacy-link" href="/privacidade">Privacidade</a> · <a className="landing-privacy-link" href="/suporte">Suporte</a></p><a href="#acesso">Acessar o Clareia <ArrowUpRight size={14}/></a></footer>
  </div>;
}
