# Testes e validação do Clareia

## Comandos

- `npm test`: executa todos os testes de finanças, inteligência, APIs, isolamento entre clientes, administração, recuperação e exclusão de conta.
- `npm run test:admin`: executa apenas a proteção administrativa.
- `npm run lint:tests`: verifica os arquivos de teste, sem aceitar avisos.
- `npm run typecheck`: valida os tipos TypeScript, sem gerar arquivos.
- `npm run check`: executa lint geral sem erros ou avisos, suíte completa, tipagem e build, nessa ordem. Qualquer falha interrompe a execução e devolve um código de erro.

O comando `npm run lint` verifica o projeto inteiro. O `check` passou a incluir essa verificação com `--max-warnings=0`; `check:homologation` é um alias de `check`, sem duplicar a execução do lint. As pendências da auditoria inicial foram corrigidas no código local, sem desativar regras.

## Preparação e isolamento

`tests/helpers/runtime.cjs` carrega os módulos TypeScript reais em memória e resolve suas dependências locais automaticamente, incluindo autenticação, controle de acesso e metas. Não gera `.test-build` nem `.multitenant-build` e não modifica o carregador global do Node.

Cada cenário de API cria um banco SQLite em memória com todas as migrações SQL, ordenadas pelo nome, e fecha o banco ao terminar. O adaptador simula as operações D1 usadas pelo aplicativo, inclusive transações atômicas em `batch`. Não usa dados nem credenciais da hospedagem.

Nas suítes financeiras e administrativas, o provedor de sessão é simulado para exercitar permissões e handlers com contas isoladas. A suíte tests/recovery.cjs usa os handlers, hashes de senha, cookies e sessões do Better Auth real com SQLite em memória. A integração do adaptador D1 e a jornada no endereço publicado continuam dependendo da homologação.

## Cenários cobertos

- Centavos, parcelas, ciclos de cartão, transferências PF/MEI, reserva, metas mensais e renda estimada.
- Conversão dos antigos gastos essenciais para metas, sem duplicar valores ou marcar uma conferência não realizada.
- Frases de voz compostas, centavos por extenso e distinção entre conta, Pix, débito e cartão de crédito.
- Ausência de data mantém o padrão atual de hoje, com `dateWasInferred` e aviso para revisão. Uma única conta pode ser sugerida; com mais de uma conta possível, a escolha permanece em branco.
- Encerramento do login compartilhado, leitura de sessões legadas, bloqueio de gravação na demonstração e revogação do token legado.
- Sessões individuais, primeira senha, prazo de teste, exportação após vencimento, exclusão restrita e proteção de origem.
- Salvamento idempotente, conflito de revisão e gravações simultâneas sem mistura entre clientes PF e MEI.
- Índices das migrações, autorização administrativa e reserva do e-mail do responsável.
- Destinos permitidos para push, deduplicação e assinatura VAPID. O envio HTTP é simulado e a assinatura é verificada com Web Crypto.

## Antes de liberar o piloto

Execute `npm run check` no commit que será publicado. Depois valide no navegador o cadastro, login, recuperação de senha, importação de uma fatura real e uso em aparelhos móveis. Estes testes não comprovam entrega de e-mail ou push, integração Asaas, configuração do banco D1 publicado ou recuperação de backup.

## Gate e ferramenta de homologação

- `npm run check:homologation`: exige lint geral sem erros ou avisos e depois executa `check`. As pendências da interface apontadas na auditoria foram corrigidas localmente.
- `npm run smoke:homologation -- https://endereco`: verifica 11 rotas e suas respostas anônimas por HTTP, sem criar contas ou enviar mensagens. Não substitui a jornada autenticada e não deve receber cookies ou segredos.
- `tests/homologation.cjs`: quatro testes da ferramenta HTTP, incluídos em `npm test`. No conjunto anterior à integração de recuperação, somavam-se aos 50 cenários existentes, totalizando 54 testes; os novos cenários verificam a ferramenta, não ampliam a cobertura dos fluxos financeiros.
- Processo de aceite: [HOMOLOGACAO.md](HOMOLOGACAO.md). Achados e evidências: [AUDITORIA_HOMOLOGACAO.md](AUDITORIA_HOMOLOGACAO.md).

## Integração de recuperação de senha

`npm run test:recovery` executa 13 testes com handlers, hash de senha, assinatura de cookies, expiração e sessões da versão instalada do Better Auth. A base é SQLite em memória com as migrações do projeto; runtime Cloudflare e transporte Resend são substituídos. Os novos testes fazem parte de `npm test` compõem a suíte, que agora soma 70 testes com os três cenários de exclusão de conta. Essa integração complementa os testes que simulam o provedor de sessão. Não comprova entrega na caixa de entrada nem o adaptador D1 publicado. Veja [RECUPERACAO_EMAIL.md](RECUPERACAO_EMAIL.md).

## Exclusão após o vencimento e lint

- `npm run test:deletion`: três cenários de regressão. O primeiro renderiza o componente real da tela vencida com React e confirma exportação e exclusão com senha e confirmação. Os outros usam handlers, senha e sessões do Better Auth real com SQLite em memória para confirmar exclusão após vencimento, limpeza dos dados financeiros e das sessões, preservação de outra conta e recusa da senha incorreta.
- O roteador é substituído no teste de renderização; este teste não afirma que houve interação em navegador ou aparelho real.
- O formulário de privacidade é reutilizado na tela de vencimento e em Ajustes. Depois da exclusão, o app remove o rascunho local, limpa o estado financeiro em memória e volta ao acesso.
- O lint foi corrigido nos links internos, dependências de hooks, sincronização de ambiente do navegador, refs usados no render, memoização e código sem uso. As regras existentes permaneceram ativas.
- As verificações do endereço publicado, aparelho e banco D1 remoto continuam pendentes. A publicação do código não ocorreu enquanto o DNS do repositório Sites permanece indisponível.

Validação local concluída: `npm run check:homologation` terminou com código zero; lint geral sem erros ou avisos, 70 testes aprovados (sem falhas ou ignorados), TypeScript e build aprovados.


## Ensaio de recuperação do banco

Executar `npm run db:rehearse` para aplicar as 9 migrações em SQLite nativo isolado, preservar sentinelas PF/MEI, criar backup e restaurá-lo em arquivo novo. Confere todas as 13 tabelas, hashes, revisões, integridade, recusa de adulteração/sobrescrita e quarentena após restauração. Usa apenas dados fictícios e não integra a contagem de 70 testes da suíte Node. O gate `check:homologation` inclui o comando. Ver [BANCO_HOMOLOGACAO.md](BANCO_HOMOLOGACAO.md) para evidências e limites; D1 remoto permanece pendente.


## Jornada com Better Auth real — complemento

`npm run test:journey` executa 8 cenários adicionais: lista de participantes, recusa de identidade forjada e configuração inválida, cadastro global fechado, manutenção de login existente, jornada de duas contas PF e uma MEI com senhas/cookies reais, perfil imutável e remoção de rascunhos da conta correta. As APIs financeiras e de exportação são os handlers reais, conectados a SQLite com todas as migrações. O carregador usa a classe APIError real do Better Auth para conferir os status de recusa. Clientes fictícios usam IPs distintos para não esgotar o limitador no ensaio rápido; esse teste não certifica o antiabuso.

A suíte passa a conter 78 testes. PDF no navegador, cookies na infraestrutura publicada, dispositivos e entrega de e-mail continuam exigindo homologação separada. A página pública `/excluir-conta` foi incluída no smoke, que agora verifica 12 rotas.
