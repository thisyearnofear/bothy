# Bothy engineering workflow

## Before editing

- Read the relevant source and its nearest documentation before changing behavior.
- Preserve existing uncommitted work. Inspect `git status --short` and avoid staging, committing, or pushing unless explicitly asked.
- Use TypeScript and existing patterns; avoid introducing packages unless the feature genuinely requires one. Pin any added dependency version.

## Local operation

- macOS shell: `/bin/zsh`; workspace root: `/Users/udingethe/Dev/bothy`.
- Agent API: `npm run dev:agent` (port 8787). Web: `npm run dev:web` (port 3000).
- The default database uses an SSH tunnel on `localhost:5433`; start it with `bash scripts/db-tunnel.sh` if needed.
- `npm run seed` is destructive: it drops and recreates application tables. State that impact before running it and only use it when a reset/schema bootstrap is actually required.
- For a demo rehearsal, persist weather with `POST /api/scenario/live/live-weather/refresh` before opening the watch room.

## Required validation after behavior changes

1. Run targeted API/runtime smoke checks for the changed path.
2. Run `npm run typecheck` and `npm run lint`.
3. For web changes, run `npm -w @bothy/web run build` and smoke-test `/watch` plus its proxied API path.
4. Run `git diff --check` before handing over.
5. Report what was verified, what was not verified, and any expected warnings (the current Next build may warn about ESLint plugin detection while still succeeding).

## Delivery quality

- Update `docs/architecture.md` and `docs/ops.md` when runtime topology, API contracts, provenance, or rehearsal steps change.
- Favor a compact, rehearsable demo over speculative integrations.
- Keep empty-state and failure behavior explicit: a missing snapshot should invite operator refresh, while backtests remain frozen.
