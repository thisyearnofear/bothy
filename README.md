# Bothy — Winter Watch

> Agents, but accountable.

Bothy turns fragmented public **weak signals** (weather, roads, terrain, incident
history) into a **specific, evidence-backed, human-approved intervention** — not
a chatbot, not an alert. Every number is traceable to a cited source + timestamp;
nothing publishes without a human sign-off.

**Demo wedge:** winter access risk on UK upland roads (Lake District). The
pipeline generalizes to any *time-evolving weak signals → accountable
intervention* problem (floods, wildfire evacuation, humanitarian logistics).

## Quick start

```bash
npm install
cp .env.example .env     # DATABASE_URL defaults to the tunneled remote DB (:5433)
scripts/db-tunnel.sh     # SSH tunnel: remote Postgres (Docker + PostGIS) -> localhost:5433
npm run seed             # load live + backtest demo scenarios
npm run dev              # agent API :8787 · web :3000
```

> Prefer a fully local DB? `npm run db:local` installs Postgres 17 + PostGIS via
> Homebrew (downloads ~GBs — not the default on a disk-constrained machine).
> See [`docs/ops.md`](docs/ops.md) for hosting, production, and security.

No API key needed. The agent's **LLM provider chain** is free-first and
OpenAI-compatible: a public Qwen HF endpoint → optional OpenRouter / any
OpenAI-compatible URL / local Ollama — each rate-limited, cached, and tried in
order, falling back to the deterministic **scripted** brain if none respond.
Configure providers in `.env` (copy `.env.example`); see
[`docs/architecture.md`](docs/architecture.md).

## Repo layout

```
apps/web        Next.js · Tailwind · (MapLibre)      — demo surface
apps/agent      TypeScript API · hand-rolled 5-phase agent loop
packages/shared shared domain types + helpers
scripts/        local Postgres bootstrap · pre-commit secret scan
docs/           architecture, engineering decisions, hackathon alignment
```

## Documentation

Full details live in [`docs/`](docs/):

- [architecture.md](docs/architecture.md) — agent loop, tools, data model, risk engine
- [ops.md](docs/ops.md) — hosting, DB topology/credentials, security & production
- [decisions.md](docs/decisions.md) — why hand-rolled loop, PostGIS vs pgvector, scripted brain
- [alignment.md](docs/alignment.md) — how this fits the hackathon challenges

## Hygiene

- `npm run lint` / `npm run typecheck` — ESLint + TS across both apps.
- Pre-commit (Husky): **lint-staged** (eslint --fix) + **`scripts/check-secrets.sh`**
  (blocks secret files, scans the staged diff).

## Status

Agent backend + seed + API done and verified; web dashboard (map, risk cards,
timeline scrubber, approve flow) in progress.

_See [`docs/architecture.md`](docs/architecture.md) for the deep dive._