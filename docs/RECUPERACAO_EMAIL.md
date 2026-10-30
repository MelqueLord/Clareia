# Recuperação de senha por e-mail — Clareia

## Estado e limites

A integração usa a API HTTPS do Resend no servidor e o fluxo de recuperação do Better Auth. A conta Resend ainda não foi criada pelo responsável; `RESEND_API_KEY` e `RESEND_FROM_EMAIL` continuam ausentes na hospedagem. **O envio real não está ativo nem foi validado em uma caixa de entrada.** Não foram cadastrados remetentes ou segredos fictícios no ambiente publicado.

Há 13 testes de recuperação com a versão instalada do Better Auth, usando as migrações reais em SQLite em memória. Senhas são verificadas e cookies assinados pelo Better Auth real; somente o runtime Cloudflare e o transporte de e-mail são substituídos. Isso verifica o fluxo sem enviar mensagens externas. A execução não comprova o adaptador D1 remoto, DNS do remetente, entrega ou reputação do domínio.

O código novo permanece local até que seja possível enviar a origem e publicar pelo Sites. A falha de DNS observada em `git.chatgpt-team.site` não deve ser contornada publicando um arquivo com um commit que não corresponda ao seu conteúdo.

## Configurar o provedor

1. Criar a conta em https://resend.com e adicionar um domínio ou subdomínio **próprio** para envio. O endereço público do aplicativo não comprova que o responsável pode administrar seu DNS.
2. Copiar os registros DNS apresentados pelo Resend para o provedor que administra esse domínio. Aguardar o estado verificado para envio; não inventar registros SPF/DKIM nem remover registros existentes por tentativa.
3. Criar uma API key com permissão **Sending access**, restrita ao domínio de envio quando possível. Não é necessária uma chave com acesso completo à conta para o aplicativo enviar mensagens.
4. Definir um remetente desse domínio, por exemplo `Clareia <acesso@seu-dominio.com.br>`. O exemplo deve ser substituído por um endereço autorizado. Para a recuperação, manter rastreamento de abertura e clique desabilitado no domínio transacional.
5. No painel seguro da hospedagem Sites, configurar as variáveis da tabela abaixo. A chave não deve ser enviada pelo chat, incluída em capturas, arquivos Git ou argumentos de terminal.
6. Publicar o código corrigido e aplicar a configuração na mesma publicação. Alterar as variáveis sem republicar não comprova que o Worker em execução já usa os valores novos.
7. Fazer o teste de caixa de entrada abaixo com uma conta controlada pelo responsável. Um aceite HTTP da API não equivale à entrega final do e-mail.

| Variável | Obrigatória | Valor |
| --- | --- | --- |
| `RESEND_API_KEY` | Sim | Chave do Resend, salva como segredo no painel |
| `RESEND_FROM_EMAIL` | Sim | Nome e endereço autorizado do remetente |
| `RESEND_REPLY_TO` | Não | Endereço monitorado para respostas, se desejado |
| `BETTER_AUTH_URL` | Sim | Origem HTTPS exata do aplicativo publicado |
| `BETTER_AUTH_SECRET` | Sim | Segredo existente da autenticação; não trocar apenas para configurar e-mail |
| `DB` | Sim | Binding D1 existente com as migrações de autenticação aplicadas |

Não é preciso ativar ou restaurar `TRIAL_ADMIN_EMAIL` para enviar a recuperação automática. A administração continua sujeita à [publicação de segurança](PUBLICACAO_ADMIN.md). Sem e-mail configurado, ou em falha do provedor, o pedido pode cair na fila de suporte; ela só é acessível a um administrador autorizado e está indisponível enquanto a administração estiver bloqueada. Essa alternativa não substitui o envio real para o piloto.

## Comportamento implementado

- O cliente recebe a mesma mensagem para e-mails cadastrados e não cadastrados.
- O link aponta somente para `/redefinir-senha` na origem configurada; HTTP é aceito apenas para desenvolvimento em loopback. Links externos, credenciais na URL, fragmentos e parâmetros inesperados são recusados pelo remetente.
- O texto HTML escapa o nome do usuário. A chave de envio não aparece no corpo da mensagem, e o token não é usado diretamente no cabeçalho de idempotência.
- A chamada ao Resend tem limite de 8 segundos, não segue redirecionamentos e só considera o pedido aceito quando recebe uma resposta de sucesso com ID da mensagem.
- Falha de envio preserva a alternativa de suporte. Uma falha atrasada não reinsere um token já substituído ou consumido.
- O Better Auth controla a validade de uma hora e o uso único do token; uma troca bem-sucedida revoga as sessões anteriores. Pedido novo invalida o link anterior.
- Uma senha recusada pela política não consome o token. A recuperação de uma conta não altera a sessão ou o link de outra conta.

## Verificação automatizada

```powershell
npm run test:recovery
npm run check
```

A suíte dedicada cobre troca efetiva de senha, rejeição da senha anterior, revogação de sessão, uso único, expiração, substituição de link, senha fraca, retorno externo, não divulgação de cadastro, isolamento entre contas, e-mail sem configuração, falha de rede, rejeição do provedor, resposta inválida, HTML, cabeçalhos e duas condições de concorrência na fila de suporte.

O lint geral da interface ainda tem pendências registradas na auditoria; a validação dos arquivos de recuperação é feita separadamente, sem desativar regras.

## Teste de entrega e aceite

Usar o endereço de uma conta fictícia pertencente ao responsável; não testar em endereços de terceiros.

| Etapa | Resultado esperado | Situação |
| --- | --- | --- |
| Conta Resend e domínio | Domínio com envio verificado; chave restrita criada | Pendente |
| Configuração e publicação | Versão e revisão de ambiente registradas | Pendente |
| Pedir recuperação pela tela de acesso | Resposta genérica; token ausente no corpo HTTP | Pendente no ambiente publicado |
| Abrir a caixa de entrada e o spam | E-mail recebido, remetente correto e domínio do link igual ao aplicativo | Pendente |
| Conferir no Resend | Aceite e estado de entrega da mensagem; investigar rejeição/bounce | Pendente |
| Solicitar um segundo link | Link anterior recusado; novo link aceito | Pendente no ambiente publicado |
| Definir nova senha | Nova senha entra; antiga não entra; sessão de outro navegador encerrada | Pendente no ambiente publicado |
| Reutilizar link / testar expirado | Link recusado sem alterar a senha | Pendente no ambiente publicado |
| Endereço sem cadastro | Mesma resposta, sem e-mail ou link indevido | Pendente no ambiente publicado |

Não guardar tokens, links de recuperação, senhas ou a chave API nas evidências. Não marcar o teste de entrega como aprovado apenas porque o aplicativo ou o Resend retornou sucesso.

## Referências oficiais

- Verificação de domínio e configurações transacionais: https://resend.com/docs/dashboard/domains/introduction
- API de envio: https://resend.com/docs/api-reference/emails/send-email
- Chaves restritas: https://resend.com/changelog/new-api-key-permissions
- Recuperação Better Auth: https://better-auth.com/docs/authentication/email-password

## Resultado desta implementação

Os 13 testes dedicados passaram. O comando npm run check terminou com código zero: 67 testes aprovados, nenhum reprovado ou ignorado, lint dos testes, TypeScript e build aprovados. O lint específico de lib/recovery-email.ts, lib/auth.ts e tests/recovery.cjs também passou sem avisos. A consulta à configuração publicada confirmou as credenciais Resend ausentes; não houve envio externo. O repositório de origem continua retornando ENOTFOUND nesta sessão, portanto a versão corrigida não foi publicada.
