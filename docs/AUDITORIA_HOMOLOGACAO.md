# Auditoria de preparação para homologação — Clareia

Data: 29/10/2026. Decisão: **não liberar ainda para participantes com dados pessoais reais**.

O código tem uma base funcional e as correções anteriores estão no checkout, mas a publicação ainda não as recebeu. Há dependências de operação sem configuração e verificações de integração sem evidência. Este documento registra o que foi observado, não certifica a segurança do produto.

## Evidências consultadas

- Código local, alterações existentes e histórico Git; nenhuma alteração anterior foi descartada.
- `npm run check`: lint dos testes, 49 testes existentes, TypeScript e build aprovados antes da preparação desta auditoria.
- Após adicionar os testes da nova ferramenta HTTP: **53 testes aprovados**, sem falhas ou ignorados; lint dos testes e dos arquivos novos aprovado.
- `npm run lint -- --format json --output-file .sites-runtime/audit-eslint.json`: **23 erros e 22 avisos**. O arquivo de resultado é temporário e não entra no Git.
- Sites: publicação da versão **72**, deploy com estado `succeeded`, commit de origem `1ba99f0fa1bfb485767c499ad0d0a0fc1ba33dee`, concluído em 28/10/2026 às 19:31 no horário de São Paulo. É o HEAD local anterior às correções não commitadas.
- Configuração de acesso publicada: `public`; variáveis na revisão 10. Foram consultados nomes e presença das variáveis; segredos mascarados não tiveram sua qualidade validada.
- Tentativa de HTTP direto ao domínio publicado: falhou por resolução DNS (`ENOTFOUND`) nesta sessão. Isso **não comprova indisponibilidade pública** do site.
- Tentativa de integrar Worker + D1 local isolado: Wrangler falhou com `fetch failed` na preparação do D1. Não foi concluída a jornada com Better Auth real. Não foram usadas contas ou bases reais.

A consulta de metadados confirmou a publicação; não confirmou comportamento de login, cookies, entrega de e-mails, execução do cron ou esquema do banco remoto.

## Bloqueios de liberação

| Prioridade | Achado | Evidência | Critério para encerrar |
| --- | --- | --- | --- |
| P0 | A publicação ainda usa a autorização antiga do administrador, baseada apenas no e-mail | A versão 72 corresponde ao HEAD; `git show HEAD:lib/trial-admin.ts` compara somente e-mail. A correção por ID está fora desse commit | Conferir titularidade, configurar ID e e-mail, publicar a correção e comprovar recusa de uma conta comum |
| P0 | `TRIAL_ADMIN_USER_ID` ausente na hospedagem | Relação atual de variáveis de runtime | Configurar o ID exato da conta confirmada; a versão corrigida bloqueia o administrador sem essa variável |
| P1 | Recuperação automática por e-mail não configurada | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `RESEND_REPLY_TO` ausentes; o código usa fila de suporte como alternativa | Remetente verificado; mensagem chega à caixa correta; link expira e só funciona uma vez; sessões antigas revogadas |
| P1 | Piloto sem controle de quem entra | Site público; `AUTH_SIGNUP_ENABLED=true`; limite de 30 contas. O limite é de quantidade, não de convidados | Definir participantes e controle de entrada. Fechar cadastro após janela acompanhada, ou implementar convites/lista permitida antes de distribuir amplamente |
| P1 | Migrações e recuperação do banco remoto sem comprovação | Existem migrações `0000` a `0008`; os testes as aplicam em SQLite em memória. O D1 publicado não foi inspecionado | Banco exclusivo identificado, esquema conferido, migrações faltantes aplicadas uma única vez e restauração ensaiada |
| P1 | Jornada com autenticação real sem execução completa | A suíte substitui Better Auth por um provedor simulado; tentativa local de integração não terminou | Cadastro PF/MEI, cookies, login, senha, logout, persistência, isolamento e exclusão aprovados no endereço final |
| P1 | Lint geral reprovado e ausente do gate antigo | 23 erros e 22 avisos; `check` inclui apenas `lint:tests` | Corrigir os diagnósticos e passar no novo `npm run check:homologation`, sem suprimir regras indiscriminadamente |
| P1 | Conta vencida perde o caminho de exclusão pela interface | `FinanceApp` retorna `TrialPaywall` antes de renderizar `AccountPrivacyPanel`; paywall tem exportação e saída | Expor exclusão também no acesso vencido e validar com a senha atual, preservando outras contas |

