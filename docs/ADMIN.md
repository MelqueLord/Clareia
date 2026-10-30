# Administração segura do Clareia

O administrador é uma conta individual do Better Auth vinculada explicitamente pelo operador da hospedagem. O servidor exige as duas variáveis:

- `TRIAL_ADMIN_USER_ID`: valor exato de `user.id` da conta do responsável.
- `TRIAL_ADMIN_EMAIL`: e-mail dessa mesma conta; a comparação ignora maiúsculas e espaços nas extremidades.

Sem ambas, nenhum usuário recebe privilégios administrativos. Não existe autorização alternativa somente por e-mail. Sessões de demonstração e contas com troca inicial de senha pendente também são recusadas.

A política é aplicada às leituras e alterações em `/api/admin/access` e `/api/admin/recovery`, além do indicador `isAdmin` retornado por `/api/data`, inclusive após o vencimento do teste. Parâmetros e cabeçalhos enviados pelo navegador não escolhem o administrador.

## Vincular uma conta existente antes de publicar

1. Confirme que a conta pertence ao responsável. Um registro com o e-mail esperado, sozinho, não comprova titularidade. Se houver dúvida ou se o site já aceitava cadastros públicos, use a recuperação de senha enviada diretamente à caixa de e-mail do responsável por um provedor confiável; esse fluxo revoga as sessões anteriores. Não use um link repassado por um solicitante desconhecido para comprovar propriedade.
2. Pelo console autenticado do banco D1 da hospedagem, consulte a conta confirmada. Substitua o e-mail do exemplo pelo e-mail do responsável:

   ```sql
   SELECT id, email, email_verified, created_at
   FROM user
   WHERE lower(email) = lower('responsavel@seu-dominio.com.br');
   ```

3. Configure `TRIAL_ADMIN_USER_ID` com o `id` conferido e `TRIAL_ADMIN_EMAIL` com o e-mail correspondente no ambiente que receberá a publicação. Não use o identificador financeiro com prefixo `personal:`, o ID de sessão ou um valor fornecido no corpo de uma requisição.
4. Publique a versão com as duas variáveis configuradas. Verifique o painel com a conta do responsável e confirme a recusa de outra conta. Não publique somente com a variável antiga: o acesso administrativo ficará bloqueado até o ID ser configurado.

## Se ainda não existe uma conta do responsável

Crie a conta individual em um ambiente de acesso controlado, antes de reservar seu e-mail nas variáveis de administração. Com as duas variáveis ausentes, esse cadastro não recebe privilégios. Confirme o controle da conta e da caixa de e-mail e faça a vinculação descrita acima. Não abra um endpoint público de criação ou promoção de administrador.

Quando `TRIAL_ADMIN_EMAIL` está definido, novos cadastros públicos com esse endereço são recusados, mesmo se o ID ainda não estiver configurado. O cadastro existente continua podendo entrar e recuperar a senha. A conta só é excluída do limite do piloto se seu ID e e-mail corresponderem aos configurados.

## Recuperação e troca de responsável

- Configure e teste a entrega de recuperação por e-mail para a conta administrativa. A fila manual de suporte não comprova o controle de uma caixa de e-mail e pode depender do próprio administrador que perdeu o acesso.
- Se a conta for excluída e recriada, ela terá outro ID e não herdará privilégios. Confira a nova identidade antes de alterar a variável.
- Para trocar de responsável, confira a nova conta e atualize as duas variáveis pela hospedagem. Para revogar a autorização administrativa, remova `TRIAL_ADMIN_USER_ID`.
- Nenhuma senha ou segredo de autenticação deve ser salvo no repositório.

## Verificação automatizada

Execute `npm run test:admin`. Os testes usam as migrações reais em SQLite na memória e sessões de autenticação simuladas, sem acessar contas ou bancos publicados. Cobrem autorização e recusa dos endpoints, falsificação de identidade no pedido, sessão de demonstração, troca inicial de senha, recuperação, indicador administrativo e reserva do e-mail no cadastro.

## Estado da publicação

Consulte [PUBLICACAO_ADMIN.md](PUBLICACAO_ADMIN.md) antes de configurar as variáveis. Há uma mitigação publicada que mantém a administração bloqueada na versão anterior; o código por ID ainda precisa ser publicado. Não configurar novamente o e-mail administrativo enquanto a versão por ID não estiver efetivamente implantada.
