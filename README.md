# Bothy — Winter Watch

> Agents, but accountable.

Bothy is an agentic **risk-intelligence layer**: it turns fragmented public weak
signals — weather, roads, terrain, incident history — into a **specific,
evidence-backed, human-approved intervention**. Not just a chatbot, not just an
alert. Every number on the screen is traceable to a **cited source and a
timestamp**, and nothing is published without a human sign-off.

**Demo wedge:** winter access risk on UK mountain/upland roads (Lake District).
The pipeline generalizes to any "time-evolving weak signals → accountable
intervention" problem (flood/wildfire evacuation, humanitarian logistics,
community early-warning).

---

## Why this exists (hackathon framing)

Two of the event challenges are a direct fit:

- **Trusted information** — *verification is broken, misinformation spreads
  faster than truth.* Bothy is the opposite of a wrapper: ranked evidence,
  confidence + uncertainty, a full audit trail, and **no autonomous output**.
- **Search and rescue** — teams struggle with coordination and slow detection.
  Bothy flags *where* exposure is building **before** people get stranded; the
  backtest proves it ("flagged 2h15m before the first MR call").

Nothing is published autonomously — the agent **drafts**, a duty officer
**approves**, and every decision is **logged**. That is the safety design.

## Architecture

```
apps/web       Next.js + Tailwind + MapLibre  — the visual demo surface
apps/agent     TypeScript agent API (Express) — hand-rolled 5-phase loop
packages/shared Shared domain types + helpers
scripts/       Local Postgres bootstrap (setup_db.sh)
```

### The agent loop (no LangGraph)

A **hand-rolled state machine** — `detect → retrieve → reason → recommend →
act` — over a small, auditable toolset. You can literally show judges the code
path. Every phase and every tool call is logged to the audit trail.

```ts
tools: get_weather_warning, get_road_disruptions, search_incidents,
       get_route_characteristics, draft_public_warning, create_human_review
```

The "brain" is swappable:

- **scripted** (default) — deterministic, zero API key, demo-safe. Same tool
  call order, same trace. Your live-demo failsafe.
- **llm** — Anthropic tool-calling (`ANTHROPIC_API_KEY`). Falls back to scripted
  if the key is absent or the loop misbehaves.

### Data

- **Postgres + PostGIS** for structured `RiskEvent`/`RiskAssessment` schema and
  route geometry.
- **Incident narratives** retrieved by `search_incidents` (geo + date + hazard
  filter, then semantic rank). The demo uses a tiny deterministic bag-of-words
  embedding (a *one-line* swap to `pgvector` in production — see
  `apps/agent/src/schema.sql`).
- A precomputed **risk timeline** (30-min snapshots) powers the drag-to-scrub
  "confidence timeline" — risk isn't a static number, it's how the score evolved
  as signals arrived.

## Scenarios

| id | title | agent horizon | note |
|----|-------|---------------|------|
| `live` | Lake District today | 14:30 | synthetic winter day, real Met-style signals |
| `backtest` | 14 Jan 2018 Wasdale | 17:30 | demo reconstruction; the real outcome (19:45) is hidden from the agent |

In the backtest the agent sees **only pre-incident data** and flags the route
`HIGH` before the first MR call — retrospective validation.

---

## Getting started

```bash
# 1. Database (local Postgres — PostGIS + vector extensions via Homebrew)
npm run db:local

# 2. Install workspace, lint, typecheck
npm install
npm run lint
npm run typecheck

# 3. Seed demo data (live + backtest scenarios, routes, events, risk timeline)
npm run seed

# 4. Run the agent API + web dev
npm run dev            # agent on :8787, web on :3000
```

> Prefer Docker? `npm run db:up` uses `docker-compose.yml`
> (`postgis/postgis:16-3.5`).

### Environment

Copy `.env.example` to `.env`. The only required var is `DATABASE_URL`. Leaving
`ANTHROPIC_API_KEY` empty runs the deterministic scripted brain.

| var | default | purpose |
|-----|---------|---------|
| `DATABASE_URL` | `postgres://bothy:bothy@localhost:5432/bothy` | agent DB |
| `ANTHROPIC_API_KEY` | *(empty)* | enables LLM brain |
| `BOTHY_MODEL` | `claude-sonnet-4-5` | tool-calling model |
| `PORT` | `8787` | agent API |
| `AGENT_URL` | `http://localhost:8787` | web `/api` proxy target |

## Development hygiene

- **ESLint** (flat config) across both apps: `npm run lint` (runs on staged TS
  via lint-staged).
- **Typecheck**: `npm run typecheck`.
- **Pre-commit hooks** (Husky) run automatically on `git commit`:
  1. `lint-staged` → `eslint --fix` on staged `ts/tsx`
  2. `scripts/check-secrets.sh` → refuses known secret files / high-signal
     secret patterns in the staged diff (add `gitleaks detect` in CI for a
     heavier scan).

## API (summary)

| method | path | purpose |
|--------|------|---------|
| GET | `/api/scenarios` | list demo scenarios |
| GET | `/api/scenario/:id` | scenario meta + routes |
| GET | `/api/scenario/:id/risk?at=` | per-route risk at time `at` (ranked) |
| GET | `/api/scenario/:id/route/:rid/timeline` | risk snapshot series |
| POST | `/api/scenario/:id/assess` | run the agent loop → assessment |
| POST | `/api/assessments/:id/decision` | duty-officer approve / reject |
| GET | `/api/scenario/:id/audit` | audit trail |

## Status

- [x] Monorepo, DB schema, seed (live + backtest), risk engine + timelines
- [x] Hand-rolled agent loop + six tools (scripted + LLM brains)
- [x] Agent REST API, audit trail, approve/reject
- [x] Lint + typecheck + pre-commit secrets hook, docs
- [ ] Web dashboard (MapLibre map, risk cards, timeline scrubber, approve UI)

See `docs/` for the alignment brief and the decision memo.