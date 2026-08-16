# AGENTS.md

Guia curto para agentes de IA trabalharem com rapidez e segurança neste monorepo.

## Escopo do monorepo

- `apps/web`: React + Vite (porta 3000)
- `apps/api`: Node + Express (porta 3005)
- `apps/pocketbase`: PocketBase (porta 8090)
- Fluxo local esperado: web -> `/api` -> api e web -> `/hcgi/platform` -> pocketbase

Arquitetura operacional detalhada: [docs/OPERACAO_SERVIDOR.md](docs/OPERACAO_SERVIDOR.md)

## Comandos essenciais

Na raiz do repositório:

```bash
npm ci
npm run dev
npm run lint
npm run build
```

Comandos por app:

```bash
npm run dev --prefix apps/web
npm run lint --prefix apps/web
npm run build --prefix apps/web

npm run dev --prefix apps/api
npm run lint --prefix apps/api

npm run dev --prefix apps/pocketbase
npm run start --prefix apps/pocketbase
```

## Regras de execução para agentes

- Sempre validar mudanças com lint/build do app afetado antes de concluir.
- Se alterar regras de negócio do frontend, priorizar validar também:

```bash
npm run test:calendar-date --prefix apps/web
```

- Evitar iniciar uma segunda instância do PocketBase em paralelo quando `npm run dev` da raiz estiver ativo (conflito na porta 8090).

## Convenções de código do projeto

- Frontend concentra regras de priorização/agendamento em libs de domínio, não em componentes de UI.
- Backend usa middleware para autenticação PocketBase e rate-limit; manter lógica transversal em `apps/api/src/middleware`.
- Mudanças de schema devem ser feitas via migrações em `apps/pocketbase/pb_migrations`.
- Em hooks do PocketBase, usar `onBootstrap` com `e.next()` antes de acessar coleções.

Arquivos de referência de padrão:

- `apps/web/src/lib/energyLogic.js`
- `apps/web/src/lib/unloadMindLogic.js`
- `apps/web/src/lib/schedulingRules.js`
- `apps/api/src/middleware/pocketbase-auth.js`
- `apps/api/src/middleware/global-rate-limit.js`
- `apps/pocketbase/pb_hooks/superuser-sync.pb.js`

## Pitfalls importantes

- Windows: o binário do PocketBase precisa ser compatível com o SO (`pocketbase.exe`).
- `PB_ENCRYPTION_KEY` precisa ter tamanho AES válido (16, 24 ou 32 bytes).
- Sem proxy `/hcgi/platform` no web, login/cadastro retornam 404 em ambiente local.
- Segurança: não manter fallback de credenciais de superuser no código para produção; usar apenas variáveis de ambiente.

## Quando tocar em produção

- Priorizar o procedimento oficial em [docs/OPERACAO_SERVIDOR.md](docs/OPERACAO_SERVIDOR.md).
- Antes de alterações de PocketBase, garantir backup de `pb_data` (ou volume `/data`).
