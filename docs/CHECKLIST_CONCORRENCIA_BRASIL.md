# Clareia — concorrência no Brasil e lista de verificação

Data da revisão: 30/10/2026, America/Sao_Paulo.

## Como interpretar

- “Tem” indica implementação identificada no código local, sem garantir funcionamento no site publicado.
- “Não identificado” indica que o recurso não foi localizado nesta revisão; não equivale a um teste exaustivo.
- Recursos ausentes são decisões de produto, não necessariamente defeitos.
- A classificação dos recursos foi feita por leitura de código e documentos. A verificação técnica local posterior está registrada abaixo; ela não confirma o comportamento da versão publicada.
- O registro `PENDENCIAS_IMPLEMENTADAS.md` informa que as correções locais ainda não foram publicadas. Um push ao GitHub, isoladamente, não comprova deploy.

## Recorte de concorrência

Categoria: controle financeiro pessoal, familiar e de pequenos negócios. Os quatro aplicativos abaixo são uma seleção de concorrentes próximos, não um ranking completo dos mais baixados.

### Downloads no Brasil

Estimativas publicadas pela Sensor Tower para a última semana de dezembro de 2025, no relatório do quarto trimestre de 2025:

| Aplicativo | Downloads estimados naquela semana |
| --- | ---: |
| Mobills | Aproximadamente 21 mil |
| Minhas Finanças, da Nimtech | Aproximadamente 12 mil |
| Organizze | Aproximadamente 10 mil |
| Minhas Economias | Aproximadamente 6,9 mil |

Fonte: https://sensortower.com/blog/2025-q4-unified-top-5-personal-finance-budgeting-and-planning-revenue-br-63e363f0e1714cfff1979caa

São estimativas históricas da fonte, não números auditados fornecidos pelas empresas, nem ranking de outubro de 2026. Instalações acumuladas da Google Play não foram tratadas como downloads brasileiros.

### Promessas comerciais e relatos documentados

As mensagens abaixo vêm de sites e lojas oficiais. Não foram confirmadas como anúncios pagos.

| Aplicativo | Comunicação comercial | Relato encontrado e limite |
| --- | --- | --- |
| Mobills | Conexão automática de contas e cartões | Em 16/10/2026, consumidor relatou transações sem atualização desde 1º de outubro e falta de retorno pelo WhatsApp. A publicação consultada aparecia como não respondida. |
| Minhas Finanças | Automação, sincronização, Open Finance e assistente de IA | Avaliação de 07/02/2025 na App Store brasileira pede visão consolidada do casal. Não foi confirmado se o pedido permanece sem atendimento. |
| Organizze | Centralização de bancos, Open Finance e gestão PF/PJ | Em 15/10/2026, consumidor relatou cartão sem sincronização pelo segundo mês. Listagem indicava respondida, sem confirmação de solução no material consultado. |
| Minhas Economias | Contas, cartões, orçamento e objetivos | Em 14/10/2026, consumidora relatou erro ao cancelar no fim do teste. Empresa orientou cancelamento/estorno pela loja e ofereceu auxílio. Desfecho não confirmado. |

Fontes comerciais:

- Mobills: https://play.google.com/store/apps/details?hl=pt-BR&id=br.com.gerenciadorfinanceiro.controller
- Minhas Finanças: https://minhasfinancas.app.br/
- Organizze: https://www.organizze.com.br/
- Minhas Economias: https://minhaseconomias.com.br/

Fontes dos relatos:

- Mobills: https://www.reclameaqui.com.br/mobills-educacao-financeira/meu-aplicativo-nao-atualiza-transacoes-e-nao-tenho-resposta_As0Udq27_Dw66raH/
- Minhas Finanças: https://apps.apple.com/br/app/minhas-finan%C3%A7as-controle-e-ia/id1662639047
- Organizze: https://www.reclameaqui.com.br/organizze/nao-atualiza-mais-meus-dados-mas-segue-me-cobrando_jVcWp-pMWTtYsqAQ/
- Minhas Economias: https://www.reclameaqui.com.br/minhas-economias/nao-consegui-cancelar-minha-assinatura-do-minhas-economias-por-erro-no-app_xRqKqOSK1hlmy1SF/

Um relato de acesso à versão antiga do Minhas Economias, de 13/10/2026, foi confirmado como resolvido pela consumidora. Não foi classificado como falha aberta:
https://www.reclameaqui.com.br/minhas-economias/nao-consigo-acessar-meus-dados-na-versao-antiga-do-minhas-economias_20ZpvrNUqRTfPE45/

Os exemplos não medem a proporção de clientes insatisfeitos nem permitem comparar a qualidade geral dos aplicativos. Datas e estados são os observados na consulta, não monitoramento contínuo.

### Anúncios — verificação pendente

A Biblioteca da Meta não pôde ser consultada na navegação disponível. Nenhum anúncio ativo, criativo, investimento ou resultado foi confirmado.

- [ ] Conferir anunciante oficial, ID, data de início, criativo e página de destino de cada anúncio.
- [ ] Registrar país Brasil e data da consulta.
- [ ] Separar anúncio pago de publicação orgânica e mensagem do site.
- [ ] Não atribuir downloads aos anúncios sem evidência de atribuição.

Buscas para verificação; não constituem provas de anúncios encontrados:

- Mobills: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=Mobills&search_type=keyword_unordered
- Minhas Finanças: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=Minhas%20Finan%C3%A7as&search_type=keyword_unordered
- Organizze: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=Organizze&search_type=keyword_unordered
- Minhas Economias: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=Minhas%20Economias&search_type=keyword_unordered

## 1. Implementado — verificar no Clareia publicado

