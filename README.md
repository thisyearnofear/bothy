# Bothy — accountable programme-impact briefs

[MIT license](LICENSE) · [Product vision](docs/product-vision.md) ·
[Execution roadmap](docs/roadmap.md) · [Deployment design](docs/deployment-design.md)

**For a supply-chain analyst at a European defence prime:** investigate a
material, supplier, or transit disruption, inspect the returned platform and
dependency evidence — mapping it to specific programmes remains a verification
task, not an answered question — and keep the evidence and the responsible
person attached to the decision.

> Turn a supply-chain disruption into a review-ready, auditable impact brief,
> without losing the evidence or the owner of the next action.

The workflow is **exposure → version-pinned evidence → cited brief → authorized
review → owned action → recorded outcome**. A dependency is evidence of
exposure, not proof that a programme stops: inventory, substitutes, timing, and
missing relationships stay explicit, and a query's row limit is a sample rather
than a total blast radius.

## What the app is

Four services, one decision loop. The web app is the operator surface; the agent
generates deterministic cited briefs and owns the case state; a Python sidecar
exposes an allowlisted read path into an embedded, versioned graph.

| Surface | Route | What you do there |
|---|---|---|
| Briefing landing | `/` | The disruption, the countdown to the export-control deadline, a specimen brief, the workflow, and proof cases. Entry point for someone who has never seen the tool. |
| Defence workspace | `/defense` | The operational door. Four modes: default workspace (role-aware case list), `?mode=investigate` (graph run: captured dependency, coverage gaps, role-aware rail, public timeline and geographic context, cited brief and owner), `?mode=onboarding` (guided four-role exercise), `?brief=<id>` (a saved case). |
| Gallium experience | `/experience/gallium` | A cinematic vertical slice of the same evidence discipline: illustrated Scottish terrain and an authored bothy miniature on arrival, then the real `gallium-chain` capture rendered as an ordered field-book folio of selectable stage leaves, exact HTML evidence inspection, and verification/handoff. Not a live AI feed and not supplier geography; handoff still requires a configured session. |
| Guided story | `/defense/demo`, `/defense/stories`, `/defense/stories/[slug]` | Date-scrubbed narrated case files — gallium exposure and a Red Sea diversion — replayable and printable as a case file. |
| Stress lab | `/defense/lab` | Six scripted attempts to break the approval and audit rules: self-approval, replay, rewriting an audit entry. Shows the refusals, not just the happy path. |
| Pilot scope | `/pilot` | What a two-week pilot agrees up front: decision, evidence and access boundary, rehearsal, acceptance. Collects contact interest only. |
| Digest wall | `/digest` | Subscribe-and-notify loop for lane digests. |
| Witness pack | `/witness/[hash]` | A captured graph run, reopened by hash from a share link. |
| Earlier demos | `/watch`, `/case/[id]` | The winter-road and flood proof cases that preceded the defence work: deterministic scoring, timeline replay, MapLibre routes. Historical evidence that the pipeline generalizes, not a second product door. |

Session bridge: the browser talks only to Next.js. `/api/auth/*` performs
authorization-code + PKCE OIDC and keeps the session as an encrypted HttpOnly
cookie; `/api/defense/*` forwards a server-side `Authorization: Bearer` to the
agent through an allowlisted method/path/body filter. The agent never sees a
cookie, and there is no password system or token-paste UI. Everything else under
`/api/*` is rewritten straight to the agent.

