# Homologação com usuários reais — Clareia

Use este roteiro junto com [a auditoria](AUDITORIA_HOMOLOGACAO.md). Situação inicial em 29/10/2026: **liberação bloqueada**. Uma linha pendente não representa aprovação.

## Ambiente e responsáveis

Preencher antes dos convites:

| Item | Registro |
| --- | --- |
| URL HTTPS exclusiva da homologação | Pendente |
| Identificação do banco D1 exclusivo | Pendente |
| Responsável técnico / responsável pelo suporte | Pendente |
| Versão, commit e data de publicação | Pendente |
| Grupo inicial | Proposta: até 5 pessoas, incluindo PF e MEI |
| Prazo e horário de acompanhamento | Proposta: uma semana; horário a definir |
| Canal para reportar problemas | Página `/suporte`; confirmar acompanhamento do e-mail informado |
| Responsável e método de restauração | Pendente |

O app publicado hoje usa um endereço público. Criar um ambiente separado evita misturar os testes com a base existente. Não copie registros pessoais da base atual. Se um projeto Sites separado for criado, ele deve ter sua própria identidade e seu próprio banco; não reutilizar a identificação do site atual por acidente.

## Preparar a publicação

1. Conferir as alterações existentes e corrigir os P0/P1 da auditoria. A proteção administrativa por ID deve entrar na versão publicada.
2. Configurar o binding `DB` no ambiente escolhido. Conferir tabelas e migrações `0000` a `0008`. Aplicar somente as migrações faltantes, em ordem; não repetir todos os SQLs em uma base existente nem usar o ID placeholder do preview para uma operação remota.
3. Copiar os **nomes** de `deploy/homologation/env.example` para o painel. Gerar o segredo de autenticação no gerenciador de segredos, configurar a URL final e manter chaves Asaas ausentes. O template não é carregado automaticamente pelo app.
4. Criar/confirmar a conta do responsável em janela de acesso controlada. Comprovar titularidade e vincular `TRIAL_ADMIN_USER_ID` e `TRIAL_ADMIN_EMAIL` conforme [ADMIN.md](ADMIN.md). Não aceitar um ID informado por um visitante.
5. Configurar Resend com remetente verificado e testar a caixa do responsável e uma conta participante. `RESEND_REPLY_TO` é opcional; API key e remetente são necessários para envio.
6. Definir cadastro acompanhado: configurar `AUTH_SIGNUP_POLICY=allowlist` e preencher `AUTH_SIGNUP_ALLOWED_EMAILS` no painel seguro com os e-mails exatos previamente confirmados. Lista vazia ou inválida recusa novos cadastros. Abrir `AUTH_SIGNUP_ENABLED` somente na janela necessária e fechar depois. Esses controles não revogam sessões ou contas existentes; a lista não comprova posse do e-mail. Não há envio de convite nem verificação automática de e-mail implementados.
7. Executar no commit candidato:

   ```powershell
   npm run check:homologation
   ```

   O gate inclui lint geral sem avisos (incluindo os testes), suíte, TypeScript, build e o ensaio local de migrações/backup/restauração. As pendências de lint da auditoria foram corrigidas localmente. Executar no commit candidato antes da publicação.

8. Publicar a versão candidata e registrar commit, versão, data e configuração utilizada. O comando de build sozinho não publica.
9. Executar, fora de uma rede com bloqueio de DNS:

   ```powershell
   npm run smoke:homologation -- https://endereco-da-homologacao
   ```

   O comando faz somente GETs anônimos, não segue redirecionamentos, não autentica e não mostra conteúdo das respostas. Espera `401` nas APIs financeiras e `403` nas APIs administrativas. Um erro de conexão deixa a checagem pendente; não prova defeito do app. Se a hospedagem tiver uma camada de autenticação antes da aplicação, o redirecionamento será apontado e essa camada deverá ser validada separadamente, sem removê-la para satisfazer o script.

## Jornada de aceite antes dos convites

