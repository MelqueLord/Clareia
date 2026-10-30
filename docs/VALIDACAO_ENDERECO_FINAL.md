# Validação da jornada no endereço final — Clareia

Data da tentativa: 30/10/2026 (São Paulo).

Endereço: https://clareia-financas-mei-pf.igrejamirc01.chatgpt.site

**Resultado: BLOQUEADO. A jornada no ambiente publicado não foi aprovada.**

## Evidências obtidas

| Verificação | Resultado observado | Limite da evidência |
| --- | --- | --- |
| Sites / publicação | Versão 72; deploy com estado `succeeded`; ambiente na revisão 11 | Estado do provedor, não teste de login ou da interface |
| Origem da versão | Commit `1ba99f0fa1bfb485767c499ad0d0a0fc1ba33dee` | Anterior às correções locais ainda não publicadas |
| Acesso da hospedagem | Público; cadastro habilitado; limite configurado de 30 contas | Não comprova capacidade simultânea nem sucesso de cadastro |
| Banco remoto | Binding `DB`; 13 tabelas retornadas pelo overview nativo | Não foram lidas linhas de usuários, senhas, sessões ou dados financeiros; colunas e histórico de migrações não foram verificados |
| DNS do aplicativo nesta sessão | `ENOTFOUND` | Não comprova indisponibilidade do endereço para outros aparelhos ou redes |
| DNS da origem Git Sites nesta sessão | `ENOTFOUND` | Impede concluir o envio/publicação das correções por este ambiente |
| Acesso alternativo pela ferramenta web | Endereço não acessível pela ferramenta | Não substitui um navegador autenticado |
| Smoke HTTP no endereço final | 0 de 11 verificações concluídas com sucesso; comando terminou com código 1 | Nenhum status HTTP foi recebido; as falhas foram de conexão, não respostas de reprovação do aplicativo |

Deploy confirmado: `appgdep_6ae3ef8d279c81918eb908e2501fea96`.

## Jornada solicitada

| Fluxo | Estado no endereço final | Evidência necessária para aprovação |
| --- | --- | --- |
| Cadastro PF e MEI | Bloqueado por conectividade | Criar contas fictícias exclusivas com e-mails distintos e conferir o perfil |
| Login e saída | Bloqueado por conectividade | Senha correta entra; incorreta é recusada; logout invalida a sessão |
| Persistência | Bloqueado por conectividade | Salvar valores fictícios, entrar em outra sessão e recuperar os mesmos registros |
| Isolamento | Bloqueado por conectividade | Duas contas PF e uma MEI não veem nem alteram registros umas das outras |
| Importação PDF | Não executada no navegador publicado | PDF fictício com texto, duplicatas, parcelas e estorno; arquivo inválido; revisão antes de importar |
| Exportação | Bloqueado por conectividade | Arquivo legível, somente com os registros da conta autenticada |
| Exclusão | Bloqueado por conectividade | Excluir apenas contas criadas para o teste, com senha atual; dados e sessões removidos; outra conta preservada |

A presença da opção de exclusão após vencimento já foi testada localmente, mas sua alteração ainda não faz parte da versão 72. O mesmo cuidado vale para as correções locais do PDF, administração e recuperação de senha. Os 70 testes locais aprovados anteriormente não foram reclassificados como testes do endereço final.

## Ações realizadas e dados preservados

- Consultados apenas os metadados necessários da publicação, os nomes das variáveis e a lista de tabelas.
- Executadas consultas DNS e requisições HTTP anônimas de leitura.
- Nenhuma conta criada, autenticada ou excluída no site publicado.
- Nenhum dado financeiro gravado ou exportado do ambiente publicado.
- Nenhuma alteração de público, configuração, banco ou deploy nesta tentativa.

## Como retomar

1. Restabelecer, no ambiente executor, o acesso ao domínio final e ao repositório de origem Sites. Não desativar verificações de TLS, alterar a audiência do site ou remover a mitigação administrativa para contornar a conectividade.
2. Publicar o código corrigido e registrar a versão e o commit efetivamente implantados.
3. Executar o smoke HTTP e só depois criar contas fictícias exclusivas para a jornada autenticada. Limite de vagas ou cadastro fechado deve ser tratado como bloqueio, sem modificar contas de participantes.
4. Executar a matriz de [HOMOLOGACAO.md](HOMOLOGACAO.md) no navegador, com os valores fictícios. Não usar faturas ou credenciais pessoais.
5. Limpar somente as contas e dados criados para a própria execução e registrar os resultados de cada etapa.

O comando já disponível para a primeira checagem, em uma rede com acesso ao endereço, é:

```powershell
npm run smoke:homologation -- https://clareia-financas-mei-pf.igrejamirc01.chatgpt.site
```

Esse comando faz apenas verificações HTTP anônimas e **não executa a jornada autenticada completa**.


## Nova tentativa de correção em 30/10/2026

- O Sites voltou a confirmar o projeto ativo, público e na versão 72.
- Consultados os registros de erro recentes do Worker: os dois eventos retornados eram GET /api/data com status 401 e outcome ok. Isso é compatível com recusa de sessão ausente ou inválida; não evidencia falha de execução nem aprova login ou isolamento. Não foram armazenados IPs, cabeçalhos ou identificadores dos visitantes neste relatório.
- Uma nova credencial temporária de origem foi solicitada e mantida apenas em memória. O endereço oficial do repositório permaneceu o mesmo.
- O DNS do aplicativo e do repositório voltou a retornar ENOTFOUND. Esse bloqueio pertence ao ambiente executor e não pode ser corrigido por alteração no código do aplicativo.
- Nenhuma alteração de DNS, TLS, proxy, audiência ou dados de participantes foi feita para contornar a restrição.
- A nova abertura pelo helper oficial não concluiu acesso à origem e foi interrompida. Nenhum commit foi enviado e nenhum deploy foi iniciado nesta tentativa.


## Configuração posterior — 30/10/2026, 08:53 São Paulo

O Sites confirmou o deploy `appgdep_6ae48527bc888191ab1290d36791f243` da mesma versão 72 com revisão de ambiente 12 e novos cadastros fechados. O código continua anterior às correções locais. A jornada publicada continua pendente; o smoke atual tem 12 rotas após inclusão de `/excluir-conta` no código local. Ver [PENDENCIAS_IMPLEMENTADAS.md](PENDENCIAS_IMPLEMENTADAS.md).
