import type { Metadata } from 'next';
import { ArrowLeft, Compass, HelpCircle, Mail, Mic, ShieldCheck, Smartphone } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Suporte · Clareia',
  description: 'Ajuda para entrar, recuperar o acesso e usar o Clareia no celular.',
};

const supportEmail = 'jmelquesantos@gmail.com';

export default function SupportPage() {
  const subject = encodeURIComponent('Ajuda com o Clareia');
  const body = encodeURIComponent('Olá, preciso de ajuda com o Clareia.\n\nE-mail da conta:\nPerfil (Pessoa Física ou MEI):\nO que aconteceu:\nAparelho e navegador:');
  return <main className="support-page"><header className="support-topbar"><a className="support-brand" href="/"><span><Compass size={18}/></span>clareia<span>.</span></a><a className="support-back" href="/"><ArrowLeft size={15}/> Voltar ao Clareia</a></header>
    <article className="support-document"><div className="support-kicker">AJUDA PARA CONTINUAR</div><h1>Suporte e recuperação</h1><p className="support-lead">Conte o que aconteceu e informe qual acesso está usando. Pessoa Física e MEI têm contas independentes; use o e-mail e a senha da conta correspondente.</p>
      <a className="support-contact" href={`mailto:${supportEmail}?subject=${subject}&body=${body}`}><Mail size={18}/><span><strong>Falar com o suporte</strong><small>{supportEmail}</small></span></a>
      <section><h2><HelpCircle size={17}/> Não consegue entrar?</h2><ol><li>Na tela inicial, selecione Pessoa Física ou MEI.</li><li>Toque em <strong>Esqueceu sua senha?</strong> e informe o e-mail cadastrado.</li><li>O Clareia registra o pedido sem confirmar se aquele e-mail tem uma conta.</li><li>Como o envio automático de e-mail ainda não foi configurado, escreva para o suporte. O responsável verifica o pedido no painel e envia um link temporário.</li></ol></section>
      <section><h2><Smartphone size={17}/> Está usando no celular?</h2><p>Abra o Clareia no Chrome (Android) ou Safari (iPhone). Para atualizar uma versão instalada, feche e abra o app novamente com internet. Se a tela antiga continuar, remova o ícone da tela inicial e adicione de novo pelo menu do navegador.</p></section>
      <section><h2><Mic size={17}/> Microfone travou?</h2><p>Feche a janela de gravação, confira a permissão do microfone no navegador e tente novamente. Se não funcionar, digite o lançamento; nenhuma gravação é necessária para usar o controle financeiro.</p></section>
      <section><h2><ShieldCheck size={17}/> O que informar ao suporte?</h2><p>Envie o e-mail da conta, se é PF ou MEI, o modelo do aparelho, navegador e uma descrição do problema. Nunca envie sua senha. Para sua segurança, a equipe não precisa dela para orientar ou recuperar o acesso.</p></section>
      <div className="support-footer"><span>Clareia · Mais clareza para cuidar do que é seu.</span><a href="/privacidade">Privacidade</a></div>
    </article>
  </main>;
}
