# Bothy architecture boundaries

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
