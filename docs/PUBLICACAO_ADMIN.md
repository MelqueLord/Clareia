# Publicação da proteção administrativa

## Situação atual

Em 29/10/2026, às 22:15 no horário de São Paulo, foi publicada uma **mitigação operacional** no site existente:

- Removida a variável `TRIAL_ADMIN_EMAIL` da hospedagem.
- Republicada a versão 72 com a configuração de runtime na revisão **11**.
- Deploy `appgdep_6ae3ef8d279c81918eb908e2501fea96`, com resultado `succeeded`.
- URL: https://clareia-financas-mei-pf.igrejamirc01.chatgpt.site
- O público do site permanece o mesmo.

A versão 72 retorna falso na autorização administrativa quando não há e-mail configurado. Assim, a administração fica indisponível para todas as contas, inclusive para uma conta que conheça o e-mail anteriormente utilizado. Isso não altera o acesso comum às finanças por conta autenticada.

**Esta mitigação não é a publicação do código novo por ID.** A versão 72 continua com o código anterior. A remoção da configuração impede que ele conceda privilégios por correspondência de e-mail.

## Impedimento da atualização de código

A abertura do repositório de origem pelo fluxo oficial Sites falhou com:

```
Could not resolve host: git.chatgpt-team.site
```

A verificação de DNS também retornou `ENOTFOUND`. Não foi enviado commit novo, não foi publicado um arquivo construído de código diferente do commit informado e não foi alterado o histórico Git do projeto principal.

A proteção por `TRIAL_ADMIN_USER_ID` + `TRIAL_ADMIN_EMAIL`, a reserva do e-mail e os testes estão preparados localmente. Os testes anteriores cobriam 13 cenários administrativos; foi adicionado um cenário de recusa dos endpoints quando o e-mail está ausente. A aprovação local não comprova uma sessão no site publicado: a validação HTTP direta está limitada pela conectividade desta sessão.

## Concluir a implementação definitiva

1. Restabelecer a resolução do repositório oficial Sites e abrir a origem pelo helper.
2. Preparar e validar a versão com `lib/trial-admin.ts`, `lib/auth.ts`, rotas administrativas, indicador `isAdmin`, tipos e testes correspondentes.
3. Publicar o código novo pelo fluxo normal de origem, build e deploy. Enquanto não houver identidade confirmada, manter as variáveis administrativas ausentes: o código novo também recusará administração.
4. Confirmar a titularidade da conta do responsável conforme [ADMIN.md](ADMIN.md), obter seu `user.id` pelo banco e configurar **as duas variáveis**; republicar para aplicar a configuração.
5. Validar acesso do responsável e recusa de outra conta, incluindo sessão antiga, demonstração e tentativa de falsificar identidade.

**Não restaurar `TRIAL_ADMIN_EMAIL` na versão 72.** Isso reativa a autorização antiga por e-mail. Também não reverter para uma publicação com configuração anterior à revisão 11 sem a mesma mitigação.

A recuperação automática de senha por e-mail continua dependendo de `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no painel seguro. A fila administrativa de recuperação está indisponível enquanto a administração estiver bloqueada.

## Validação da mitigação

14 testes administrativos passaram, incluindo a recusa dos endpoints sem e-mail configurado; lint dos arquivos de segurança aprovado. A função de autorização do commit publicado também foi executada localmente com configuração administrativa ausente, recusando todas as identidades fictícias verificadas. Esta execução local não equivale a um teste HTTP autenticado no ambiente publicado.


## Configuração posterior — 30/10/2026

A versão 72 foi republicada com a revisão de ambiente 12 para fechar novos cadastros (`AUTH_SIGNUP_ENABLED=false`). Deploy `appgdep_6ae48527bc888191ab1290d36791f243`, resultado `succeeded`. O e-mail administrativo continua ausente; a mitigação administrativa permanece em vigor. Isso não publica o código novo por ID. Ver [PENDENCIAS_IMPLEMENTADAS.md](PENDENCIAS_IMPLEMENTADAS.md).
