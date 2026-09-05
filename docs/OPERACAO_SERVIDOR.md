# Operacao do Clareia

Este guia consolida o procedimento de deploy e operacao do Clareia no aaPanel com PostgreSQL como banco principal.

## Resumo rapido

1. Desenvolvimento: npm run dev na raiz.
2. Producao: API Node.js sob PM2; front-end estatico em dist/apps/web/.
3. Atualizacao: git pull, npm ci, npm run build --prefix apps/web.
4. Banco: PostgreSQL para autenticacao e dados da aplicacao.

## Servicos e portas

| Servico | Porta padrao | Uso |
| --- | --- | --- |
| Web (Vite em desenvolvimento) | 3000 | Interface do usuario |
| API Node.js | 3005 (local) | API do produto |
| PostgreSQL | 5432 | Banco de dados da aplicacao |

No ambiente local, a web acessa a API pelo proxy em /hcgi/api.

Importante: a porta real da API em cada servidor de producao e definida pelo
PORT no .env e deve bater com o proxy_pass do bloco Nginx daquele dominio
(ex: `grep proxy_pass /www/server/panel/vhost/nginx/<dominio>.conf`). Em um
servidor aaPanel compartilhado com varios sites, portas como 3005 podem ja
estar em uso por outro projeto — confirme sempre antes de assumir 3005 como
livre ou de matar processos que estejam nela.

## Pre-requisitos

- Node.js na versao indicada em .nvmrc.
- npm.
- PostgreSQL 14+ acessivel pelo servidor de API.
- PM2 no servidor Linux para manter a API ativa.
- aaPanel com Nginx para publicar web estatica + proxy reverso.

## Variaveis de ambiente

Ajuste os arquivos antes de subir em producao.

### apps/api/.env

```env
PORT=3005
CORS_ORIGIN=https://seu-dominio.com
DATABASE_URL=postgresql://usuario:senha@127.0.0.1:5432/clareia
JWT_SECRET=chave-longa-forte-e-aleatoria
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=string-aleatoria-forte
CLAREIA_FINANCE_WEBHOOK_SECRET=segredo-compartilhado-com-fluxo-de-caixa
```

Regras:

- DATABASE_URL e obrigatorio.
- JWT_SECRET e obrigatorio.
- CORS_ORIGIN deve apontar para o dominio publico do front-end.
- CLAREIA_FINANCE_WEBHOOK_SECRET autentica eventos enviados pelo Fluxo de Caixa.
  Use exatamente o mesmo valor em `CLAREIA_WEBHOOK_SECRET` no servidor do
  Fluxo de Caixa. Gere o valor com
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY e obrigatoria para usar a integracao com
  Google Drive (criptografa os tokens salvos em `google_drive_connections`).
  Nao e configuravel pela tela de integracao — precisa ser adicionada
  manualmente no `.env` do servidor. Gere um valor unico com:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
  Depois de definida, nao troque o valor: conexoes ja salvas ficam invalidas
  se a chave mudar (usuarios precisam reconectar o Drive).
- Os campos `GOOGLE_OAUTH_CLIENT_ID`/`CLIENT_SECRET`/`REDIRECT_URI`/`SCOPES`
  podem ser configurados pela propria tela de integracao
  (`/integracoes/google-drive-oauth`), que grava direto no `.env` da API.

### apps/web

- Sem .env obrigatoria para o fluxo basico.
- Em desenvolvimento, o proxy de Vite encaminha /hcgi/api para http://127.0.0.1:3005.

### Integracao com Fluxo de Caixa

Esta integracao envolve dois repositorios e dois bancos PostgreSQL. O Fluxo de
Caixa produz os eventos; o Clareia recebe, valida e transforma cada evento em
tarefa e acompanhamento. O dispatcher da outbox roda dentro do processo da API
do Fluxo de Caixa. Depois que a transacao financeira confirma o commit, uma
tentativa de entrega e agendada sem bloquear a operacao. Eventos ainda
pendentes sao reprocessados periodicamente, por padrao a cada 15 minutos. O
intervalo e configuravel por `FINANCE_OUTBOX_DISPATCH_INTERVAL_MS`. Nao existe
um worker separado.