- [ ] Receitas, despesas e categorias: salvar, editar e excluir sem alterar saldos indevidamente.
- [ ] Contas e cartões: conferir saldos, fechamento, vencimento e pagamento da fatura.
- [ ] Compras parceladas: conferir parcelas e ausência de duplicação de despesas.
- [ ] Orçamento e projeções: comparar os resultados com cálculos manuais conhecidos.
- [ ] Simulador de compras: mostrar compromissos futuros e limites da estimativa.
- [ ] Registro por voz: testar no celular, com revisão antes de salvar e alternativa digitada.
- [ ] Importação PDF, com limitações: conferir valores, parcelas, estornos e duplicatas.
- [ ] Exportação JSON: abrir o arquivo e conferir todos os registros.
- [ ] Exportação após vencer o teste: garantir acesso sem exigir assinatura.
- [ ] Exclusão após vencer o teste, presente no código corrigido: confirmar senha, apagar somente a conta correta e limpar dados locais.
- [ ] Contas individuais e isolamento: impedir consulta e alteração de dados de outra pessoa.
- [ ] Notificações: comprovar recebimento real, frequência e desativação no aparelho.

## 2. Ausente ou parcial — decidir prioridade de produto

| Verificação | Situação encontrada | Encaminhamento |
| --- | --- | --- |
| Open Finance | Não implementado | Decidir inclusão. Não anunciar como disponível. |
| Importação de extratos CSV/OFX | Não identificada | Avaliar entrada e migração de dados. |
| Exportação Excel/CSV e relatórios PDF | Não identificada na exportação consultada | Avaliar formatos que o usuário consiga consultar fora do app. |
| Restaurar arquivo exportado | Sem interface documentada | Implementar prévia, validação e proteção contra duplicatas se aprovado no escopo. |
| Visão compartilhada do casal/família | Não identificada | Avaliar compartilhamento, permissões e visão consolidada. |
| PF e MEI no mesmo acesso | Parcial | Ambos existem, mas são contas independentes; o mesmo e-mail não cadastra ambos. |
| Offline completo | Não implementado | Há rascunhos e recursos parciais; testar reconexão. |
| IA generativa conversacional | Não implementada | O assistente usa regras; explicar corretamente sua capacidade. |

- [ ] Decidir quais itens entram no roteiro de evolução.
- [ ] Definir responsável, prazo e critério de aceite dos itens aprovados.

## 3. Correções e conclusões prioritárias

| Concluído? | Prioridade | Item | Critério de aceite |
| --- | --- | --- | --- |
| [ ] | Crítica | Publicar correções locais | Versão publicada identificada e contendo as alterações; push não comprova deploy. |
| [ ] | Crítica | Recuperação por e-mail | Serviço configurado; recebimento, expiração e uso único do link comprovados. |
| [ ] | Crítica | Cancelamento da assinatura | Cancelamento externo disponível e testado; exclusão da conta não equivale a cancelamento da cobrança. |
| [ ] | Crítica | Evitar cobranças duplicadas | Repetição de pedidos, falhas e concorrência testadas. |
| [ ] | Crítica | Confirmação de pagamentos | Eventos duplicados, atrasados e fora de ordem testados. |
| [ ] | Alta | Backup e restauração remotos | Restaurar em outra base e conferir os dados; snapshots na mesma base não bastam. |
| [ ] | Alta | PDF no celular | Arquivos compatíveis e incompatíveis testados; erro de interpretação informado claramente. |
| [ ] | Alta | Persistência e dois aparelhos | Salvar, sair, entrar e alterar simultaneamente sem perda silenciosa. |
| [ ] | Alta | Transparência comercial | Teste, preços, bloqueios, cobrança, renovação e cancelamento explicados antes de contratar. |
| [ ] | Alta | Suporte | Canal confirmado, acompanhamento e prazo de resposta definidos. |
| [ ] | Alta | Administração | Autorização corrigida por ID e e-mail publicada; recusa de usuário comum comprovada. |
| [ ] | Alta | Android e iPhone | Cadastro, login, lançamentos, PDF, exportação, notificações e exclusão aprovados. |

Ordem recomendada: publicação e recuperação de acesso; integridade e restauração; cobrança e cancelamento; aparelhos; novas funcionalidades.

## Registro de evidências

Para cada item, registrar versão/commit, ambiente, data, aparelho, resultado esperado, resultado observado e evidência sem dados pessoais. Marcar como concluído somente com o critério de aceite atendido.

Referências internas:

- [Pendências implementadas](PENDENCIAS_IMPLEMENTADAS.md)
- [Auditoria de homologação](AUDITORIA_HOMOLOGACAO.md)
- [Roteiro de homologação](HOMOLOGACAO.md)
- [Testes e limites](TESTES.md)
- [Estado do banco](BANCO_HOMOLOGACAO.md)

Hipóteses a validar com usuários: confiabilidade dos lançamentos, recuperação/exportação acessível e clareza no teste e cancelamento. Não são conclusões de demanda estatística nem diferenciais exclusivos comprovados.

## Verificação técnica local para preparar o envio

Em 30/10/2026, `npm run check:homologation` terminou com código 0:

- ESLint sem erros ou avisos.
- 78 testes aprovados, sem falhas ou testes ignorados.
- TypeScript aprovado.
- Build aprovado, com avisos de ferramentas sobre configuração futura do Vite, sourcemaps e imports.
- Ensaio local com 9 migrações, backup e restauração: `PASSED_LOCAL_ONLY`.

Isso não comprova entrega de e-mail, banco remoto, funcionamento em aparelhos reais, publicação ou push ao GitHub. Os itens da lista permanecem abertos até cumprir seus respectivos critérios no ambiente adequado.
