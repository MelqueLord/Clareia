import type { Metadata } from 'next';
import { ArrowLeft, Compass, Mail, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacidade · Clareia',
  description: 'Entenda quais dados o Clareia utiliza, como são protegidos e como solicitar a exclusão da conta.',
};

const contactEmail = 'jmelquesantos@gmail.com';

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <header className="privacy-topbar">
        <a className="privacy-brand" href="/"><span><Compass size={18}/></span>clareia<span className="privacy-brand-dot">.</span></a>
        <a className="privacy-back" href="/"><ArrowLeft size={15}/> Voltar ao Clareia</a>
      </header>

      <article className="privacy-document">
        <div className="privacy-document-kicker"><ShieldCheck size={15}/> SEUS DADOS, SOB SEU CONTROLE</div>
        <h1>Política de privacidade</h1>
        <p className="privacy-updated">Atualizada em 24 de outubro de 2026</p>
        <p className="privacy-lead">O Clareia ajuda você a organizar suas finanças pessoais ou do MEI. Esta página explica, em linguagem simples, quais dados usamos, para quê e como você pode pedir acesso, correção ou exclusão.</p>

        <section><h2>1. Dados tratados</h2><p>Para criar e proteger sua conta, usamos nome, e-mail, senha protegida por mecanismo de autenticação e informações técnicas da sessão. Os dados financeiros que você escolhe registrar podem incluir receitas, despesas, contas, cartões, parcelas, metas, investimentos e observações. Pessoa Física e MEI são perfis separados.</p></section>
        <section><h2>2. Como usamos os dados</h2><p>Usamos essas informações para autenticar seu acesso, salvar seus lançamentos, calcular saldos e projeções, comparar períodos, exibir metas e oferecer orientações dentro do Clareia. Não vendemos seus dados pessoais.</p></section>
        <section><h2>3. Áudio e reconhecimento de voz</h2><p>Quando você usa o microfone, o navegador ou o dispositivo pode processar sua fala por meio de um serviço de reconhecimento de voz. O Clareia não armazena a gravação de áudio. O texto reconhecido aparece como rascunho para você revisar; somente o lançamento confirmado é enviado e salvo no Clareia.</p></section>
        <section><h2>4. Armazenamento e proteção</h2><p>Os dados da conta e os registros financeiros são armazenados na infraestrutura de hospedagem e banco de dados do serviço, com separação por conta autenticada. O acesso é protegido por senha e sessão. O aplicativo cria cópias operacionais dos dados para manter o histórico de alterações.</p><p>O provedor de infraestrutura pode processar dados em locais necessários à operação do serviço, de acordo com seus próprios termos e medidas de segurança.</p></section>
        <section><h2>5. Por quanto tempo guardamos</h2><p>Mantemos os dados enquanto a conta estiver ativa para que o serviço funcione. O aplicativo elimina cópias operacionais com mais de 30 dias na próxima gravação de dados. Quando você exclui a conta, o Clareia apaga o cadastro, encerra as sessões e remove os dados financeiros ativos e as cópias do aplicativo vinculadas aos perfis PF e MEI. Cópias técnicas de infraestrutura podem seguir o ciclo limitado de retenção do provedor; informações que precisem ser mantidas por obrigação legal serão restritas ao cumprimento dessa obrigação.</p></section>
        <section><h2>6. Seus direitos e contato</h2><p>Você pode solicitar confirmação do tratamento, acesso, correção, portabilidade quando aplicável, informação sobre o uso e eliminação de dados, conforme a legislação de proteção de dados. Para exercer esses direitos ou tirar dúvidas, escreva para:</p><a className="privacy-contact" href={`mailto:${contactEmail}`}><Mail size={16}/>{contactEmail}</a><p>O pedido de exclusão também pode ser feito dentro do aplicativo em <strong>Ajustes → Privacidade e sua conta → Excluir minha conta e meus dados</strong>. Para proteger sua conta, o aplicativo pede a senha atual e a confirmação do e-mail.</p></section>
        <section><h2>7. Base legal</h2><p>O tratamento ocorre conforme a finalidade do serviço e as hipóteses previstas na Lei Geral de Proteção de Dados Pessoais (LGPD). Você pode consultar o texto da <a className="privacy-inline-link" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm" target="_blank" rel="noreferrer">Lei nº 13.709/2018</a>.</p></section>

        <div className="privacy-document-footer"><span>Clareia · Mais clareza para cuidar do que é seu.</span><a href="/">Voltar ao início</a></div>
      </article>
    </main>
  );
}