P0: resolver antes de qualquer convite. P1: resolver ou obter evidência antes de usar dados reais no piloto.

## Configuração publicada observada

| Item | Situação |
| --- | --- |
| Site | Ativo, público |
| URL da autenticação | Corresponde à URL HTTPS publicada |
| Segredo Better Auth | Cadastrado como segredo; valor e robustez não inspecionados |
| Cadastro | Aberto |
| Limite do piloto | 30 contas |
| Duração do teste | 30 dias |
| E-mail administrativo | Configurado |
| ID administrativo | Ausente |
| Resend | Ausente |
| Asaas | Nenhuma variável Asaas retornada; o código usa modo manual sem as chaves |
| VAPID | Chave pública e segredo privado cadastrados; entrega não testada |
| Banco D1 exclusivo / migrações remotas | Não comprovados |

Não se deve concluir que o banco está incorreto ou que a entrega push falha: faltam evidências. A configuração Asaas ausente evita chamadas de criação de cobrança no código atual, mas o paywall ainda apresenta preços e registra pedidos manuais.

## Cobrança: fora do primeiro piloto

Manter o piloto gratuito, sem credenciais Asaas, até resolver:

1. A criação de assinatura externa ocorre antes de persistir seu ID; uma falha na consulta de pagamentos pode permitir uma nova assinatura na repetição. O bloqueio tem 30 segundos, enquanto há múltiplas chamadas externas com até 20 segundos cada. Persistência antecipada, reconciliação e concorrência precisam de cobertura.
2. A deduplicação considera o ID do evento, mas eventos distintos para o mesmo pagamento ainda podem recalcular o acesso a partir da data de recebimento. Eventos atrasados e fora de ordem precisam de testes.
3. O webhook retorna sucesso quando não encontra a conta, sem processar o evento. Uma entrega anterior à associação da assinatura depende de reconciliação ou reenvio posterior que ainda não está demonstrado.
4. Exclusão de conta apaga registros locais, mas não cancela a assinatura externa. Não ativar cobrança real antes de implementar e testar esse ciclo.

Essas pendências de pagamento não impedem um piloto gratuito com as chaves ausentes. Não usar dados pessoais reais para preencher pagamentos fictícios no sandbox.

## Pendências de produto e operação

- **PF e MEI:** a coluna `user.email` é única. O mesmo e-mail não cria duas contas independentes PF/MEI. A UI orienta escolher o perfil já cadastrado. Explicar isso no convite; se o produto prometer ambos no mesmo e-mail, será necessária uma mudança de modelo, não apenas um teste.
- **Titularidade:** o cadastro comum não exige verificação de e-mail. Para o grupo fechado, confirmar previamente os participantes e seus endereços; antes de cadastro público amplo, implementar e testar verificação. A vinculação administrativa continua exigindo ID conferido.
- **Capacidade:** o cadastro usa um lock de até 120 segundos. Se uma criação falhar depois do hook inicial, o lock pode permanecer até expirar. Testar cadastros simultâneos, e-mail duplicado e recuperação após falha; não anunciar garantia de 30 acessos simultâneos com base no limite de contas.
- **PDF:** a limpeza de recursos e a tipagem foram corrigidas localmente; validar no navegador um PDF autorizado com texto, duplicatas, parcelas, estorno, arquivo protegido e arquivo incompatível. Nenhuma importação de fatura real foi executada nesta auditoria.
- **Dados locais:** rascunhos offline ficam no `localStorage` por ID de usuário. Sair limpa a fila em memória, mas não remove o rascunho persistente. Definir o comportamento para aparelhos compartilhados e informar retenção local; testar troca de contas no mesmo navegador.
- **Privacidade:** a página existe e há contato de suporte. Revisar a identificação do responsável e acrescentar os operadores efetivamente usados no piloto, inclusive Resend quando ativado; Asaas somente quando aplicável. Isto é uma revisão de transparência do produto, não um parecer jurídico.
- **Backup:** os snapshots diários por usuário na mesma base não substituem recuperação do banco inteiro. Confirmar acesso do operador ao mecanismo do provedor, retenção e restauração em base separada. Preservar uma relação restrita das exclusões para não reintroduzir contas apagadas ao restaurar dados antigos.
- **Monitoramento:** o build habilita observabilidade, mas a auditoria não comprovou alertas, retenção de logs ou responsável de plantão. Registrar status e IDs de falhas sem payload financeiro, senha, cookie ou link de recuperação.
- **Navegadores:** validar Android/Chrome e iPhone/Safari reais; voz deve permitir digitação quando indisponível. Instalação e atualização PWA exigem teste no aparelho.
- **Entrega:** as alterações locais ainda precisam de revisão e publicação rastreável; um build local não atualiza o site.

