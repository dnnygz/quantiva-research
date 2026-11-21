# Quantum-Aware Research Explorer

A single platform to explore the results of one research project on the generalization of variational quantum
classifiers (VQCs), organized as two lines of evidence:

- **Line A · Factors Behind Generalization** — *A Controlled Analysis of the Factors Behind the Generalization Gap of
  Variational Quantum Classifiers in Simulated Environments* (WDBC, Ionosphere, Synthetic, Blood Transfusion; 30 re-splits).
- **Line B · Representation & Readout** — *Learned Representations, Geometry, and Variational Readouts: A TCGA-BRCA Case
  Study* (5 development folds × 3 seeds).

It is a read-only explorer of published results plus a minimal admin to maintain them. It does not train models, run
circuits or make clinical predictions, and it makes no claim of quantum advantage.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend (`apps/web`) | React 19 SPA, Vite, TypeScript (strict), Tailwind CSS v4, shadcn/ui-style components on Radix, Recharts, Lucide, React Router |
| API (`apps/api`) | Hono on Cloudflare Workers, Zod, Drizzle ORM (postgres.js) |
| Database | PostgreSQL (Railway in production, Docker locally) via Cloudflare Hyperdrive |
| Images | Cloudflare R2 |
| Shared (`packages/shared`) | Domain vocabulary, JSON contract and Zod schemas used by both apps |
| Seed (`data/seed`, `data/figures`) | Results transcribed from the manuscripts, with provenance |

```
apps/web        SPA (Overview, Explore, Experiment detail, Compare, Admin) + Pages Function proxy for /api
apps/api        Hono routes (public, auth, admin), Drizzle schema + migrations, seed/admin scripts
packages/shared metric catalog, factors, aggregation levels, API types, Zod schemas
data/seed       build.ts → *.json (lines, datasets, protocols, comparison sets, experiments, metrics, findings, figures)
data/figures    figures cropped from the manuscripts
```

## Run locally

Requirements: Node ≥ 20.19 (npm workspaces), Docker.

```bash
npm install
cp .env.example .env                         # set local-only credentials
docker compose up -d db
npm run db:migrate -w @qa/api
npm run db:seed -w @qa/api
npm run figures:seed -w @qa/api                       # local R2 (Miniflare)
ADMIN_PASSWORD='choose-a-long-one' npm run admin:create -w @qa/api -- you@example.org
npm run dev:api                                       # http://localhost:8787
npm run dev:web                                       # http://localhost:5173 (proxies /api → 8787)
```

## Deploy

1. **PostgreSQL on Railway** — create the database and copy its connection URL.
2. **API Worker** — see `apps/api/README.md`: create the Hyperdrive config and the R2 bucket, set `FRONTEND_ORIGIN`
   and `COOKIE_SECURE="true"`, run migrations, seed, figures and admin creation against Railway, then `npm run deploy -w @qa/api`.
3. **Frontend on Cloudflare Pages** — build command `npm run build -w @qa/web`, output `apps/web/dist`, root of the repo
   as project root with `apps/web` as the Pages directory (it contains `functions/` and `wrangler.toml`). The Pages
   project needs a Service Binding `API → quantum-aware-api` (already declared in `apps/web/wrangler.toml`).
4. Connect the GitHub repository to Pages for automatic builds.

Nothing has been deployed yet from this repository; the steps above have not been executed against real accounts.

## Decisions that affect maintenance, rigor or deployment

- **Same-origin API through a Pages Function.** `/api/*` on the Pages domain is forwarded to the Worker via a Service
  Binding. The session cookie stays first-party (`HttpOnly; Secure; SameSite=Lax`) and works in browsers that block
  third-party cookies between `*.pages.dev` and `*.workers.dev`. CORS is still restricted to `FRONTEND_ORIGIN`.
- **Auth.** PBKDF2-SHA256 (100k iterations, WebCrypto — the Workers maximum), random session tokens stored hashed in
  PostgreSQL, 7-day sessions, login throttling (5 failures / 15 min per IP or email), `Origin` check on every write.
- **Metric rows carry split + aggregation level + source.** A mean over 30 seeds, a fold mean, an SD between fold means
  and a reported range are different row types (`aggregation_type`), never confused with single runs.
- **Protocols and comparison sets.** Each experiment belongs to one evaluation protocol. Quantitative comparisons are
  only offered inside a *comparison set* (a curated group of experiments under one protocol, e.g. Table III). An
  experiment can belong to several sets (the baseline VQC appears in Tables I, III, IV), so data is not duplicated.
  Line A and Line B are never plotted on the same quantitative axis; they meet in the qualitative evidence synthesis.
- **Color semantics.** Model identity uses a fixed categorical palette validated for color-vision deficiency. Heatmaps
  use a teal ramp for "higher is better", a lavender ramp for "lower is better" (darker = worse) and coral↔gray↔teal for
  signed differences. Bounded scores (AUC, accuracy, recall) are compared with a zoomed dot plot (position, not length);
  gaps and losses use zero-based bars.
- **Training curves** render only from real per-epoch history entered in Admin; the manuscripts contain none, so the
  UI shows an explicit empty state instead of a reconstructed curve.
- **Evidence synthesis** is curated text stored in the database (`research_questions`, `findings`), editable in Admin.
  The seeded entries quote the manuscripts and should be reviewed by the authors.

See `data/seed/README.md` for the provenance of every seeded number. The source manuscripts are in `docs/manuscripts/`.
