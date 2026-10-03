# Bothy architecture boundaries

## Defence-first additions

- `/defense` must load independently of the road/Postgres catalogue.
- Graph catalogue API contracts and witness/run types live in `packages/shared`.
- A witness references a server-captured `runId`; reject browser-authored rows,
  approval, and officer claims. Label artifacts unapproved and disclose an
  unpinned HEAD rather than claiming reproducibility.
- Only approved road assessments enter the external email queue/sender.
- Nebius is opt-in connected cloud inference, never an offline claim.
- Graph reads use request-isolated clients, exact query allowlists, and concrete
  revision pinning. Never restore public submit/change lifecycle endpoints.
- OIDC API review fails closed without configured issuer/audience/JWKS/subject
  roles. Derive identity from verified access tokens, never names or body roles.
- Defence review/action + audit is transactional in SQLite; preserve the
  pending → approved/rejected and assigned → acknowledged → completed gates.
- Customer-data privacy, browser SSO/session integration, road outbox,
  abandoned-change reclamation, and live model-version binding remain gates.

## Repository map

- `apps/web`: Next.js watch-room UI. Browser calls `/api/*` through the Next rewrite; keep provider keys and direct third-party fetches out of the browser.
- `apps/agent`: Express API, narrow agent tools, scripted/LLM execution, persistence, seed data, and deterministic risk engine.
- `packages/shared/src`: shared API/domain types. Update shared types when an API response is consumed by both applications.
- `docs/`: architecture, operating procedure, replay/evidence boundaries, design, and hackathon alignment.

## Risk and provenance

- `apps/agent/src/engine/risk.ts` is deterministic and derives scores only from seeded `signal_events` and `incidents` at or before the scenario horizon.
- `risk_snapshots` power replay. Do not mutate them in response to live context.
- Persist externally fetched context in `external_observations`, never in `signal_events`.
- `GET /api/scenario/live/live-weather` is database-only; `POST /api/scenario/live/live-weather/refresh` is the operator-triggered ingestion path.
- Live weather endpoints must return `409` for backtests.
- Intake is typed reports (`warning | forecast | road | incident`), not raw media. Do not add audio, radio, news crawlers, or social firehoses that skip the citation ledger. News on the A66 case is a sourced outcome beyond the hatch, not a live scrape.

## Agent rules

- Maintain narrow, auditable tools. `create_human_review` is the only assessment write/exit path.
- Tool traces are part of the explainability surface; write concise, factual summaries with provenance and boundaries.
- Read-only snapshot context may appear in the live trace only when explicitly described as non-evidentiary and score-neutral.
- If changing the tool contract, update `apps/agent/src/agent/tools.ts`, scripted flow, LLM tool definitions where applicable, shared types, and architecture docs together.

## API and UI conventions

- Validate the scenario exists before route, risk, or assessment work.
- Return clear `404` responses for unavailable data and `409` for an intentionally prohibited replay boundary.
- Keep the watch room usable when optional live context is absent, stale, or provider refresh fails.
- Never expose `.env` values, database URLs, provider keys, or operational secrets to client code or documentation.