## Preparação adicionada nesta auditoria

- `docs/HOMOLOGACAO.md`: procedimento de liberação e matriz de aceite com resultados esperados.
- `deploy/homologation/env.example`: configuração de referência para Worker + D1, cadastro fechado e piloto gratuito.
- `npm run check:homologation`: exige lint geral sem avisos, depois testes, tipagem e build. **Continua bloqueado pelos diagnósticos existentes**, sem esconder falhas.
- `npm run smoke:homologation -- https://endereco`: 11 verificações HTTP anônimas de leitura, incluindo páginas, APIs protegidas e cabeçalhos. Não cria contas nem envia mensagens.
- Quatro testes da ferramenta HTTP incluídos em `npm test`; não substituem testes do produto com usuários.
- README atualizado para contas individuais; as antigas credenciais compartilhadas não são mais instrução de acesso.

## Decisão de entrada

1. Resolver P0 e P1 e registrar evidências na matriz.
2. Publicar em ambiente separado com banco próprio, sem chaves de cobrança.
3. Executar a jornada com contas fictícias no endereço final.
4. Convidar inicialmente até 5 participantes PF/MEI, com orientação, canal de suporte e sem exigir faturas ou dados bancários sensíveis.
5. Acompanhar uma semana e ampliar para o limite acordado somente sem falhas de isolamento, perda de dados ou recuperação.

A quantidade inicial e o período de observação são propostas operacionais, não medições de capacidade. Nenhum convite, e-mail externo, alteração de acesso publicado ou deploy foi realizado nesta auditoria.

## Referências técnicas

- Cloudflare D1, Time Travel e backups: https://developers.cloudflare.com/d1/reference/time-travel/ — a disponibilidade e a janela dependem da conta/plano; confirmar no ambiente efetivo.
- Better Auth, e-mail e verificação: https://better-auth.com/docs/concepts/email

## Mitigação administrativa publicada

Atualização de 29/10/2026 às 22:15 (São Paulo): a versão 72 foi republicada com `TRIAL_ADMIN_EMAIL` removido, revisão de ambiente 11, para bloquear a autorização administrativa antiga. O código novo por ID ainda não foi enviado por falha de DNS no repositório de origem. Isso altera o estado publicado descrito na auditoria original: o e-mail administrativo agora está ausente e a administração está bloqueada. A homologação continua não liberada. Consulte [PUBLICACAO_ADMIN.md](PUBLICACAO_ADMIN.md) antes de configurar ou restaurar qualquer variável administrativa.

## Atualização da recuperação por e-mail

A implementação local ganhou validação de links, aceite do provedor e idempotência. Foi corrigida a reinserção de links antigos pela falha atrasada de envio. Foram aprovados 13 testes dedicados com Better Auth real e transporte simulado, além da suíte completa com 67 testes, tipagem e build. A conta Resend ainda não foi criada e as credenciais continuam ausentes: a entrega real permanece pendente. A publicação do código continua bloqueada por DNS. Ver RECUPERACAO_EMAIL.md.

## Atualização: lint e exclusão após vencimento

O lint geral foi corrigido localmente, sem desativar regras. A tela de teste vencido passou a oferecer o mesmo formulário de exclusão disponível em Ajustes. Três testes novos verificam a presença da opção, a exclusão com a senha atual após vencimento e a recusa da senha incorreta, preservando outra conta. O comando `check` agora exige lint geral sem avisos antes da suíte, tipagem e build; `check:homologation` usa o mesmo gate. A suíte completa soma 70 testes e o gate passou. Esses avanços não alteram o estado da versão publicada: ainda é necessário publicar e validar no ambiente final.


## Implementação e configuração — 30/10/2026

Foram implementados no código local o cadastro por lista de participantes, a limpeza de rascunhos ao sair, o descarte de respostas antigas após encerrar a sessão e a página pública de solicitação de exclusão. O gate completo passou com 78 testes, lint sem avisos, tipagem, build e ensaio SQLite de recuperação. O cadastro da versão 72 foi fechado e essa configuração foi publicada na revisão 12; o código novo segue bloqueado por DNS. Ver [PENDENCIAS_IMPLEMENTADAS.md](PENDENCIAS_IMPLEMENTADAS.md) para limites e dependências externas. A homologação real não está liberada.
