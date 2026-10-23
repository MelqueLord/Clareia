# Clareia v2 — requisitos e desenho

Implementar margem até a próxima receita confirmada, despesas essenciais mensais com dedução dos registros existentes, reserva separada, ações nos avisos, comparação de compra à vista/parcelada, painel MEI, revisão de múltiplos registros por voz e consultas financeiras. Não inventar renda, datas, contas nem confirmação de dados.

Preferências novas são opcionais para compatibilidade. A margem fica indisponível até conferir os essenciais. Cálculos usam centavos, datas locais e não contam receita estimada. Gastos essenciais adicionais são distribuídos diariamente no período restante; compras já registradas, inclusive cartão, reduzem a cobertura da categoria sem descontar sua fatura duas vezes.

Contas individuais usam o login nativo da hospedagem e namespace separado dos perfis de teste. Recuperação de acesso fica com o provedor. Preservar todos os dados existentes, sem migrar dados compartilhados para usuários privados.

Web Push com consentimento por aparelho, frequência diária/semanal, horário diurno de Brasília, mensagens genéricas sem valores na tela bloqueada, deduplicação e revogação. Uma rotina agendada solicita o processamento idempotente, sem ler dados financeiros nem armazenar credenciais no prompt. A rotina só envia quando há alteração relevante ou resumo semanal solicitado. Verificar suporte real no aparelho; não afirmar entrega sem confirmação do serviço push.

Validação: testes de não duplicação de gastos essenciais, transição de mês, margem sem recebimento, reservas, retirada MEI, parcelamento, interpretação de frases compostas, isolamento de autenticação, autorização de push e deduplicação. Verificar interface mobile e publicar o mesmo Site público. Enviar o estado final ao GitHub solicitado.

## Operação

1. Em Planejamento, conferir o total mensal de despesas essenciais. Sugestões usam mediana de três meses ou orçamento existente. Em Ajustes, conferir piso, renda e compromissos. Dados antigos são preservados e pedem essa nova conferência antes de mostrar valor disponível.
2. A margem vai até a próxima entrada confirmada futura, ou 30 dias na ausência dela. Receitas estimadas não financiam gastos. O comparador cobre seis meses e informa parcelas posteriores. Não há garantia de capacidade de compra.
3. Separar/liberar reserva é uma marcação financeira. Não muda o banco, não cria despesa e não compra investimentos. A marcação reduz/aumenta a margem disponível.
4. O assistente divide até dez movimentos por frase, revisados um a um e salvos juntos. Datas e contas ausentes exigem preenchimento. Consultas explicam alertas, maiores gastos, margem e retirada MEI sem alterar dados. É interpretação por regras, não uma conversa aberta com modelo generativo.
5. Conta individual usa identidade estável fornecida pela hospedagem. Recuperação de acesso é pelo provedor ChatGPT. Os dois logins de demonstração continuam compartilhados. Não são uma alternativa para dados pessoais reais.
6. Web Push precisa ser ativado por cada pessoa em cada aparelho. A interface oferece frequência diária ou semanal, teste e desativação. No iPhone, depende da instalação na tela inicial e do suporte do sistema. A entrega pode ser atrasada ou impedida por configurações do aparelho.

## Notificações agendadas

As notificações são processadas por um Cron Trigger do Cloudflare Workers às 12h UTC (9h em America/Bahia). O evento agendado chama `runNotifications` dentro do Worker e não expõe um gatilho público com efeitos globais. O antigo caminho HTTP permanece como resposta sem ação para compatibilidade com o agendamento anterior.

O processamento só usa inscrições criadas por usuário autenticado e consentimento do navegador. O servidor restringe horário (9h–20h), usa uma trava por minuto, reivindica inscrições atomicamente e limita a um aviso diário por dispositivo. A rotina examina até 100 inscrições por execução; ampliar capacidade exige paginação e agendador dedicado antes de escalar a base. Sem inscrições, a rotina não envia nada.

Sinais ativos são comparados com o último conjunto enviado. O resumo semanal é enviado às segundas-feiras, respeitando a preferência. Subscrições expiradas (404/410) são removidas. Falhas transitórias ficam disponíveis para tentativa posterior, sem afirmar sucesso de entrega. Não se adiciona uma assinatura ou habilita um dispositivo automaticamente.

Chaves `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_JWK` ficam nas variáveis de produção do Sites; a chave privada é segredo e não está no Git. Web Push usa JWT ES256 e mensagem sem payload financeiro; o service worker mostra texto genérico e abre a tela Inteligência. Referências: [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292.html), [evento push](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/push_event).

## Limites e verificação

26 verificações automatizadas cobrem domínio, API, autenticação, destinos push, deduplicação e assinatura VAPID. A prévia compilada foi usada para verificar salvamento de essenciais, comparação de compra e salvamento conjunto de três registros. Entrega de push em aparelho físico ainda depende de permissão e teste pelo usuário; a aceitação pelo serviço push não comprova visualização.

Permanecem fora do escopo: importação de extratos, Open Finance, execução bancária, IA generativa, offline completo e cálculo contábil/tributário. O documento não atesta conformidade LGPD: antes da operação comercial, ainda são necessárias revisão de privacidade, políticas de retenção, capacidade, suporte e testes em aparelhos reais.