#### Ordem de configuracao e deploy

1. No Clareia, configure `DATABASE_URL`, `JWT_SECRET` e
  `CLAREIA_FINANCE_WEBHOOK_SECRET` em `apps/api/.env`.
2. No Clareia, execute `npm ci` e inicie/reinicie a API. O schema e aplicado de
  forma idempotente na inicializacao; nao ha comando de migration separado.
3. Suba a API e a web do Clareia e confirme `GET /hcgi/api/health`.
4. Valide a publicacao do webhook com uma chamada sem assinatura:

  ```bash
  curl -i -X POST https://seu-dominio.com/hcgi/api/webhooks/finance \
    -H 'Content-Type: application/json' --data '{}'
  ```

  O resultado esperado e `401`. `404` indica rota/proxy incorreto e `503`
  indica que `CLAREIA_FINANCE_WEBHOOK_SECRET` nao foi carregado.
5. No `.env` da API do Fluxo de Caixa, configure:

```env
CLAREIA_WEBHOOK_URL=https://seu-dominio.com/hcgi/api/webhooks/finance
CLAREIA_WEBHOOK_SECRET=mesmo-valor-de-CLAREIA_FINANCE_WEBHOOK_SECRET
FINANCE_OUTBOX_DISPATCH_INTERVAL_MS=900000
```

`FINANCE_OUTBOX_DISPATCH_INTERVAL_MS` define a varredura periodica da outbox em
milissegundos. O padrao e `900000` (15 minutos). Use um inteiro positivo; valor
ausente ou invalido volta ao padrao.

6. No repositorio do Fluxo de Caixa, instale dependencias e aplique as migrations:

  ```bash
  npm ci
  npm run prisma:deploy --prefix api
  npm run build --prefix api
  ```

7. Inicie/reinicie a API do Fluxo de Caixa e confirme `GET /health`.
8. Confirme nos logs de inicializacao que o processo permanece ativo. O mesmo
  processo executa o detector e o dispatcher da outbox; nao suba outro worker.
  A tentativa imediata e o timer usam o mesmo coordenador e nao processam a
  mesma tentativa simultaneamente dentro da instancia.
9. No Clareia, abra **Preferencias > Integracoes**, informe o codigo da conta
  proprietaria no Fluxo de Caixa e confirme o estado **Conectado**.
10. Gere um evento de fatura no Fluxo. No Clareia, vincule cada **cliente do
   Fluxo de Caixa** ao **projeto do Clareia** correspondente.
11. Execute um teste controlado: envie uma fatura, registre um pagamento
   parcial e depois quite a fatura. Confirme a criacao e a conclusao da tarefa
   e do item em **Aguardando retorno**.
12. Confira a outbox no banco do Fluxo e os eventos recebidos no Clareia pelas
   consultas abaixo.

Eventos recebidos antes do vinculo ficam pendentes e sao reaplicados
automaticamente quando a conta ou o cliente e vinculado. O UUID do evento e a
chave idempotente nos dois sistemas, portanto um retry nao duplica registros.

#### Conferir entrega e estados

No PostgreSQL do Fluxo de Caixa:

```sql
SELECT id, "eventType", status, attempts, "lastError",
     "createdAt", "processedAt", "nextAttemptAt"
FROM "DomainEventOutbox"
WHERE "eventType" LIKE 'finance.%'
ORDER BY "createdAt" DESC
LIMIT 50;
```

Estados esperados: `pending`, `processing`, `processed` e `failed`. Falhas sao
reenviadas com backoff, ate cinco tentativas. O campo `lastError` registra
somente a categoria/HTTP da falha, sem segredo ou corpo da resposta.

No PostgreSQL do Clareia, a tabela equivalente ao IntegrationEvent e
`finance_webhook_events`:

