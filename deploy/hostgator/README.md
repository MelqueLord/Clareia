# Preparação para publicação na HostGator

## Decisão necessária sobre o plano

O Clareia atual executa como Cloudflare Worker e usa banco D1. Por isso, a forma de publicação depende do produto contratado na HostGator:

### Domínio registrado ou hospedagem compartilhada

Use a HostGator para o domínio e DNS e mantenha a aplicação no ambiente atual. Essa é a rota indicada para a primeira versão porque mantém autenticação, banco D1, PWA, HTTPS e webhooks sem migração de dados.

Passos após informar o domínio:

1. Adicionar o domínio personalizado ao projeto publicado.
2. Copiar os registros DNS fornecidos pelo ambiente de publicação.
3. Criar esses registros no painel DNS da HostGator.
4. Aguardar o SSL ficar ativo.
5. Atualizar `BETTER_AUTH_URL`, `ASAAS_RETURN_URL` e a URL do webhook.

### VPS HostGator com Node.js ou Docker

A HostGator oferece VPS com Node.js ou Docker, mas a aplicação precisa trocar o D1 por um banco disponível na VPS e substituir o runtime Worker por um servidor Node de produção. Essa migração deve ser feita antes de apontar o domínio; publicar o comando de desenvolvimento do Wrangler como servidor público não é adequado para dados financeiros.

Checklist da migração completa:

- VPS com acesso SSH e Node.js 22 ou Docker.
- PostgreSQL gerenciado ou instalado na VPS, com backup automático.
- Adaptador de banco para autenticação, finanças, assinaturas e eventos.
- Proxy reverso com HTTPS e cabeçalhos de segurança.
- Serviço com reinício automático e usuário sem privilégios de root.
- Variáveis secretas fora do repositório.
- Backup restaurado em teste antes da virada.
- Endpoint público `/api/webhooks/asaas` sem redirecionamento HTTP.
- Monitoramento de disponibilidade e dos logs de webhook.

## Variáveis de produção

Veja `env.example` nesta pasta. Preencha os valores no painel/serviço da VPS, nunca no arquivo versionado.

## Recomendação para o primeiro go-live

Usar o domínio administrado na HostGator apontando para a publicação atual reduz o risco e permite ativar a Asaas primeiro. A migração física da aplicação para uma VPS pode ser feita depois com janela de manutenção e plano de migração do banco.
