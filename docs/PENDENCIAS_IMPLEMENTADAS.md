# Pendências implementadas — Clareia

Atualização: 30/10/2026, São Paulo. **Código validado localmente; liberação para dados reais e Google Play ainda pendente.**

## Aplicado no site

Novos cadastros foram fechados com `AUTH_SIGNUP_ENABLED=false` e a versão arquivada 72 foi republicada para aplicar a revisão de ambiente **12**. O Sites retornou `succeeded` no deploy `appgdep_6ae48527bc888191ab1290d36791f243`, às 08:53:30 de 30/10/2026 em São Paulo.

URL: https://clareia-financas-mei-pf.igrejamirc01.chatgpt.site

Essa configuração só controla novos cadastros. Não altera as contas existentes ou o público da hospedagem. `TRIAL_ADMIN_EMAIL` continua ausente, mantendo a mitigação anterior da administração. Não foram configuradas identidades administrativas, participantes ou chaves de e-mail. Nenhum registro de usuário ou lançamento foi alterado por esta atividade.

**A republicação é somente de configuração. O código novo não foi publicado.** A origem da versão 72 continua sendo `1ba99f0fa1bfb485767c499ad0d0a0fc1ba33dee`.

## Implementado e validado no código local

| Pendência | Alteração | Validação e limite |
| --- | --- | --- |
| Participantes da homologação | `AUTH_SIGNUP_POLICY=allowlist` e `AUTH_SIGNUP_ALLOWED_EMAILS`, com endereços exatos normalizados; lista vazia/inválida e política desconhecida recusam novos cadastros; chave global fechada prevalece | Testes com Better Auth real; nenhuma lista real foi configurada. Ausência da política preserva o comportamento anterior de cadastro; usar o template fechado na homologação |
| Aparelho compartilhado | Saída bem-sucedida remove rascunhos da conta; pede confirmação se há rascunhos não enviados; falha de logout não é exibida como sucesso | Limpeza por ID conferida com armazenamento de duas contas; interação no aparelho ainda pendente |
| Respostas antigas após sair/excluir | Carregamentos e gravações que terminam depois de encerrar a sessão são descartados pela interface; dados, edição, pesquisa, voz, revisão e avisos são limpos | Lint, tipagem e build; sem ensaio de corrida em navegador nesta sessão |
| Exclusão sem entrar na conta | Página pública `/excluir-conta`, com caminho no app e solicitação por e-mail; link na política | Compilação aprovada e rota adicionada ao smoke. Atendimento exige acompanhamento e confirmação de titularidade; nenhum e-mail foi enviado |
| Jornada integrada | Duas contas PF e uma MEI com Better Auth real, senhas, cookies, APIs de dados e exportação; recusa de senha incorreta, persistência após novo login, isolamento, perfil fixo, logout e exclusão após vencimento | SQLite com as 9 migrações; não comprova infraestrutura ou navegador publicado |
| Ferramentas de teste | Carregador usa `APIError` real para verificar status de recusas; clientes fictícios independentes evitam esgotar o limite durante o ensaio rápido | Proteção de rate limit da aplicação permanece habilitada; esses testes não certificam limites de antiabuso |

As correções anteriores de administrador por ID + e-mail, recuperação de senha, PDF, lint e exclusão no teste vencido continuam no checkout e foram incluídas no gate completo.

## Evidência técnica desta execução

`npm run check:homologation` terminou com código **0**:

- ESLint geral: sem erros ou avisos.
- Suíte: **78 aprovados**, 0 falhas, 0 ignorados.
- TypeScript e build: aprovados.
- Ensaio SQLite de 9 migrações, backup e restauração: `PASSED_LOCAL_ONLY`.

`npm run test:journey` permite repetir os 8 cenários adicionais. O smoke anônimo agora contém 12 rotas, incluindo `/excluir-conta`; ele não foi classificado como aprovado no endereço publicado.

Ver [EVIDENCIA_PENDENCIAS.json](EVIDENCIA_PENDENCIAS.json), [TESTES.md](TESTES.md) e [BANCO_HOMOLOGACAO.md](BANCO_HOMOLOGACAO.md).

## O que ainda impede a conclusão

1. **Publicar código:** uma nova abertura pelo helper oficial Sites falhou com `Could not resolve host: git.chatgpt-team.site`. Não houve push, commit novo no repositório de origem nem versão nova. O DNS do site também permanece inacessível ao executor. É necessário usar um ambiente com conectividade permitida para concluir o mesmo fluxo de publicação; não alterar DNS, proxy ou TLS para contornar a restrição.
2. **Recuperação de senha por e-mail:** criar/configurar o serviço Resend, verificar remetente e definir `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no painel seguro; depois comprovar entrega real. Nunca colocar segredos em chat ou no Git. O transporte simulado dos testes não comprova recebimento de e-mail.
3. **Responsável administrativo:** confirmar titularidade da conta e configurar ID + e-mail somente depois de publicar o código corrigido. Não restaurar o e-mail administrativo na versão 72.
4. **Homologação e banco:** identificar banco exclusivo e obter do provedor um caminho suportado para exportar e restaurar em outra base. A ferramenta atual não oferece essas operações; presença de colunas não comprova histórico de migrações nem recuperação remota.
5. **Aceite final:** executar o navegador publicado e aparelhos Android/iPhone, incluindo PDF, persistência e isolamento. A lista de participantes limita endereços de cadastro, mas não comprova sua titularidade; confirmação prévia continua necessária. Não há convites por token ou verificação automática de e-mail implementados.
6. **Google Play:** gerar e assinar o projeto Android, revisar cobrança e preencher a loja somente após a versão candidata estar publicada e validada. Nenhum APK/AAB foi gerado nesta etapa.

Não reabrir o cadastro amplo para substituir a lista de participantes ainda não publicada. O estado de liberação continua pendente; a preparação local não equivale à homologação com usuários reais.
