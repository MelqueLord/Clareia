import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Compass, Mail, Trash2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Excluir conta e dados · Clareia',
  description: 'Como excluir sua conta Clareia e os dados associados, inclusive após o período de teste.',
};

const contactEmail = 'jmelquesantos@gmail.com';

export default function DeleteAccountPage() {
  return (
    <main className="privacy-page">
      <header className="privacy-topbar">
        <Link className="privacy-brand" href="/"><span><Compass size={18}/></span>clareia<span className="privacy-brand-dot">.</span></Link>
        <Link className="privacy-back" href="/"><ArrowLeft size={15}/> Voltar ao Clareia</Link>
      </header>
      <article className="privacy-document">
        <div className="privacy-document-kicker"><Trash2 size={15}/> SUA CONTA E SEUS DADOS</div>
        <h1>Excluir minha conta</h1>
        <p className="privacy-lead">Você pode excluir sua conta Clareia mesmo depois de o teste gratuito vencer. A exclusão é permanente; exporte os dados que deseja guardar antes de continuar.</p>
        <section>
          <h2>Excluir dentro do aplicativo</h2>
          <ol>
            <li>Entre na conta PF ou MEI que deseja excluir.</li>
            <li>Abra <strong>Ajustes → Privacidade e sua conta → Excluir minha conta e meus dados</strong>. Se o teste venceu, a mesma opção aparece na tela de acesso vencido.</li>
            <li>Informe o e-mail e a senha atual, marque a confirmação e conclua a exclusão.</li>
          </ol>
          <p><Link className="privacy-inline-link" href="/">Abrir o Clareia para entrar na minha conta</Link></p>
        </section>
        <section>
          <h2>Solicitar exclusão sem acesso ao aplicativo</h2>
          <p>Envie a solicitação para o suporte pelo e-mail abaixo, preferencialmente a partir do endereço cadastrado. Informe que deseja excluir a conta Clareia e qual é o perfil, PF ou MEI. Não envie senha, código de acesso, link de recuperação ou fatura.</p>
          <a className="privacy-contact" href={`mailto:${contactEmail}?subject=${encodeURIComponent('Solicitação de exclusão de conta Clareia')}`}><Mail size={16}/>{contactEmail}</a>
          <p>O suporte precisará confirmar a titularidade antes de excluir os dados. Enviar a mensagem inicia a solicitação; não exclui a conta automaticamente.</p>
        </section>
        <section>
          <h2>O que é excluído</h2>
          <p>O cadastro, as sessões, os dados financeiros ativos, os snapshots operacionais e as inscrições de notificações vinculadas à conta são removidos. O aplicativo também tenta remover os rascunhos dessa conta no aparelho usado para concluir a exclusão. Uma conta separada PF ou MEI não é excluída junto.</p>
          <p>Cópias técnicas da infraestrutura seguem a retenção do provedor. Eventuais dados retidos por obrigação legal ficam restritos a essa finalidade. Veja os detalhes na <Link className="privacy-inline-link" href="/privacidade">política de privacidade</Link>.</p>
        </section>
      </article>
    </main>
  );
}
