# Clareia — MVP para teste público

> **Atualização v2:** o estado atual e as limitações atualizadas estão em `EVOLUCAO_V2.md`. A descrição abaixo registra o escopo original da versão 1.

## Uso

PWA em português, com interface adaptada ao celular e ao computador. Há dois usuários fictícios com autenticação no servidor:

| Perfil | E-mail | Senha pública de demonstração |
|---|---|---|
| Marina Costa · PF | pf@teste.clareia.app | Clareia2026! |
| Rafael Studio · MEI | mei@teste.clareia.app | Clareia2026! |

Estas contas são compartilhadas por quem acessa o teste. Não cadastrar dados reais. Cada perfil tem registros separados; pessoas que usam a mesma credencial veem os mesmos dados. A sessão dura 24 horas; os lançamentos confirmados permanecem no banco após sair. A primeira entrada prepara o conjunto fictício; entradas posteriores preservam as alterações.

## Implementado

- Login, logout e sessão opaca em cookie HttpOnly/SameSite, Secure em HTTPS. Só o hash do token fica no banco.
- Persistência no D1 por identidade autenticada, validação no servidor, controle de concorrência e idempotência das gravações.
- Espaços PF e MEI, contas, cartões, orçamento mensal, lançamentos, edição, exclusão, transferências e estornos.
- Cartões com fechamento/vencimento, parcelas exatas em centavos e baixa de fatura sem duplicar despesas.
- Entrada por voz usando reconhecimento do navegador, ou frase digitada; revisão obrigatória dos campos antes de gravar. O aplicativo não armazena o áudio.
- Projeção de seis meses, recorrência mensal na projeção e receitas estimadas separadas do caixa confirmado.
- Alertas explicados sobre orçamento, falta de caixa, margem de segurança, gastos acima da mediana histórica, pendências e pressão no cartão.
- Simulador de nova compra e possibilidade de reservar sobras após compromissos/piso, condicionada à conferência recente dos dados.
- Exportação JSON, registro de ações, cópia diária por até 30 dias e exclusão dos dados da conta.
- Manifesto e ícones para instalar o PWA; tela sem conexão e rascunhos locais para novos lançamentos feitos com o aplicativo já aberto.

## Limites desta entrega

- É um ambiente de teste público com dois perfis fictícios. Cadastro individual, recuperação de senha, verificação de e-mail e políticas para clientes reais ficam para a etapa de produção. As rotas nativas de login da hospedagem foram preservadas, mas a demonstração usa sessões próprias para os usuários solicitados.
- Inteligência baseada em regras financeiras verificáveis. Não há modelo generativo, conexão bancária, execução de investimentos nem bloqueio de compras no banco.
- Voz depende do suporte e das permissões do navegador. A captura de microfone precisa ser testada em aparelho real. Digitação e ditado do teclado são alternativas.
- Alertas aparecem dentro do app ao abrir ou atualizar os dados. Push com o aplicativo fechado ainda não está implementado.
- Catálogo inicial de instituições brasileiras mais opção de digitar qualquer banco; não é o catálogo completo do Banco Central.
- CSV e OFX fora do escopo. A importação de fatura em PDF lê texto selecionável no navegador; PDFs digitalizados, protegidos por senha ou em leiautes não reconhecidos exigem revisão manual. A exportação JSON não possui restauração pela interface.
- Funcionamento offline parcial: não há cópia completa dos dados reais no cache; abrir o app do zero sem conexão exibe a tela offline.
- Contas e cartões podem ser adicionados; sua edição/exclusão ainda não está disponível. Orçamentos podem ser substituídos por categoria.
- A recorrência produz projeções, não lançamentos históricos automáticos. O pagamento deve ser registrado. Projeções dependem da cobertura e qualidade dos dados.

## Verificação

`node tests/run.cjs` executa 14 verificações de domínio e API com SQLite em memória: calendário, parcelas, faturas, transferências, receitas estimadas, saldo negativo, reserva, orçamento, variação histórica, voz em português, validação, autenticação/isolamento, concorrência e logout/exclusão. O teste transpila TypeScript para a pasta ignorada `.test-build`.

`node node_modules/typescript/bin/tsc --noEmit` verifica tipos. `npm run build` gera o Worker e os arquivos estáticos. As migrações Drizzle em `drizzle/` devem ser aplicadas uma vez por ambiente; a publicação Sites aplica as de produção.

## Estrutura

- `app/ui/`: telas e componentes.
- `app/api/auth/`: autenticação dos perfis fictícios.
- `app/api/data/`: leitura/escrita autorizada e exclusão.
- `lib/engine.ts`: cálculos determinísticos e alertas.
- `lib/voice.ts`: interpretação inicial da frase.
- `lib/validation.ts`: validação dos dados e relações.
- `lib/session.ts`: validação de sessão no servidor.
- `db/schema.ts` e `drizzle/`: estrutura de persistência.
- `public/`: PWA, ícones e fallback offline.

## Próxima etapa para clientes reais

Autenticação individual e recuperação de acesso, revisão de privacidade/LGPD, testes em aparelhos Android/iOS, limites contra abuso do serviço, push com consentimento, sincronização offline completa, edição de contas/cartões e testes de carga. O plano anterior permanece a referência de evolução; este arquivo descreve exatamente o que foi entregue no MVP.
