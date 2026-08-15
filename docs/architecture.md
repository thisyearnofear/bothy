# Architecture

This is the deep dive. For the two-line pitch see the [README](../README.md);
for rationale see [decisions.md](decisions.md); for hackathon framing see
[alignment.md](alignment.md).

## Topology

```
Browser (Next.js :3000) ──/api/*──> agent API (Express :8787) ──> Postgres + PostGIS
                                       │
                                       └─ tool-calling loop (scripted | LLM provider chain)
```

The web app **proxies** `/api/*` to the agent via a Next.js rewrite
(`next.config.ts`), so there's no CORS and no credentials in the browser.
All agent state lives in Postgres.

## Repository layout

| path | responsibility |
|------|----------------|
| `apps/agent/src/server.ts` | Express API (routes below) |
| `apps/agent/src/agent/loop.ts` | the hand-rolled 5-phase loop |
| `apps/agent/src/agent/tools.ts` | the 6 narrow, auditable tools |
| `apps/agent/src/agent/scripted.ts` / `llm.ts` | swappable "brains" |
| `apps/agent/src/engine/risk.ts` | deterministic risk score engine + timeline |
| `apps/agent/src/engine/seedData.ts` | demo scenarios (live + backtest) |
| `apps/agent/src/repo.ts` | data-access layer (map rows → domain types) |
| `apps/agent/src/seed.ts` | idempotent DB bootstrap + risk snapshot build |
| `apps/agent/src/schema.sql` | PostGIS schema + cosine helper |
| `packages/shared/src/{types,lib}.ts` | domain types + helpers (relative-imported) |

## Functions: schematic

```ts
// loop = detect → retrieve → reason → recommend → act
runAssessment({ scenario, routeId?, at, engine })
  → loads scenario data, picks the (requested | highest-risk) route
  → makes a ToolSet bound to { scenario, now, route, ...trace }
  → brain (scripted | Claude) gathers evidence and drafts the decision
  → act: tools.create_human_review() persists an Assessment + audit row
  → returns the Assessment (causal chain, evidence, draft, trace)
```

## The tools (narrow + read-only, except the last)

| tool | side effect | purpose |
|------|-------------|---------|
| `get_live_weather_snapshot` | read | latest operator-persisted Open-Meteo context; non-evidentiary and score-neutral |
| `get_weather_warning` | read | active Met Office warnings |
| `get_road_disruptions` | read | closures / disrupts / plough status |
| `search_incidents` | read | route / hazard / geo filter → semantic rank |
| `get_route_characteristics` | read | gradient, exposure, ploughing, actors |
| `draft_public_warning` | read | template draft from engine score |
| `create_human_review` | **write** | persist assessment to approval queue |

No open browsing, provider fetch, or autonomous send occurs during assessment.
`get_live_weather_snapshot` reads a frozen database snapshot only, and
`create_human_review` is the **only** exit point — both brains end by calling it.

## Brains

- **scripted** — deterministic; runs the read-tools in a fixed order, builds the
  causal chain verbatim from engine citations, derives confidence/priority from
  label+sources. Zero API key, repeatable demo, and a live-demo failsafe.
- **llm** — an **OpenAI-compatible provider chain**
  (`apps/agent/src/agent/providers.ts`). Providers are tried in priority order
  (`BOTHY_LLM_PROVIDERS`): a free public Qwen HF endpoint → optional Venice AI /
  OpenRouter / any OpenAI-compatible URL / local Ollama. Venice is a separate,
  server-only opt-in: its key is read only from `VENICE_API_KEY` in the ignored
  runtime environment and is never sent to the browser. `SYSTEM_PROMPT` pins the
  5-phase pipeline + "use ONLY these tools" + "finish with
  create_human_review". Every provider is **rate-limited** (token bucket),
  **cached** (short TTL), timed out, and retried once on 429/`Retry-After`; a
  provider that fails falls through to the next, then to **scripted**. The full
  chain result (reasoning, causal chain, draft) is written to the audit trail.

