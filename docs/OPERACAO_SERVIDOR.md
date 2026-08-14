# Operação do Clareia

Este guia consolida os procedimentos de operação do Clareia em desenvolvimento e em servidor.

## Resumo rápido

1. Desenvolvimento: `npm run dev` na raiz.
2. Produção: API e PocketBase sob PM2; front-end estático em `dist/apps/web/`.
3. Atualização: `git pull`, `npm ci`, `npm run build --prefix apps/web`.
4. Backup crítico: dados em `apps/pocketbase/pb_data/` (ou volume `/data`).

## Serviços e portas

| Serviço | Porta padrão | Uso |
| --- | --- | --- |
| Web (Vite em desenvolvimento) | `3000` | Interface do usuário |
| API Node.js | `3005` | API e integração de IA |
| PocketBase | `8090` | Banco de dados, autenticação e dashboard |

No ambiente local, a aplicação web acessa o PocketBase pelo proxy configurado em `/hcgi/platform`.

## Pré-requisitos

- Node.js na versão indicada em `.nvmrc`.
- npm.
- PocketBase compatível com o sistema operacional, em `apps/pocketbase/`.
  - Windows: `pocketbase.exe`.
  - Linux/macOS: `pocketbase`.
- Em Linux de servidor, recomenda-se PM2 para manter a API e o PocketBase em execução.

## Credenciais de desenvolvimento

As credenciais abaixo são apenas para desenvolvimento local. Elas dão acesso ao dashboard administrativo do PocketBase, não ao login comum da aplicação.

| Acesso | Endereço | Login | Senha |
| --- | --- | --- | --- |
| Dashboard PocketBase | `http://localhost:8090/_/` | Valor de `PB_SUPERUSER_EMAIL` | Valor de `PB_SUPERUSER_PASSWORD` |

O login do usuário final é criado em `http://localhost:3000/signup`. Não existe usuário comum de demonstração pré-criado.

> Nunca use essa senha em produção. Defina valores exclusivos para `PB_SUPERUSER_EMAIL` e `PB_SUPERUSER_PASSWORD` antes da primeira inicialização do servidor.

Se precisar trocar a senha do superuser em um ambiente já existente, atualize `PB_SUPERUSER_PASSWORD` e execute a migração de superuser com cuidado (ou ajuste pelo dashboard autenticado), sempre com backup prévio de `pb_data`.

## Variáveis de ambiente

Crie ou ajuste estes arquivos antes de iniciar os serviços em produção.

### `apps/pocketbase/.env`

```env
PB_ENCRYPTION_KEY=uma-chave-aleatoria-de-32-caracteres
PB_SUPERUSER_EMAIL=admin@seu-dominio.com
PB_SUPERUSER_PASSWORD=uma-senha-forte-e-exclusiva
```

`PB_ENCRYPTION_KEY` deve ter 16, 24 ou 32 bytes. Não a altere depois que o banco já estiver em uso, pois ela protege dados do PocketBase.

### `apps/api/.env`

```env
PB_SUPERUSER_EMAIL=admin@seu-dominio.com
PB_SUPERUSER_PASSWORD=uma-senha-forte-e-exclusiva
```

A API usa essas credenciais para autenticar no PocketBase. Os valores precisam ser os mesmos configurados no serviço PocketBase.

## Primeira instalação

Na raiz do repositório:

```powershell
npm ci
npm run build --prefix apps/web
```

Na primeira inicialização, o PocketBase aplica automaticamente as migrações em `apps/pocketbase/pb_migrations/`.

## Iniciar em desenvolvimento

Na raiz do repositório, execute apenas um processo:

```powershell
npm run dev
```

O comando inicia web, API e PocketBase juntos. Endereços esperados:

```text
Web:        http://localhost:3000/
API:        http://localhost:3005/
PocketBase: http://localhost:8090/
Dashboard:  http://localhost:8090/_/
```

Não inicie `npm run dev --prefix apps/pocketbase` em outro terminal enquanto `npm run dev` estiver ativo. As duas instâncias disputam a porta `8090`.

### Encerrar desenvolvimento

No terminal que executa `npm run dev`, pressione `Ctrl+C` uma vez. O `concurrently` encerra os três serviços.

## Atualizar no servidor

Na raiz do repositório:

```bash
git pull
npm ci
npm run build --prefix apps/web
```

Faça backup de `apps/pocketbase/pb_data/` ou do diretório montado como `/data` antes de atualizar o PocketBase ou aplicar novas migrações.

## Checklist de atualização (produção)

1. Confirmar backup do diretório de dados do PocketBase.
2. Aplicar atualização de código (`git pull`).
3. Reinstalar dependências (`npm ci`).
4. Gerar build web (`npm run build --prefix apps/web`).
5. Reiniciar serviços no PM2 (`pm2 restart clareia-api` e `pm2 restart clareia-pocketbase`).
6. Validar saúde (`pm2 status` e endpoint `/api/health`).

## Iniciar em produção com PM2

O front-end gerado fica em `dist/apps/web/` e deve ser servido por Nginx, Caddy ou outro servidor estático. A API e o PocketBase são processos separados.

Na raiz do repositório:

```bash
pm2 start npm --name clareia-api -- run start --prefix apps/api
pm2 start npm --name clareia-pocketbase -- run start --prefix apps/pocketbase
pm2 save
pm2 startup
```

O comando `pm2 startup` mostra um comando adicional com permissões administrativas. Execute exatamente o comando apresentado para habilitar a inicialização automática após reinicializações do servidor.

### Verificar produção

```bash
pm2 status
pm2 logs clareia-api
pm2 logs clareia-pocketbase
```

