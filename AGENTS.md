# AGENTS.md

Guia curto para agentes de IA trabalharem com rapidez e segurança neste monorepo.

## Escopo do monorepo

- `apps/web`: React + Vite (porta 3000)
- `apps/api`: Node + Express (porta 3005)
- PostgreSQL: banco de dados principal (porta 5432)
- Fluxo local esperado: web -> `/hcgi/api` -> api -> PostgreSQL

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
```

## Regras de execução para agentes

- Sempre validar mudanças com lint/build do app afetado antes de concluir.
- Se alterar regras de negócio do frontend, priorizar validar também:

```bash
npm run test:calendar-date --prefix apps/web
```

## Convenções de código do projeto

- Frontend concentra regras de priorização/agendamento em libs de domínio, não em componentes de UI.
- Backend usa middleware para autenticação JWT e rate-limit; manter lógica transversal em `apps/api/src/middleware`.
- Mudanças de schema PostgreSQL devem ser idempotentes e feitas em `apps/api/src/db/init.js`.

Arquivos de referência de padrão:

- `apps/web/src/lib/energyLogic.js`
- `apps/web/src/lib/unloadMindLogic.js`
- `apps/web/src/lib/schedulingRules.js`
- `apps/api/src/middleware/auth.js`
- `apps/api/src/middleware/global-rate-limit.js`

## Pitfalls importantes

- Sem proxy `/hcgi/api` no web, login/cadastro retornam 404 em ambiente local.
- `DATABASE_URL` e `JWT_SECRET` devem estar definidos na API.

## Quando tocar em produção

- Priorizar o procedimento oficial em [docs/OPERACAO_SERVIDOR.md](docs/OPERACAO_SERVIDOR.md).
- Antes de alterações de schema, garantir backup do PostgreSQL.
