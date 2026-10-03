# Bothy — Accountable programme-impact briefs

[MIT license](LICENSE) · [Product vision](docs/product-vision.md) ·
[Execution roadmap](docs/roadmap.md)

**For European defence-prime supply-chain teams:** investigate a material,
supplier, or transit disruption, trace programme exposure, and keep the evidence
with the decision.

The target workflow is exposure → cited brief → authorized review → owned
action → recorded outcome. **The current defence prototype captures pinned
graph evidence and generates deterministic, row-cited verification briefs.**
The workspace includes a gallium exposure summary, clickable stored-evidence
citations, brief-first layout, and status-specific recovery. Saved-case access
is limited to creator analysts, assigned owners, and reviewers of the synthetic
demo collection. An access-scoped saved-case collection, configured-owner picker,
and stored-evidence reopening view are implemented. This is not customer tenancy
or an identity-provider directory. Review/assignment/current-owner work filters
and parent-linked, separately reviewed revisions are implemented.
The `/defense` front door is role-aware; investigation, saved-case, and guided
onboarding (`/defense?mode=onboarding`) modes are separate. Pilot onboarding agrees
the decision, evidence/access boundary, process rehearsal, and acceptance before
any private data transfer. Owner outcome recording is not reviewer acceptance or
operational case closure. Reviewer reassessment now accepts the verification finding
or requires further verification while preserving the original outcome; operational
closure remains unimplemented. See [domain workspaces](docs/domain-workspaces.md)
for the defence/flood split and [sample onboarding](docs/defence-prime-sample-onboarding.md)
for the guided team exercise.
A browser SSO session bridge (authorization code + PKCE, encrypted HttpOnly
cookie, server-side bearer forwarding) is implemented, but review and owned-action
APIs still fail closed until OIDC and SSO are configured. A real disposable local
OIDC provider has been browser-rehearsed through live graph capture, approval,
assignment, separate owner sign-in, acknowledgment and outcome. This validates
local protocol integration, not a buyer identity provider. See the
[local SSO runbook](docs/demo-sso-rehearsal.md). Continuous monitoring and
independent operational validation are still outstanding.
The separate `gallium-chain` scenario explains ten sampled synthetic dependency
rows with a bounded final material segment; intermediate material names are not
returned. Official USGS/EU context is linked separately from graph evidence.
Dependencies are not proof of stoppage; query row limits are not total impact.
A [six-slide HTML deck draft](docs/edth-deck.html) and live screenshots are available;
final PDF/video, team details and event contribution attribution remain pending.

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
2. Inspect the exposure summary and source/coverage caveats. Gallium results
   identify captured platform names, not full paths or programme identities.
3. Sign in to draft through the browser session bridge, then inspect citations
   against stored evidence. The agent's synthetic draft endpoint remains public;
   the browser bridge requires a session. Exported witnesses remain unapproved.
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

## Deploy

### Option A: your own VPS (Docker + Caddy), no extra cost

`deploy/docker-compose.demo.yml` runs Caddy (automatic HTTPS), the web app, the
agent, PostGIS and the TuringDB graph service on one host. Only ports 80/443
are published. This is what serves the live demo at `https://bothy.trustfall.xyz`.

```bash
# DNS: A record bothy.<your-domain> -> the VPS IPv4 address, then on the VPS:
cd deploy
cp .env.production.example .env.production   # set POSTGRES_PASSWORD, URLs, keys
docker compose -f docker-compose.demo.yml --env-file .env.production up -d --build
docker compose -f docker-compose.demo.yml --env-file .env.production run --rm agent npm run seed
curl https://bothy.<your-domain>/api/health
curl https://bothy.<your-domain>/api/graph/health
```

The `graphs/` stores (about 470 MB) are not in Git; see `graphs/README.md`.
Tester sign-in (invite-gated synthetic SSO) is described in `docs/ops.md`.
Details: "Demo on a plain VPS" in [`docs/ops.md`](docs/ops.md).

### Option B: Fly.io (pay-as-you-go, about $8/month for two always-on 512 MB apps)

Fly has no free tier for new accounts. The configs in `fly/` define two
always-on apps (`bothy-agent`, `bothy-web`) on shared-cpu-1x with 512 MB.
Not yet provisioned for Fly: the TuringDB graph service (so the gallium
investigation will report the analysis service as unavailable) and a database
(bring your own PostGIS URL).

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
fly apps create bothy-agent --org personal
fly apps create bothy-web --org personal
fly secrets set DATABASE_URL="<your-postgres-url>" \
  WEB_ORIGIN="https://bothy.fly.dev" PUBLIC_WEB_URL="https://bothy.fly.dev" \
  PORT=8787 --app bothy-agent
fly secrets set AGENT_URL="http://bothy-agent.internal:8787" PORT=8080 --app bothy-web
cp fly/agent.toml fly.toml && fly deploy --app bothy-agent
cp fly/web.toml fly.toml && fly deploy --app bothy-web
```

The web image bakes the agent URL into its Next rewrites at build time;
`fly/web.toml` passes it as a build argument. Full guide:
[`fly/DEPLOY.md`](fly/DEPLOY.md).

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