Visual asset provenance: the `/experience/gallium` cinematic scene is lazily
loaded Three.js + GSAP, entirely separate from the MapLibre maps elsewhere in
the app, and optional — every phase has a complete static/semantic HTML
fallback. The bothy shelter is a user-provided asset registered in
`mint-assets.json`: the browser variant is
`apps/web/public/experience/mint/shelter/web.glb`, derived offline from the
source kept at `apps/web/assets/mint/shelter/original.glb` (inside the repo,
outside Next's `public/` asset directory). The backdrop terrain is a separate
locally built DEM mesh with 2× vertical exaggeration, source-attributed in
`apps/web/public/experience/terrain/terrain-source.json`. None of it is
supplier geography or measured operational data.

## Run the defence demo

Prerequisites: Node **22.13+** (or current Node 24), npm, Python + the TuringDB
SDK, and the graph pack described in [graphs/README.md](graphs/README.md) (about
470 MB, not in Git).

Use `npm ci --legacy-peer-deps`, as the Dockerfiles do; the existing
Express 4 versus `@strands-agents/sdk` peer mismatch can block a plain install.

```bash
npm ci --legacy-peer-deps
cp .env.example .env
bash scripts/venue.sh        # TuringDB :6677 → sidecar :6777 → agent :8787 → web :3001
bash scripts/venue.sh status # health of all four, colour-coded
```

Open **http://localhost:3001/defense?scenario=gallium-exposure**. The defence
route does not require the Postgres road catalogue; SQLite captures graph runs
and witness artifacts in `apps/agent/data/bothy-loop.db`.

1. Run a reviewed exposure question and inspect the summary with its
   source/coverage caveats. Gallium results identify captured platform names,
   not full paths or programme identities.
2. Sign in through the browser session bridge to draft, then open a citation and
   watch it resolve against the stored evidence row.
3. With configured OIDC, a reviewer approves or requests further verification,
   assigns a configured owner, that owner acknowledges and records an outcome,
   and each state transition and its audit append commit atomically in SQLite.
4. Advanced controls expose pinned replay and version comparison. The temporary
   branch simulation requires an analyst or reviewer and cannot submit changes.

`bash scripts/refusal-demo.sh` exercises the authority boundaries against a
running agent and prints what it observed — see
[docs/proof-no-self-approval.md](docs/proof-no-self-approval.md).

## What is real, what is gated, what is missing

This project's credibility rests on this table being accurate. When you change a
claim, change it here.

**Built and verified.** Role-aware workspace, saved cases with access scoping,
deterministic row-cited briefs bound to a pinned graph revision and query hash,
review/assignment/acknowledgment/outcome transitions with transactional audit,
reviewer reassessment that preserves the original finding, linked revisions that
never inherit approval, an exact reviewed-read allowlist (arbitrary Cypher and
writes refused), evidence-tamper detection, and the browser session bridge. The
full authorized journey has been rehearsed through a real disposable OIDC
provider, and the hosted demo runs a synthetic provider end to end.

**Implemented but needs configuration.** Review and owned-action APIs **fail
closed** until OIDC is configured: absent, partial, or malformed configuration
disables them rather than falling back to anything permissive. Roles come from a
server-side subject allowlist, never from token claims, so a caller cannot
self-grant `reviewer`. Nebius/NVIDIA inference is opt-in, server-only, connected
mode; no model ID is guessed and no paid inference runs by opening a page.

**Not built, not certified.** Operational case closure and risk elimination.
Background monitoring. Customer tenancy (the access policy is scoped to a
synthetic demo collection). Independent operational validation. Offline / DIL
end-to-end operation. Artefact signing, bundle, and rollback for air-gapped
delivery. A real buyer identity provider. Clean-clone graph setup.
Export-control review.

**Known gap worth naming.** `GET /api/subscriptions` has no error handling, and
with `DATABASE_URL` unreachable the rejected promise terminates the agent
process — which is the normal state for the defence demo, since it does not need
Postgres. Details and the proposed fix are in
[docs/deployment-design.md](docs/deployment-design.md) (G1).

Earlier winter-road and flood demos retain deterministic scoring, timestamped
citations, and an illustrative replay. They are not predictive validation. Live
Open-Meteo context is frozen and score-neutral; audio, radio, and social are not
ingested. Graph-unavailable is an explicit failure state, never a fabricated
fallback.

## Architecture

```
Browser ── Next.js :3001 ──┬── /api/defense/*, /api/auth/*  (session bridge)
                           └── /api/*  (rewrite)
                                    │
                            Express agent :8787
                            ├─ deterministic cited briefs + case state (SQLite)
                            ├─ reviewed-read allowlist
                            └─ Python graph sidecar :6777 → TuringDB :6677
                                                        (versioned supply-chain graph)
```

The older road/flood path additionally uses Postgres + PostGIS for the road
catalogue; the defence path does not. The two are not yet one fused decision loop.
Full detail: [docs/architecture.md](docs/architecture.md).

## Repository

```text
apps/web        Next.js · defence workspace, stories, lab, landing · session bridge · earlier road/flood demos
apps/agent      Express · brief generation and case state · graph sidecar client · road agent · SQLite artifacts
packages/shared shared domain/API types
bench/          measurement instruments (see docs/baseline-measurement.md)
scripts/        venue startup · SSO rehearsal · refusal probe · witness QR · DB bootstrap · secret scan
docs/           vision · architecture · design · deployment · proof · pilot scope · hackathon evidence
graphs/         runtime graph stores (not in Git)
deploy/ fly/    VPS + Caddy compose, and Fly.io configs
assets/         submission screenshots and demo video
```

## Earlier winter-road / flood demos

```bash
bash scripts/db-tunnel.sh    # remote Postgres/PostGIS → localhost:5433
npm run seed                # writes the demo catalogue; inspect seed.ts and protect existing data first
npm run dev                 # agent :8787 · web :3000
```

Open `/watch?replay=1` or `/watch?case=flood`. Decisions require a verified OIDC
reviewer; typed names cannot grant approval. Email queueing and sending require an
approved assessment, and log-only mode never marks an email delivered. External
dispatch also requires `DIGEST_TOKEN`.

## Validate

```bash
npm test
npm -w @bothy/agent run test:graph  # requires the installed TuringDB Python SDK
npm run typecheck
npm run lint
npm -w @bothy/web run build
git diff --check
```

Tests cover OIDC signature/role failures, atomic review and audit, cited
brief/action transitions, evidence tampering, concurrent sidecar state, read-only
enforcement, witness provenance, email gates, API contracts, and opt-in provider
configuration. The web suite additionally covers the session bridge: fail-closed
SSO configuration, PKCE, encrypted-cookie tamper and wrong-key rejection, the
path and body allowlist, CSRF origin checks, upstream status passthrough, and a
full brief → review → assign → acknowledge → outcome journey driven through the
real agent router. No external email or inference is required.

Current measured counts on this worktree: **150 web + 32 agent TypeScript tests
passing** (182 total), measured at `6deefe4`, plus 6 Python sidecar boundary
tests (mocked, not live-query proof). `9bf591a` recorded 103/32.

Security snapshot (4 October 2026): `npm audit --omit=dev` reports **0**
production-dependency findings in this lock and in the deployed agent
container. The full `npm audit` reports 7 remaining findings (2 moderate, 5
high), all in dev-classified dependencies — with the caveat that the agent
image installs dev dependencies and runs production via `tsx`, so do not read
that as proof those packages are absent from the deployed filesystem, and this
is not a runtime/OS/vulnerability certification. Current pinned versions:
Next 16.3.6, Sharp 0.35.5, MapLibre 6.4.1, with root `overrides` pinning
fast-uri 3.1.8, ip-address 10.7.2 and qs 6.16.0.

Verified by focused desktop QA (same date): `/watch` and
`/defense?mode=investigate` render the base OSM map under MapLibre 6 — worker
and shared modules served 200, console clean. Graph-dependent corridor overlays
and mobile 3D were not verified in that pass; production browser QA remains an
operator task.

The 6 sidecar tests pass when discovery runs directly
(`cd apps/agent && python3 -m unittest discover -s src/graph -p 'test_*.py'`).
`npm -w @bothy/agent run test:graph` fails on this machine before any assertion:
the npm lifecycle shell starts the universal `python3.14` as x86_64 and numpy's
extension is arm64-only, so `import numpy` aborts the run. That is a local Python
install issue, not a sidecar result — do not report it as a failing test.

## Documentation

| Read | For |
|---|---|
| [product-vision.md](docs/product-vision.md) | buyer, recurring decision, trust contract, pilot scope |
| [roadmap.md](docs/roadmap.md) · [execution-log.md](docs/execution-log.md) | delivery gates and the dated work record |
| [architecture.md](docs/architecture.md) · [design.md](docs/design.md) | how it is built and how it looks |
| [deployment-design.md](docs/deployment-design.md) | running it in a customer environment, gap register, certification checklist |
| [proof-no-self-approval.md](docs/proof-no-self-approval.md) | three layers of evidence that the agent cannot approve its own conclusion |
| [graph-data-coverage.md](docs/graph-data-coverage.md) | what the graph actually contains, and which demos return rows |
| [baseline-measurement.md](docs/baseline-measurement.md) | hand-trace versus query: instrument, protocol, results |
| [domain-workspaces.md](docs/domain-workspaces.md) | the defence/flood split and shared case model |
| [ops.md](docs/ops.md) | hosting, sign-in for testers, troubleshooting |
| [pilot-one-pager.md](docs/pilot-one-pager.md) · [defence-prime-sample-onboarding.md](docs/defence-prime-sample-onboarding.md) | pilot scope and the guided team exercise |
| [hackathon-turingdb-defense.md](docs/hackathon-turingdb-defense.md) · [hackathon-nebius-nvidia.md](docs/hackathon-nebius-nvidia.md) · [edth-submission-pack.md](docs/edth-submission-pack.md) | track alignment and submission evidence |

Keep secrets and private customer data out of the repo, browser, public
artifacts, and logs. Pre-commit runs lint-staged and a secret scan.
