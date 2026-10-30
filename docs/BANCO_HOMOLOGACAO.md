# Migrações, backup e restauração — evidências

Data: 30/10/2026, horário de São Paulo.

**Conclusão: ensaio local aprovado; recuperação do banco D1 hospedado ainda não comprovada.** O banco exclusivo de homologação não está identificado. Não houve exportação, restauração nem alteração do banco publicado nesta atividade.

## Resultados

| Item | Resultado | Evidência e limite |
| --- | --- | --- |
| Migrações locais `0000`–`0008` | Aprovado | 9 SQLs aplicados em ordem, conferidos contra o journal; SHA-256 de cada arquivo registrado |
| Preservação durante upgrade | Aprovado localmente | Documentos PF/MEI criados na migração inicial mantiveram conteúdo e revisões 7/11; usuário e acesso anteriores mantidos; defaults e novas colunas conferidos |
| Esquema remoto | Parcialmente comprovado | Overview retornou 13 tabelas; colunas de `user`, `account_access` e `billing_events` obtidas sem truncamento |
| Histórico remoto de migrações | Pendente | Presença de tabelas e colunas não prova quais SQLs foram aplicados, hashes, índices, constraints ou ordem de aplicação |
| Backup local | Aprovado | API nativa SQLite; arquivo de 192.512 bytes; SHA-256 `6eb9482bcd726dd979400e83040d348f9033fd7eb41712c1b4ed9df422c30def` |
| Restauração local | Aprovado | Arquivo novo; esquema e hashes de todas as linhas das 13 tabelas idênticos ao estado anterior; 2 registros fictícios por tabela |
| Verificação de integridade | Aprovado localmente | `integrity_check=ok` e nenhuma violação de chave estrangeira |
| Arquivo adulterado / destino ocupado | Aprovado localmente | Checksum divergente recusado antes da abertura; arquivo existente não é sobrescrito |
| Exclusão após backup | Aprovado no ensaio | Exclusão fictícia PF reaplicada; conta e finanças MEI preservadas; sessões, verificações, sessões de demonstração, push e locks antigos removidos da cópia |
| Exportação externa, retenção e restauração D1 | Pendente | Conector Sites disponível oferece apenas overview e leitura paginada; não disponibiliza exportação, execução SQL, backup ou restauração |

## Evidência no banco publicado

Projeto: `appgprj_6ad911aedbc881918b5db462af24139d`; binding `DB`. Esse projeto é o site público existente; não foi demonstrado que corresponda a um banco separado de homologação.

| Assinatura do esquema | Presença remota confirmada | Migração local relacionada |
| --- | --- | --- |
| `user.must_change_password` | Sim | `0004` |
| `account_access.subscription_requested_at` | Sim | `0007` |
| `account_access.provider_customer_id` e `provider_payment_id` | Sim | `0008` |
| Tabela `billing_events` com 6 colunas esperadas | Sim | `0008` |

A ferramenta de leitura não permite solicitar só metadados: foram feitas três consultas limitadas a uma linha para obter os nomes de colunas. Valores das linhas foram descartados e não foram exibidos ou armazenados nas evidências. Não foi feita paginação ou cópia de dados pessoais.

Ver [EVIDENCIA_ESQUEMA_REMOTO.json](EVIDENCIA_ESQUEMA_REMOTO.json). Não classificar esse arquivo como backup.

## Reproduzir o ensaio local

```powershell
npm run db:rehearse
```

O comando só aceita execução local, sem argumentos; não lê credenciais, banco do preview ou banco remoto. Cria arquivos novos em uma pasta única sob `.sites-runtime/database-drills/`, com origem, backup, restauração, arquivo adulterado e `evidence.json`. Os dados são exclusivamente fictícios. O relatório de cada execução registra o horário real e os checksums correspondentes. O JSON desta execução está em [EVIDENCIA_BANCO_LOCAL.json](EVIDENCIA_BANCO_LOCAL.json).

A suíte faz backup antes de excluir a conta PF fictícia da origem, depois recupera o estado antigo em outro arquivo e compara todas as tabelas. Só após comprovar igualdade, reaplica a exclusão e invalida os acessos restaurados. Os tokens e hashes de senha são sentinelas fictícias: isso não testa login real. Os exemplos de eventos financeiros e de cobrança também não acionam serviços externos.

