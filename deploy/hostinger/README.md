# Preparação para publicação na Hostinger

## Caminho recomendado para a primeira publicação

O Clareia atual executa como Cloudflare Worker e usa o banco Cloudflare D1. Para colocar um domínio comprado ou administrado na Hostinger sem interromper autenticação, dados, PWA e webhooks, mantenha a aplicação no ambiente atual e use a Hostinger para administrar o domínio e o DNS.

Após definir o domínio:

1. Adicione o domínio personalizado ao projeto publicado.
2. Copie os registros DNS informados pelo ambiente de publicação.
3. Crie esses registros na Zona DNS do hPanel da Hostinger.
4. Aguarde o domínio e o certificado HTTPS ficarem ativos.
5. Atualize `APP_PUBLIC_URL`, `BETTER_AUTH_URL` e `ASAAS_RETURN_URL` com o domínio definitivo.
6. Cadastre na Asaas o webhook `https://seu-dominio.com.br/api/webhooks/asaas`.
7. Teste login, instalação da PWA e cobrança no ambiente sandbox da Asaas antes de ativar cobranças reais.

Esse caminho também funciona quando o plano contratado é Hospedagem Web, WordPress ou Cloud, pois esses planos cuidam apenas do domínio/DNS do Clareia. O servidor e o banco continuam no ambiente atual.

## Hospedar todo o Clareia dentro da Hostinger

Para executar o backend Node.js na própria Hostinger, contrate um VPS. Os planos compartilhados de Hospedagem Web, WordPress e Cloud não oferecem o acesso root necessário para esse backend.

A opção preferida é um VPS com Ubuntu 24.04 e Dokploy ou Docker. O Dokploy permite conectar o repositório GitHub, configurar domínio, HTTPS e variáveis de ambiente em um painel. Essa publicação só deve ocorrer depois de adaptar o Clareia para um servidor Node.js comum e migrar o banco D1 para PostgreSQL ou outro banco persistente disponível no VPS.

Checklist da migração completa:

- VPS Hostinger com Ubuntu 24.04 e Dokploy ou Docker.
- Aplicação adaptada do runtime Cloudflare Worker para Node.js de produção.
- PostgreSQL com backup automático e cópia externa testada.
- Migração das tabelas de autenticação, finanças, assinaturas e eventos.
- Proxy reverso com HTTPS e cabeçalhos de segurança.
- Serviço executado sem privilégios de root e com reinício automático.
- Variáveis secretas configuradas no painel, fora do repositório.
- Restauração do backup validada antes da troca do domínio.
- Endpoint `/api/webhooks/asaas` acessível por HTTPS e sem redirecionamento.
- Monitoramento de disponibilidade e dos eventos enviados pela Asaas.

## Variáveis de produção

Use `env.example` como lista de configuração. Preencha os valores no painel do ambiente de publicação e nunca salve senhas ou chaves reais no repositório.

`DATABASE_URL` só será usada quando a migração para PostgreSQL estiver implementada. A versão atual publicada continua usando o binding D1 fornecido pelo ambiente Cloudflare.

## Ordem sugerida

1. Conectar o domínio da Hostinger à publicação atual.
2. Validar o aplicativo com usuários fictícios.
3. Ativar e testar a Asaas em sandbox.
4. Fazer uma cobrança real de baixo valor somente após validar o webhook.
5. Planejar a migração para VPS apenas se houver necessidade de centralizar a infraestrutura na Hostinger.

## Referências oficiais da Hostinger

- [Compatibilidade do Node.js e necessidade de VPS](https://support.hostinger.com/pt/articles/1583661-o-node-js-e-compativel-com-a-hostinger)
- [VPS com Dokploy](https://support.hostinger.com/en/articles/9822596-how-to-use-the-dokploy-vps-template)
- [VPS com Docker](https://support.hostinger.com/en/articles/8306612-how-to-use-the-docker-vps-template)
- [Sistemas e modelos disponíveis para VPS](https://support.hostinger.com/pt/articles/1583571-quais-sao-os-sistemas-operacionais-disponiveis-para-vps)