## Risk engine

Deterministic, fully decomposable — every contribution is an `EvidenceCitation`:

```
base 0.08
+ active warnings (level × exposure × matched-hazard weight)
+ forecast snow (on snow-exposed routes) and sub-zero icing
+ road closure / disruption / report   − plough-complete
+ recent incident on route (≤ 6h)
+ historical incident pattern (route + hazard match)
→ clamp [0, 0.97]
```

`buildTimeline()` snapshots every route every 30 min across a scenario → powers
the front-end **confidence timeline** (risk as a story over time, not a number).

## Scenarios

| id | horizon | note |
|----|---------|------|
| `live` | today 14:30 | synthetic winter day, real signal shapes |
| `backtest` | 12-13 Feb 2026 · 21:30 | illustrative replay based on a reported A66 closure; the post-horizon marker is hidden from the agent |

The backtest applies modeled pre-closure signals, then reveals a sourced A66
snow closure beyond the horizon. Its timestamps, inputs, and computed lead time
are illustrative demo data—not retrospective model validation. See the source
and evidence boundary in [dashboard.md](dashboard.md#backtest-evidence-boundary).

## API

| method | path |
|--------|------|
| GET | `/api/scenarios` |
| GET | `/api/scenario/:id` |
| GET | `/api/scenario/:id/risk?at=` |
| GET | `/api/scenario/:id/route/:rid/timeline` |
| GET | `/api/scenario/live/live-weather` — latest persisted Open-Meteo snapshot only; never fetches on read or serves backtests |
| POST | `/api/scenario/live/live-weather/refresh` — operator-triggered fetch, provenance persistence, and audit entry; returns `503` and retains the last good snapshot if every provider request falls back |
| POST | `/api/scenario/:id/assess` |
| POST | `/api/assessments/:id/decision` |
| GET | `/api/scenario/:id/assessments` · `/api/scenario/:id/audit` |
| GET | `/api/health` |

## Env vars (see `.env.example`)

**Core**

| var | default | purpose |
|-----|---------|---------|
| `DATABASE_URL` | `postgres://…@localhost:5433/bothy` — via SSH tunnel (see [ops.md](ops.md)) | agent DB |
| `PORT` | `8787` | agent API |
| `AGENT_URL` | `http://localhost:8787` | web → agent proxy target |
| `WEB_ORIGIN` | `http://localhost:3000` | browser origin allowed to call the agent directly |
| `OPEN_METEO_BASE_URL` | `https://api.open-meteo.com/v1/forecast` | no-key live-weather context provider; server-side only |

**LLM provider chain**

| var | default | purpose |
|-----|---------|---------|
| `BOTHY_LLM_PROVIDERS` | `qwen-hf,venice,openrouter,openai,ollama` | provider priority order |
| `BOTHY_LLM_MAX_TOKENS` | `1500` | max output tokens |
| `BOTHY_LLM_TIMEOUT` | `25000` | generic per-provider request timeout (ms) |
| `QWEN_HF_URL` / `QWEN_HF_MODEL` | free HF endpoint / `Qwen/Qwen3.8-27B` | Qwen3.8-27B (no key) |
| `QWEN_REASONING` | `low` | thinking level `none\|low\|medium\|high\|xhigh` |
| `VENICE_API_KEY` | — | Venice AI inference key; server-only and never committed |
| `VENICE_BASE_URL` / `VENICE_MODEL` | `https://api.venice.ai/api/v1` / `venice-uncensored` | optional Venice OpenAI-compatible endpoint |
| `VENICE_TIMEOUT` / `VENICE_RPM` / `VENICE_BURST` | `60000` / `20` / `6` | optional Venice request budget overrides |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | — | OpenRouter free tier (optional) |
| `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` | — | any OpenAI-compatible endpoint (optional) |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | — | local Ollama (optional) |

The chain reports its configured providers via `GET /api/llm` and records each
provider attempt (and failure reason) in the assessment `toolTrace`.