```sql
SELECT event_id, event_type, external_account_id, user_id, status,
     error_message, received_at, processed_at
FROM finance_webhook_events
ORDER BY received_at DESC
LIMIT 50;
```

Interpretacao dos estados:

- `applied`: tarefa e acompanhamento foram aplicados.
- `pending_account_mapping`: falta conectar a conta na tela de Integracoes.
- `pending_client_mapping`: falta vincular o cliente a um projeto.

#### Pagamento no Fluxo, mas nada apareceu no Clareia

Siga esta ordem para localizar o ponto da falha:

1. Confirme que o pagamento gerou `finance.invoice.partially_paid` ou
  `finance.invoice.paid` na `DomainEventOutbox`.
2. Se nao houver linha, revise a transacao do pagamento e os logs da API do
  Fluxo. A gravacao do pagamento e do evento deve ocorrer na mesma transacao.
3. Se estiver `pending`, confira `nextAttemptAt` e confirme que a API do Fluxo
  continua ativa. Novos eventos tentam entrega logo apos o commit. Depois de
  uma falha, o evento respeita o backoff e volta a ser elegivel quando
  `nextAttemptAt` vence; a varredura periodica ocorre, por padrao, a cada 15
  minutos.
4. Se estiver `failed`, verifique `attempts`, `lastError`, URL publica, HTTPS e
  se os dois servidores usam exatamente o mesmo segredo.
5. Se estiver `processed`, procure o mesmo `id` como `event_id` em
  `finance_webhook_events` no Clareia.
6. Se o evento estiver `pending_account_mapping` ou `pending_client_mapping`,
  conclua o vinculo na tela. O replay ocorre ao salvar.
7. Se estiver `applied`, procure a tarefa pelo numero da fatura e confira se o
  usuario/projeto vinculados sao os esperados.
8. Consulte os logs sem imprimir variaveis de ambiente:

  ```bash
  pm2 logs fluxo-caixa-api --lines 200
  pm2 logs clareia-api --lines 200
  ```

Depois de corrigir uma configuracao e somente se as cinco tentativas tiverem
acabado, libere os eventos financeiros falhos para novo envio:

```sql
UPDATE "DomainEventOutbox"
SET status = 'pending', attempts = 0, "lastError" = NULL, "nextAttemptAt" = NULL
WHERE "eventType" LIKE 'finance.%' AND status = 'failed';
```

O reenvio e seguro porque o Clareia rejeita duplicacao pelo `event_id`.

## Primeira instalacao no servidor

Na raiz do repositorio:

```bash
git pull
npm ci
npm run build --prefix apps/web
```

A API cria/garante o schema automaticamente na inicializacao.

## Iniciar em desenvolvimento

Com PostgreSQL local ativo:

```powershell
npm run dev
```

Enderecos esperados:

```text
Web: http://localhost:3000/
API: http://localhost:3005/
Health da API: http://localhost:3005/health
```

### Encerrar desenvolvimento

No terminal em execucao, pressione Ctrl+C uma vez.

## Atualizar no servidor (producao)

Na raiz do repositorio:

```bash
git pull
npm ci
npm run build --prefix apps/web
pm2 restart clareia-api
```

cd /www/wwwroot/clareia

git diff -- apps/api/src/main.js
git stash push -m "backup main.js antes do deploy" -- apps/api/src/main.js

git pull --ff-only
git log -2 --oneline



SITE="/www/wwwroot/clareia"

realpath "$SITE"
ls -ld "$SITE"

chown -R www:www "$SITE"

find "$SITE" -path "$SITE/.git" -prune -o -type d -exec chmod 755 {} +
find "$SITE" -path "$SITE/.git" -prune -o -type f -exec chmod 644 {} +

## Checklist de atualizacao (producao)

1. Confirmar backup recente do PostgreSQL.
2. Aplicar atualizacao de codigo (git pull).
3. Reinstalar dependencias (npm ci).
4. Gerar build web (npm run build --prefix apps/web).
5. Reiniciar API no PM2 (pm2 restart clareia-api).
6. Validar saude (pm2 status e endpoint /hcgi/api/health no dominio).

