# Operacao do Clareia

Este guia consolida o procedimento de deploy e operacao do Clareia no aaPanel com PostgreSQL como banco principal.

## Resumo rapido

1. Desenvolvimento com PostgreSQL: npm run dev:postgres na raiz.
2. Producao: API Node.js sob PM2; front-end estatico em dist/apps/web/.
3. Atualizacao: git pull, npm ci, npm run build --prefix apps/web.
4. Banco principal: PostgreSQL (nao depende de PocketBase para auth e tarefas).

## Servicos e portas

| Servico | Porta padrao | Uso |
| --- | --- | --- |
| Web (Vite em desenvolvimento) | 3000 | Interface do usuario |
| API Node.js | 3005 | API do produto |
| PostgreSQL | 5432 | Banco de dados principal |
| PocketBase (opcional/legado) | 8090 | Apenas rotinas legadas especificas |

No ambiente local, a web acessa a API pelo proxy em /hcgi/api.

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
```

Regras:

- DATABASE_URL e obrigatorio.
- JWT_SECRET e obrigatorio.
- CORS_ORIGIN deve apontar para o dominio publico do front-end.

### apps/web

- Sem .env obrigatoria para o fluxo basico.
- Em desenvolvimento, o proxy de Vite encaminha /hcgi/api para http://127.0.0.1:3005.

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
npm run dev:postgres
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

Se ainda existir dependencia legada de PocketBase, mantenha tambem:

```nginx
location /hcgi/platform/ {
  proxy_pass http://127.0.0.1:8090/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
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
