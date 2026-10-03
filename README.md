# Bothy — Accountable programme-impact briefs

[MIT license](LICENSE) · [Product vision](docs/product-vision.md) ·
[Execution roadmap](docs/roadmap.md)

**For European defence-prime supply-chain teams:** investigate a material,
supplier, or transit disruption, trace programme exposure, and keep the evidence
with the decision.

The target workflow is exposure → cited brief → authorized review → owned
action → recorded outcome. **The current defence prototype explores graph
exposure and exports unapproved evidence snapshots.** It does not yet provide
authenticated review, a completed intervention loop, or continuous monitoring.
Dependencies are not proof of stoppage; query row limits are not total impact.

## Run the defence demo

Prerequisites: Node **22.13+** (or current Node 24), npm, Python + TuringDB,
and the graph pack described in [graphs/README.md](graphs/README.md).

```bash
npm install
cp .env.example .env
bash scripts/venue.sh        # TuringDB :6677 → sidecar :6777 → agent :8787 → web :3001
bash scripts/venue.sh status
```

Open **http://localhost:3001/defense?scenario=gallium-exposure**.
The defence route does not require the Postgres road catalogue. SQLite captures
graph runs and witness artifacts in `apps/agent/data/bothy-loop.db`.

1. Choose an exposure question and run the catalogue query.
2. Inspect query rows and source/coverage caveats.
3. Export a server-captured, explicitly unapproved evidence snapshot.
4. Open the share link or download its hash-linked JSON.
5. Advanced controls expose replay, comparison, and a temporary-marker branch
   demonstration. This is not a production-loss simulation.

Graph unavailable is an explicit failure state, not fabricated fallback data.
This remains a **single-operator prototype**: authenticated access, read/write
enforcement, and concurrent graph-state isolation are outstanding. Do not expose
it to sensitive customer data or treat public witness links as private sharing.
See [ops.md](docs/ops.md).

## Earlier winter-road / flood demos

These retain deterministic scoring, timestamped citations, and an illustrative
replay. They are not predictive validation. Live Open-Meteo context is frozen
and score-neutral; audio, radio, and social are not ingested.

```bash
bash scripts/db-tunnel.sh    # remote Postgres/PostGIS → localhost:5433
npm run seed                # writes the demo catalogue; inspect seed.ts and protect existing data first
npm run dev                 # agent :8787 · web :3000
```

Open `/watch?replay=1` or `/watch?case=flood`. A typed officer name is demo
attribution, not authenticated authority. Email queueing and sending require an
approved assessment; log-only mode never marks an email delivered. External
dispatch also requires `DIGEST_TOKEN`.

## EDTH and Nebius × NVIDIA

One product, two demonstrations:

- **EDTH / TuringDB:** exposure reasoning, native versioning, and inspectable
  evidence. [Track plan and historical weekend bright line](docs/hackathon-turingdb-defense.md).
- **Nebius × NVIDIA:** the same workflow with an actually exercised eligible
  NVIDIA model on Nebius. [Integration and submission gates](docs/hackathon-nebius-nvidia.md).

Nebius provider wiring is **opt-in**, server-only, and connected/cloud mode.
Set `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and a verified `NEBIUS_MODEL` in the
ignored runtime environment. All three are required; no model ID is guessed.
Configuration alone does not establish a successful live integration or
hackathon eligibility. No paid inference runs merely by opening `/defense`.

The earlier road agent uses Strands / OpenAI-compatible providers with a
deterministic scripted fallback. Its defence brief integration and bounded
Strands handoff are subsequent roadmap gates, not completed claims.

## Validate

```bash
npm test
npm run typecheck
npm run lint
npm -w @bothy/web run build
git diff --check
```

Tests cover witness provenance/request boundaries, approval-gated email,
pending-only decision updates, API envelope contracts, and opt-in provider
configuration without external email or inference.

## Repository

```text
apps/web        Next.js · defence workspace + earlier MapLibre road demos
apps/agent      Express · graph sidecar client · road agent · local SQLite artifacts
packages/shared shared domain/API types
scripts/        venue startup · witness QR sheet · DB bootstrap · secret scanning
docs/           vision · architecture · design · delivery gates · hackathon evidence
```

## Documentation and project steering

- [Product vision and review insights](docs/product-vision.md)
- [Roadmap](docs/roadmap.md) and [dated execution log](docs/execution-log.md)
- [Architecture](docs/architecture.md), [design](docs/design.md), [operations](docs/ops.md)
- [Pilot scope and acceptance](docs/pilot-one-pager.md)
- [Historical decision-replay concept](docs/dashboard.md) and [alignment](docs/alignment.md)

The Kiro Ready, Spec, Ship submission is complete. Committed
[`.kiro/steering/`](.kiro/steering/) preserves the product/evidence boundaries
and validation workflow. Keep secrets and private customer data out of the repo,
browser, public artifacts, and logs. Pre-commit runs lint-staged and a secret scan.
