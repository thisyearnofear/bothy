# Deployment design: running Bothy in someone else's environment

Date: 2026-10-04
POC: Bothy team lead
Status: **design + current-state record.** Nothing here is a certification. The
certification checklist at the end is the honest boundary: it lists what must be
true before "runs in your environment, offline, restricted data" can be claimed.

TL;DR: A defence prime cannot send restricted bill-of-materials data to a cloud,
so the local-reasoning path is the product, not a fallback. This document states
the three deployment modes, what data exists in each, how identity is federated to
the customer's own provider, how the system is updated without a network
round-trip, and exactly which claims are currently unproven.

## Why this document exists

Judged on a defence-logistics wedge, "not certified offline" reads as a gap unless
there is a concrete answer next to it. The pieces were already scattered across
`docs/ops.md`, `docs/architecture.md`, `docs/demo-sso-rehearsal.md`,
`docs/pilot-one-pager.md` and `docs/hackathon-turingdb-defense.md`. Consolidating
them is the difference between an apology and a plan.

## The requirement, stated plainly

A prime's programme or supply-chain resilience lead has data they are not permitted
to put in a multi-tenant cloud: real BOMs, real supplier contracts, real programme
identities. Everything about Bothy's design follows from that constraint:

- The graph engine is **embedded** (`turingdb start`), not a service to rent.
- Reasoning is **local**: reads go to a loopback sidecar, not an API vendor.
- The brief generator is **deterministic**, so no inference provider is on the
  critical path for the demo journey.
- Case records are **SQLite files** beside the agent, so "delete the deployment"
  means deleting a directory.

The consequence worth saying out loud: the connected-mode pieces (cloud LLM
providers, live weather, map tiles, hosted email) are conveniences for the public
demo, not the architecture. Removing them removes nothing from the core loop.

## Three deployment modes

| | A. Analyst laptop | B. Hosted public demo (current) | C. Customer enclave (target) |
|---|---|---|---|
| Where | single machine | one VPS, Caddy TLS | customer network, no egress |
| Data | synthetic/public pack | synthetic/public pack | restricted customer BOM |
| Identity | disposable local `oidc-provider` | bundled synthetic `idp` | customer IdP via OIDC |
| Graph | local TuringDB :6677 | `graph` container | local, pinned store |
| Postgres | not required for `/defense` | Neon (external) | customer-managed or absent |
| Inference | scripted/deterministic | opt-in cloud (off by default) | local or none |
| Status | runs today | runs today at `bothy.trustfall.xyz` | **not built, not certified** |

Mode A is the one that matters for the pitch. It is also the one already
rehearsed: `bash scripts/venue.sh` brings up four services with health gates, and
`docs/demo-sso-rehearsal.md` proves the authenticated journey on a single machine
with no cloud dependency.

## Components and data classes

| Component | Responsibility | Data it holds | Leaves the host? |
|---|---|---|---|
| `apps/web` (Next.js) | workspace UI, backend-for-frontend session bridge | encrypted HttpOnly session cookie; no evidence | no |
| `apps/agent` (Express) | brief generation, review/assignment transitions, audit | SQLite case records (`bothy-loop.db`) | no |
| graph sidecar (`sidecar.py`) | allowlisted reads, HEAD→revision pinning, capture | none persistent | no |
| TuringDB daemon | versioned graph store | the graph pack (~470 MB, not in Git) | no |
| IdP | identity | sessions, signing key | customer's own in mode C |
| Postgres/PostGIS | legacy road/flood catalogue only | demo road data | **see gap G1** |

The defence journey does not need Postgres. README states this, and it is the
single most useful fact for mode C: the optional legacy dependency is currently
also the least well isolated one (G1).

## Identity federation

The seam is four variables, and it is already the difference between modes A/B and
C:

```
BOTHY_OIDC_ISSUER       customer provider
BOTHY_OIDC_JWKS_URL     https only outside development
BOTHY_OIDC_AUDIENCE     the agent's API audience
BOTHY_OIDC_PRINCIPALS   subject → roles allowlist (JSON)
```

Properties that matter to a security reviewer, all enforced in
`apps/agent/src/auth.ts`:

- **Roles are server-side configuration, never token claims.** A subject with no
  entry in the principals map is refused (403) even with a validly signed token
  asserting `reviewer`. Self-granting authority is not possible by editing a claim.
- Only RS256/ES256; signature, issuer, audience, `exp`/`iat` and token age are all
  verified.
- Absent, partial, or malformed configuration **disables** review and simulation
  (503). There is no default-open path and no password system.
- The HTTP-issuer allowance requires `NODE_ENV=development` **and**
  `BOTHY_OIDC_ALLOW_LOCAL_DEMO=true` **and** a loopback hostname. Production is
  HTTPS-only.
- The agent receives a bearer token only. The browser's session cookie never
  reaches it.

Replacing the synthetic IdP with the customer's provider is a configuration
change, not a code change — **but that is a design claim, not a validated one.**
No buyer identity provider has been tested. The hosted demo's `idp` keeps provider
state in memory, so sessions reset on restart and the signing key lives in a
volume; a real deployment needs a durable provider, which is the customer's, not
ours.