## Iniciar em producao com PM2

O front-end gerado fica em dist/apps/web/ e deve ser servido pelo Nginx do aaPanel.

Na raiz do repositorio:

```bash
pm2 start npm --name clareia-api -- run start --prefix apps/api
pm2 save
pm2 startup
```

O comando pm2 startup mostrara um comando adicional com permissao administrativa. Execute exatamente o comando retornado.

### Verificar producao

```bash
pm2 status
pm2 logs clareia-api --lines 200
curl http://127.0.0.1:3005/health
```

### Encerrar ou reiniciar API

```bash
pm2 stop clareia-api
pm2 start clareia-api
pm2 restart clareia-api
```

## Deploy com aaPanel (PostgreSQL)

Use o aaPanel para Nginx e SSL. Mantenha a API em PM2.

### Gerenciando a API pelo Node Project do aaPanel

Se o servidor usa o gerenciador "Node Project" do proprio aaPanel (em vez de
`pm2` direto via SSH), configure-o assim para evitar processos duplicados
brigando pela mesma porta:

- **Comando de start:** `npm run start` executado a partir da raiz do
  repositorio.
- **Porta:** deve ser exatamente a porta usada no `proxy_pass` do bloco Nginx
  do dominio (confirme com `grep proxy_pass` no arquivo de vhost).
- Depois de configurar pelo painel, use sempre os botoes Start/Stop/Restart
  do painel — evite rodar `pm2 start`/`pm2 delete` manualmente para essa
  mesma aplicacao, para nao criar dois processos gerenciando a mesma porta.

### Arquitetura sugerida

1. Nginx (aaPanel) atende HTTPS do dominio.
2. Nginx entrega o front-end estatico de dist/apps/web/.
3. Nginx faz proxy de /hcgi/api para a API Node na porta 3005.
4. API conecta no PostgreSQL pela DATABASE_URL.

### Regras de proxy obrigatorias

1. /hcgi/api/ para http://127.0.0.1:3005/
2. Encaminhar headers de host/origem (X-Forwarded-For e X-Forwarded-Proto).
3. Se houver recursos com stream/websocket no futuro, manter proxy_http_version 1.1.

### Exemplo de bloco Nginx (ajuste ao seu dominio)

```nginx
location /hcgi/api/ {
  proxy_pass http://127.0.0.1:3005/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
  root /caminho/do/projeto/dist/apps/web;
  try_files $uri $uri/ /index.html;
}
```

## Sequencia de validacao no servidor

1. pm2 status
2. curl http://127.0.0.1:3005/health
3. Abrir https://seu-dominio/hcgi/api/health
4. Testar signup e login no front-end publicado
5. Testar criacao e leitura de tarefas

## Erros comuns no aaPanel

1. 404 no cadastro/login: proxy de /hcgi/api ausente ou com rewrite incorreto.
2. 502 bad gateway: API parada no PM2 ou porta errada no proxy.
3. Falha de CORS: CORS_ORIGIN diferente do dominio real.
4. Falha de autenticacao no banco: DATABASE_URL invalida ou usuario sem permissao.

## Checklist de incidente (resposta rapida)

1. Verificar processos: pm2 status.
2. Inspecionar logs: pm2 logs clareia-api --lines 200.
3. Validar API local: curl http://127.0.0.1:3005/health.
4. Validar endpoint publicado: curl -I https://seu-dominio/hcgi/api/health.
5. Confirmar variaveis: DATABASE_URL, JWT_SECRET, CORS_ORIGIN.
6. Reiniciar API se necessario: pm2 restart clareia-api.

## Observacoes de seguranca

- Nao versionar .env de producao.
- Usar senha forte no usuario do PostgreSQL.
- Restringir acesso de rede ao PostgreSQL (sem exposicao publica, salvo necessidade controlada).
- Publicar o front-end apenas por HTTPS.
- Programar backup recorrente do PostgreSQL antes de atualizacoes.