O gate `npm run check:homologation` inclui esse ensaio além do lint, 70 testes, TypeScript e build. O novo ensaio foi executado e seu lint aprovado nesta atividade; o gate completo anterior não foi reexecutado porque o código da aplicação permaneceu inalterado.

O Wrangler local foi tentado separadamente e falhou com `fetch failed`, sem concluir sequer `SELECT 1`. Portanto, esta evidência é SQLite nativo, não D1 local nem D1 remoto. O arquivo `.sqlite` deste ensaio não é um formato de importação direta no D1.

## Concluir a comprovação remota

1. Identificar por metadados do provedor o projeto e o banco exclusivos de homologação, a versão candidata e o responsável pela recuperação. Registrar também um destino novo, separado da origem e sem usuários, código em execução ou integrações externas ativas. Não usar o UUID placeholder gerado para preview.
2. Obter pelo provedor Sites um caminho suportado de exportação e recuperação. Se o responsável possuir acesso direto e autorizado à conta Cloudflare que detém o D1, poderá usar o Wrangler; credenciais de Git Sites não concedem esse acesso. Não inserir endpoint de dump/restauração no aplicativo público.
3. Exportar o esquema para confrontar tabelas, colunas, defaults, índices e FKs com as migrações. Solicitar também o histórico de aplicação do provedor, pois a ferramenta atual não o expõe. Não reaplicar os 9 SQLs em uma base existente para tentar provar sua presença. O arquivo [verify-database.sql](../deploy/homologation/verify-database.sql) reúne consultas de leitura para esse operador.
4. Na homologação isolada, criar registros fictícios com marcador único e documentar contagens, revisões, digest dos registros e horário do ponto de recuperação. Programar uma janela sem gravações durante a captura e a comparação. Fechar cadastro, sozinho, não interrompe gravações.
5. Exportar esquema e dados completos em SQL para um destino de backup restrito, registrar tamanho e SHA-256 e validar que o arquivo não é vazio. Guardar fora do banco de origem, com controle de acesso e retenção definidos. Não anexar SQL com contas, hashes de senha ou tokens a este repositório ou a relatórios públicos. A exportação financeira por usuário não equivale a backup do banco.
6. Importar o SQL somente no banco de restauração novo e confirmado. Conferir primeiro o estado vazio e a diferença entre IDs da origem e do destino. Não executar o dump sobre a base dos participantes. Com acesso Cloudflare próprio confirmado, o mecanismo documentado é `wrangler d1 export <origem> --remote --output=<arquivo.sql>` e `wrangler d1 execute <destino> --remote --file=<arquivo.sql>`, usando configuração com os IDs reais conferidos. Estes são modelos, não comandos executados nesta sessão.
7. Comparar esquema, índices, FKs, contagens por tabela e hashes de conteúdo de origem/ponto do backup e destino. Conferir especificamente `finance_documents.revision`, `mutation_id` e payload, snapshots e segregação PF/MEI. Executar integridade e verificar FKs. Registrar tempos efetivos de captura e recuperação; RPO/RTO não foram medidos remotamente.
8. Manter a cópia em quarentena: invalidar sessões e tokens restaurados; reaplicar exclusões ocorridas após o backup a partir de um registro externo confiável; manter administração e serviços de envio/cobrança desativados. A limpeza deste ensaio cobre seus registros fictícios e não substitui a política de retenção dos eventos de cobrança reais.
9. Validar a aplicação contra a cópia isolada e registrar evidências. Só aprovar a recuperação remota após essas comparações; nunca trocar o binding de origem automaticamente durante o ensaio.

O Time Travel documentado pelo Cloudflare restaura o banco no próprio lugar; não serve como ensaio em uma cópia. Nenhum bookmark, janela de retenção ou restauração Time Travel deste projeto foi verificado.

## Referências técnicas

- [Cloudflare D1: importação e exportação SQL](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1: comandos Wrangler](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Cloudflare D1: Time Travel e backups](https://developers.cloudflare.com/d1/reference/time-travel/)

As referências descrevem recursos do D1; não comprovam que o usuário tenha acesso direto à conta Cloudflare gerenciada pelo Sites.