O endpoint de saúde do PocketBase é:

```text
http://127.0.0.1:8090/api/health
```

### Encerrar ou reiniciar produção

```bash
pm2 stop clareia-api
pm2 stop clareia-pocketbase
```

Para iniciar novamente:

```bash
pm2 start clareia-api
pm2 start clareia-pocketbase
```

Para reiniciar após uma atualização:

```bash
pm2 restart clareia-api
pm2 restart clareia-pocketbase
```

## Deploy com aaPanel (recomendado para estabilidade)

Quando houver dificuldade para rodar PocketBase dentro dos fluxos visuais do aaPanel, use o aaPanel apenas para Nginx/SSL e mantenha API + PocketBase como processos PM2 no servidor.

### Arquitetura sugerida

1. Nginx (aaPanel) atende HTTPS do domínio.
2. Nginx faz proxy para Web estática, API Node e PocketBase.
3. PM2 mantém `clareia-api` e `clareia-pocketbase` ativos.

### Regras de proxy que não podem faltar

1. `/api/` -> `http://127.0.0.1:3005/`
2. `/hcgi/platform/` -> `http://127.0.0.1:8090/`
3. `/api/realtime` e conexões websocket devem preservar headers de upgrade.

### Exemplo de bloco Nginx (ajuste ao seu domínio)

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3005/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

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

### Sequência de validação no servidor

1. `pm2 status`
2. `curl http://127.0.0.1:8090/api/health`
3. `curl http://127.0.0.1:3005/` (ou endpoint de saúde da API)
4. Abrir `https://seu-dominio/hcgi/platform/api/health`
5. Testar signup/login no front-end

### Erros comuns no aaPanel

1. `404` no cadastro/login: proxy de `/hcgi/platform` ausente ou com rewrite incorreto.
2. `502 bad gateway`: processo PM2 parado ou porta errada.
3. Realtime quebrado: headers de websocket não configurados.
4. Sessão expira sempre: domínio/origem e `CORS_ORIGIN` inconsistentes.

## Checklist de incidente (resposta rápida)

1. Verificar status dos processos: `pm2 status`.
2. Inspecionar logs recentes: `pm2 logs clareia-api` e `pm2 logs clareia-pocketbase`.
3. Validar PocketBase: `http://127.0.0.1:8090/api/health`.
4. Confirmar variáveis sensíveis (`PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`, `PB_ENCRYPTION_KEY`).
5. Reiniciar serviços se necessário (`pm2 restart ...`).
6. Em caso de risco de perda, interromper mudanças e restaurar backup.

## Observações de segurança

- Não versione arquivos `.env` com chaves ou senhas de produção.
- Publique somente a interface web por trás de HTTPS.
- Não exponha o dashboard do PocketBase (`/_/`) publicamente sem restrição de rede ou proteção adicional.
- Faça backup recorrente do diretório de dados do PocketBase antes de atualizações.

## Acessar dados no PocketBase

Para consultar dados diretamente no PocketBase, use o dashboard administrativo:

```text
http://localhost:8090/_/
```

Passos:

1. Inicie os serviços com `npm run dev` na raiz do repositório.
2. Acesse o dashboard no endereço acima.
3. Entre com o superuser configurado em `PB_SUPERUSER_EMAIL` e `PB_SUPERUSER_PASSWORD`.
4. Abra a seção **Collections** e selecione a coleção desejada (`tasks`, `users`, `planosClareados`, etc.).

Se você iniciar apenas o PocketBase isoladamente, use:

```powershell
npm run dev --prefix apps/pocketbase
```

## Próximos passos (contas independentes)

Este plano permite avançar para produção sem misturar dados entre contas.

### Fase 1: deploy estável no aaPanel (agora)

1. Subir API em `3005` com PM2.
2. Subir PocketBase em `8090` com PM2.
3. Configurar proxy Nginx no aaPanel:
  - `/api/` -> `127.0.0.1:3005`
  - `/hcgi/platform/` -> `127.0.0.1:8090`
4. Validar login, cadastro e endpoint de health em domínio público com HTTPS.

### Fase 2: isolamento de contas (MVP)

1. Criar coleção `accounts` (conta/empresa).
2. Adicionar campo `accountId` em todas as coleções de negócio (`tasks`, `anotacoes`, `planosClareados`, etc.).
3. Atualizar regras de acesso das coleções para permitir somente dados da conta ativa.
4. No backend/API, filtrar consultas por `accountId` da sessão autenticada.

### Fase 3: governança mínima para produção

1. Auditoria simples: registrar quem criou/alterou registros críticos.
2. Convite de membros por e-mail para entrar em contas existentes.
3. Perfis de acesso iniciais: `owner`, `admin`, `member`.
4. Backup diário automatizado de dados e storage do PocketBase.

## Ativar contas independentes após a migração

Depois de aplicar a migração de multi-conta, faça este setup inicial para cada pessoa (ex.: você e sua prima):

1. Acesse o dashboard do PocketBase em `/_/` com superuser.
2. Em `accounts`, crie uma conta para cada usuário:
  - `name`: nome da conta (ex.: `Conta Daniele`, `Conta Prima`).
  - `ownerUserId`: id do usuário dono.
3. Em `users`, preencha `currentAccountId` com o id da conta correspondente.
4. Faça logout/login no web para atualizar a sessão.
5. Crie uma tarefa/anotação em cada usuário e valide que não aparecem na outra conta.

Observação: para não quebrar dados antigos, regras com fallback por `userId` continuam válidas para registros legados sem `accountId`. Registros novos passam a salvar `accountId` automaticamente no front-end.