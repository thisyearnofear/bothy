# Bothy — Accountable programme-impact briefs

[MIT license](LICENSE) · [Product vision](docs/product-vision.md) ·
[Execution roadmap](docs/roadmap.md)

**For European defence-prime supply-chain teams:** investigate a material,
supplier, or transit disruption, trace programme exposure, and keep the evidence
with the decision.

The target workflow is exposure → cited brief → authorized review → owned
action → recorded outcome. **The current defence prototype captures pinned
graph evidence and generates deterministic, row-cited verification briefs.**
A browser SSO session bridge (authorization code + PKCE, encrypted HttpOnly
cookie, server-side bearer forwarding) is implemented, but review and owned-action
APIs still fail closed until OIDC and SSO are configured, and the bridge has not
been exercised against a real identity provider. Continuous monitoring and
independent operational validation are still outstanding.
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
3. Export an unapproved witness or draft a cited verification brief.
4. With configured OIDC **and** a confidential OIDC client able to mint a
   token for the API audience, sign in, review the brief, assign a configured
   action owner, acknowledge it, and record an outcome.
5. Advanced controls expose pinned replay/comparison. The temporary-marker
   simulation requires an analyst/reviewer and cannot submit changes.

Graph unavailable is an explicit failure state, not fabricated fallback data.
Reads use fresh per-request clients and an exact reviewed query allowlist.
Only public/synthetic evidence is appropriate: public witness links are not
private sharing, recorded outcomes are not proof of effectiveness, and abandoned
daemon changes still need a reclamation policy.
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

Open `/watch?replay=1` or `/watch?case=flood`. Decisions now require a verified
OIDC reviewer; typed names cannot grant approval. Email queueing and sending require an
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

## Deploy (Fly.io — free tier, recommended)

Fly.io runs real Docker on 3 shared VMs, has persistent volumes, and doesn't sleep
like Render/Railway free tiers. Bothy uses internal networking over Fly's private
network — no reverse proxy needed.

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh
fly auth login

# Create apps
fly apps create bothy-agent --org personal
fly apps create bothy-web --org personal

# Set secrets (never committed)
fly secrets set DATABASE_URL="<your-postgres-url>" \
  WEB_ORIGIN="https://bothy.fly.dev" \
  PUBLIC_WEB_URL="https://bothy.fly.dev" \
  PORT=8787 --app bothy-agent

fly secrets set AGENT_URL="http://bothy-agent.internal:8787" \
  PORT=8080 --app bothy-web

# Deploy
cp fly/agent.toml fly.toml && fly deploy --app bothy-agent
cp fly/web.toml fly.toml && fly deploy --app bothy-web
```

Full guide: [`fly/DEPLOY.md`](fly/DEPLOY.md).

Free tier: 3 shared VMs, 512MB RAM/VM, 160GB bandwidth/month, 3GB volumes.

## Validate

```bash
npm test
npm -w @bothy/agent run test:graph  # requires the installed TuringDB Python SDK
npm run typecheck
npm run lint
npm -w @bothy/web run build
git diff --check
```

Tests cover OIDC signature/role failures, atomic review/audit, cited brief/action
transitions, evidence tampering, concurrent sidecar state, read-only enforcement,
witness provenance, email gates, API contracts, and opt-in provider
configuration. The web suite additionally covers the session bridge: fail-closed
SSO config, PKCE, encrypted-cookie tamper/wrong-key rejection, the path and body
allowlist, CSRF origin checks, upstream status passthrough, and a full
brief → review → assign → acknowledge → outcome journey driven through the real
agent router. No external email or inference is required.

## Repository

```text
apps/web        Next.js · defence workspace · SSO session bridge + earlier MapLibre road demos
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
