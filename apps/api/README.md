# @qa/api

Hono API on Cloudflare Workers. PostgreSQL via Hyperdrive (`HYPERDRIVE`), figure images in R2 (`FIGURES`).

## Configuration

| Name | Where | Purpose |
| --- | --- | --- |
| `FRONTEND_ORIGIN` | `wrangler.toml` `[vars]` | Allowed CORS / CSRF origin. Local: `http://localhost:5173`. |
| `COOKIE_SECURE` | `wrangler.toml` `[vars]` | `"false"` locally, **`"true"` in production** (session cookie gets `Secure`). |
| `HYPERDRIVE` | `wrangler.toml` | Hyperdrive id; local development derives its connection string from `DATABASE_URL`. |
| `FIGURES` | `wrangler.toml` | R2 bucket `quantum-aware-figures`. |
| `DATABASE_URL` | `.env` locally; secret in deployment tooling | PostgreSQL connection string used by local Hyperdrive and database scripts. |
| `ADMIN_PASSWORD` | shell env (`admin:create`) | Optional; otherwise prompted. Min 12 chars. |

No Worker secrets are stored in the repository.

## Local development

```bash
npm install                                   # repo root
cp .env.example .env                          # set local-only credentials
docker compose up -d db                       # repo root
npm run db:migrate -w @qa/api
npm run db:seed -w @qa/api                    # idempotent
npm run figures:seed -w @qa/api               # uploads data/figures to local R2
npm run admin:create -w @qa/api -- admin@example.com
npm run dev -w @qa/api                        # http://localhost:8787/api/health
```

`npm run db:generate -w @qa/api` creates a new migration after editing `src/db/schema.ts`.

## Deploy (Cloudflare + Railway Postgres)

```bash
cd apps/api
npx wrangler hyperdrive create quantum-aware-db --connection-string="<RAILWAY_DATABASE_URL>"
#   → put the returned id in wrangler.toml [[hyperdrive]].id
npx wrangler r2 bucket create quantum-aware-figures
#   set FRONTEND_ORIGIN to the Pages URL and COOKIE_SECURE = "true" in wrangler.toml (or dashboard)
DATABASE_URL="<RAILWAY_DATABASE_URL>" npm run db:migrate
DATABASE_URL="<RAILWAY_DATABASE_URL>" npm run db:seed
npm run figures:seed -- --remote
DATABASE_URL="<RAILWAY_DATABASE_URL>" npm run admin:create -- you@example.org
npm run deploy
```

## Routes

Public (only `published` records): `GET /api/health`, `/api/catalog`, `/api/experiments` (`?line=&dataset=&protocol=&factor=`),
`/api/experiments/:slug`, `/api/comparison-sets`, `/api/questions`, `/api/figures` (`?experiment=&line=`),
`/api/figures/:id/image`.

Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

Admin (session cookie + trusted `Origin` on writes): `/api/admin/experiments[/:id]`, `PUT /api/admin/experiments/:id/history`,
`/api/admin/metrics/:id`, `/api/admin/questions[/:id]`, `/api/admin/findings/:id`, `/api/admin/figures[/:id]` (multipart).
Deletes return `{ "ok": true }`. PATCH bodies only change the keys that are present.