Usar contas fictícias exclusivas com senhas próprias, sem reaproveitar contas pessoais de participantes. PF e MEI são contas separadas; o mesmo e-mail só pode pertencer a um perfil. Registrar data, aparelho, navegador e resultado em cada linha. Não anexar senhas, cookies, tokens ou faturas pessoais às evidências.

| ID | Verificação | Resultado esperado | Evidência / situação |
| --- | --- | --- | --- |
| A01 | Criar conta PF e outra MEI, com e-mails distintos | Perfis corretos; sessão iniciada; dados iniciais vazios | Pendente |
| A02 | E-mail duplicado, perfil errado, senha incorreta | Mensagem compreensível; nenhuma segunda conta indevida | Pendente |
| A03 | Entrar em outro navegador e renovar a página | Dados recuperados da mesma conta; sem dependência do cache | Pendente |
| A04 | Logout e tentativa com cookie anterior | Sessão revogada; APIs financeiras negam acesso | Pendente |
| A05 | Recuperar senha na caixa real controlada pelo testador | Link recebido, válido uma vez; senha anterior e sessões antigas deixam de funcionar | Pendente |
| A06 | Link expirado ou reutilizado | Recusa segura, sem troca da senha | Pendente |
| A07 | Nova conta com e-mail reservado do administrador | Cadastro negado; nenhuma elevação de privilégio | Pendente |
| A08 | Conta comum chama endpoints administrativos | Acesso negado; não vê usuários, pedidos de suporte ou links de recuperação | Pendente |
| A09 | Administrador confirmado entra no painel | Gestão disponível apenas para a identidade vinculada | Pendente |
| F01 | Cadastrar conta e saldo fictício | Saldo inicial correto após reabrir a sessão | Pendente |
| F02 | Receita de R$ 1.000,00 e despesa paga de R$ 38,50 | Partindo de zero, saldo R$ 961,50 | Pendente |
| F03 | Compra de R$ 100,00 em 3 parcelas | Parcelas somam R$ 100,00; caixa só muda no pagamento da fatura | Pendente |
| F04 | Contas simultâneas de dois usuários PF e um MEI | Nenhum lançamento, rascunho ou configuração aparece na conta alheia | Pendente |
| F05 | Duas sessões editam a mesma revisão | Uma gravação aceita; outra recebe conflito; nenhum dado some silenciosamente | Pendente |
| F06 | Voz: “trinta e oito reais e cinquenta centavos” | R$ 38,50 no rascunho, revisão antes de gravar | Pendente |
| F07 | Negar microfone ou usar aparelho sem reconhecimento | Registro manual continua disponível | Pendente |
| F08 | PDF autorizado com texto e PDF inválido | Prévia correta no compatível; mensagem compreensível no inválido; sem travar a próxima importação | Pendente |
| F09 | Reimportar PDF, parcelas e estorno | Duplicatas sinalizadas; valores/datas/parcelas revisáveis; total conferido | Pendente |
| F10 | Desconectar a rede e voltar | Sem mensagem falsa de gravação no servidor; rascunho recuperável só para seu usuário | Pendente |
| D01 | Exportar e conferir o arquivo | JSON abre e contém somente os registros da própria conta | Pendente |
| D02 | Vencer somente a conta fictícia no banco de homologação | Edição bloqueada; exportação e exclusão continuam acessíveis | UI e API verificadas localmente; pendente no endereço publicado |
| D03 | Excluir uma conta fictícia com a senha atual | Login, sessões, dados e snapshots dessa conta removidos; outra conta preservada | Pendente |
| D04 | Tentativa de exclusão com senha incorreta | Nenhum dado removido | Pendente |
| D05 | Restaurar backup em banco separado | Dados e revisões conferidos; sessões e exclusões tratadas antes de qualquer uso | Ensaio SQLite local aprovado; recuperação D1 remota pendente — ver BANCO_HOMOLOGACAO.md |
| M01 | Android/Chrome e iPhone/Safari | Telas, teclado, campos monetários e navegação utilizáveis | Pendente |
| M02 | Instalar PWA e atualizar a versão | Ícone e abertura corretos; nova versão recebida; offline sem vazamento de dados | Pendente |
| M03 | Push, se oferecido ao grupo | Permissão respeitada; entrega e horário conferidos; sem valores financeiros na mensagem | Pendente ou retirar do escopo |