## Update and integrity path (mode C design)

Target pattern, borrowed from standard air-gapped delivery rather than invented
here: bundle, verify, apply offline; never call home.

1. **Build** a versioned artefact bundle on the outside: container images pinned by
   digest, the graph store, a signed manifest, and a migration script.
2. **Transfer** by approved media. No ingress or egress required at any point.
3. **Verify** the manifest signature and image digests before applying. Refuse on
   mismatch.
4. **Apply** as an atomic switch of the pinned revision, keeping the previous
   bundle for rollback.
5. **Graph updates are commits.** A new pack arrives as a new revision, so an
   analyst can diff the previous and incoming graph state and see exactly what
   changed before anything is briefed on it. This is the one place where the
   air-gapped constraint and the versioned-data design reinforce each other.

Steps 1–2 are ordinary file transfer. Steps 3–5 are **not implemented**; there is
currently no signing of artefacts, no bundle format, and no rollback tooling. The
graph-commit property does exist.

## What is already proven

- Four-service local startup with health gates, detached processes, and warm
  graphs (`scripts/venue.sh`), including SQLite durability across a full agent
  restart.
- The complete authorized journey through a real OIDC provider on one machine:
  code+PKCE exchange, remote JWKS verification, live graph capture, reviewer
  approval, separate owner sign-in, acknowledgment, recorded outcome, persisted
  audit (`docs/demo-sso-rehearsal.md`).
- The same journey verified end to end **in production** on the hosted demo,
  behind an invite-passphrase-protected account picker (`docs/ops.md`, "Sign-in
  for testers").
- Fail-closed behaviour on every approval-capable surface, plus the structural
  fact that the agent has no approval tool at all
  (`docs/proof-no-self-approval.md`).
- Reviewed-read enforcement: exact query allowlist, arbitrary Cypher and writes
  refused before reaching the graph, HEAD resolved to a concrete pinned revision
  per capture.

## Known gaps

| id | gap | why it matters for deployment |
|---|---|---|
| **G1** | `GET /api/subscriptions` has no error handling; with `DATABASE_URL` unreachable the rejected promise terminates the Node process (`server.ts:614` → `repo.ts:245`) | an unauthenticated request kills the service the defence demo depends on. Found 4 October; see `docs/proof-no-self-approval.md`. Must fix before any enclave claim |
| **G2** | Full offline/DIL operation never certified end to end | the headline claim, unproven |
| **G3** | No customer tenancy; the case-access policy is scoped to a synthetic demo collection | mode C needs real isolation between programmes |
| **G4** | Sidecar is effectively single-client | concurrent analysts in one cell |
| **G5** | Abandoned simulation changes need a reclamation policy; no coordination with independent administrative graph writers | shared graph ownership |
| **G6** | Legacy Postgres decision + audit + queue is not transactional | only affects the road/flood path, but it is the same codebase |
| **G7** | Hosted `idp` keeps provider state in memory | fine for a demo, not for a customer |
| **G8** | Graph pack (~470 MB) is not in Git; clean-clone setup unrehearsed | a pilot cannot start from a bare clone today |
| **G9** | Export-control suitability of the pack's licensing unreviewed | CC-BY WRI data plus MIT/Apache synthetic; needs a human check |
| **G10** | Witness hash linkage is not an authenticated signature | per-role ed25519 signing would narrow this; see roadmap |

## Certification checklist

Claim "runs in your environment on restricted data" only when every line is
checked. Anything less, say which lines remain open.

- [ ] G1 fixed; a request to any legacy route cannot terminate the agent
- [ ] Clean-clone → running defence demo, rehearsed by someone other than the
      author, on a machine with no network access after install
- [ ] `/defense` journey completed with all egress blocked and no cloud
      credentials present, with the degraded surfaces reported honestly
- [ ] Customer IdP integration tested against a real provider (not synthetic
      accounts), including role mapping into the principals allowlist
- [ ] Tenancy model defined and tested: two programmes, neither can read the
      other's cases, evidence, or audit
- [ ] Artefact bundle format, signing, and digest verification implemented
- [ ] Rollback rehearsed from a previous bundle
- [ ] Graph-update diff demonstrated between two pack revisions
- [ ] Backup and restore of the SQLite case store proven (currently untested)
- [ ] Log and export hygiene: no evidence content or identity in logs
- [ ] Export-control and licensing review recorded, with a named reviewer
- [ ] Resource envelope measured: RAM, disk, cold-start and query latency on
      hardware resembling a deployed laptop, not a dev machine

## Claims this document deliberately does not make

No operational effectiveness, no buyer validation, no production readiness, no
zero-cost replication (the graph pack and the unmeasured resource envelope both
have costs), no prediction accuracy, and no certification of any kind. It is a
design and a gap register. That distinction is the point: an honest "not yet, here
is the path, and here is the part already proven" is worth more in a procurement
conversation than a claim that collapses under one question.