Testes automatizados complementam esta matriz; não marcar linhas como aprovadas só porque `npm test` passou.

## Acompanhamento dos participantes

Enviar convite somente depois de encerrar os bloqueios. O convite deve explicar que é homologação gratuita, informar prazo, suporte, limitações PDF/voz e como exportar e excluir dados. Pedir o mínimo de dados necessário; começar com valores fictícios e permitir participação sem envio de faturas.

Registrar problemas com ID, versão, aparelho, passos, resultado esperado, resultado observado e gravidade. Se precisar de captura, remover valores e dados de terceiros. Nunca pedir senha ou link de recuperação. Manter a lista de participantes e seus contatos em local restrito, fora do repositório.

Suspender novos convites imediatamente se ocorrer mistura de contas, acesso administrativo indevido, perda de lançamentos, cobrança inesperada ou recuperação de acesso entregue à pessoa errada. Encerrar sessões afetadas quando necessário; avaliar alcance antes de restaurar dados.

## Backup e retorno à versão anterior

- Antes da publicação, registrar a versão estável e um ponto recuperável do banco. Os snapshots dentro do próprio D1 não cobrem perda do banco.
- Ensaiar restauração em uma base separada e conferir contagens, registros e revisões; não testar recuperação sobre a base dos participantes.
- Planejar invalidação de sessões e reaplicação das exclusões feitas depois do backup, evitando reativar usuários apagados.
- Em incidente, fechar novos cadastros, preservar evidências sem conteúdo financeiro e interromper gravações se a integridade estiver em dúvida. `AUTH_SIGNUP_ENABLED=false` sozinho **não interrompe gravações** de quem já possui conta.
- Reverter o código para uma versão compatível com o esquema atual. Não reverter SQL destrutivo por tentativa. A versão 72 ainda contém a autorização antiga do administrador e não é uma opção segura de retorno sem mitigação.
- Reexecutar as checagens e os cenários afetados antes de retomar.

## Critério para liberar

A liberação exige todos os P0/P1 encerrados, gate técnico aprovado, matriz essencial executada no ambiente final, recuperação e restauração demonstradas e responsável de suporte definido. Pagamento real continua fora do escopo. Nenhum destes documentos constitui evidência de que as etapas pendentes já ocorreram.

## Tentativa no endereço publicado — 30/10/2026

A jornada final foi tentada, mas a resolução DNS retornou `ENOTFOUND` nesta sessão. O smoke HTTP não recebeu resposta em nenhuma das 11 rotas. O Sites confirmou a versão 72, revisão de ambiente 11, e o overview remoto confirmou `DB` com 13 tabelas. Não foram criadas ou excluídas contas, nem lidos registros pessoais. Os fluxos PF/MEI, login, persistência, isolamento, PDF, exportação e exclusão continuam sem aprovação no endereço final. Ver [VALIDACAO_ENDERECO_FINAL.md](VALIDACAO_ENDERECO_FINAL.md).


## Evidências do banco — 30/10/2026

Ver [BANCO_HOMOLOGACAO.md](BANCO_HOMOLOGACAO.md), com resultado local reproduzível, metadados das colunas remotas e bloqueios. A presença de colunas novas no site existente não comprova o histórico completo de migrações. Backup e restauração remotos seguem pendentes; não liberar D05 com base no ensaio SQLite.


## Implementação das pendências — 30/10/2026

Consultar [PENDENCIAS_IMPLEMENTADAS.md](PENDENCIAS_IMPLEMENTADAS.md) para alterações e limites desta entrega. O cadastro por lista, a limpeza de rascunhos ao sair e a página `/excluir-conta` estão no código local. A jornada automatizada com Better Auth real usa somente SQLite e contas fictícias; não aprova a matriz no site publicado. Não houve configuração de participantes, remetente de e-mail, identidade administrativa ou restauração remota.
