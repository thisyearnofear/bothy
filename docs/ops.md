# Operations & security

How the demo is hosted, how to keep it secure, and how to run it on a
disk-constrained machine. Nothing here contains real credentials — you keep
those out of the repo in `.env` (never committed).

## Defence workspace and witness contract

Start the local stack with `bash scripts/venue.sh`, then open
`http://localhost:3001/defense?scenario=gallium-exposure`. This path does not
query the Postgres road catalogue. Node 22.13+ or Node 24 is required for
`node:sqlite`. Do not seed/reset databases for a graph rehearsal.
For an isolated local smoke, set `AGENT_HOST=127.0.0.1`, a spare `PORT`, and
`BOTHY_DATA_DIR` to a temporary directory. Point `DATABASE_URL` at a disposable
or unavailable local DB, never reset the user's ledger. Production containers
retain the default `0.0.0.0` API binding behind the proxy.

- `GET /api/graph/scenarios` returns `{ scenarios: [...] }`.
- `GET /api/graph/bench` returns `{ results: [...], totalMs }`.
- `POST /api/graph/scenario/:id/run` accepts an optional graph `commit` and
  persists a captured run in SQLite. Its response includes `runId`, graph,
  Cypher, query hash, capture time, result count, source boundary, and actual
  graph revision. HEAD is resolved and pinned by the sidecar before execution.
- `POST /api/graph/witness` accepts **only `{ runId }`**. Browser-authored rows,
  officer, scenario, or approval fields are rejected. Unknown runs return 404.
  The retained query result is exported without a 50-row evidence truncation.
- New witnesses use pack version 2 (query hash + actual pinned revision).
  Witness links survive agent restarts. Existing pre-version-1 packs remain
  readable but are labelled legacy/unverified provenance.
- `bash scripts/witness-qr.sh` follows run → captured `runId` → witness export.
  It creates local artifacts; it does not submit or publish anything.

Witnesses are **unapproved analysis**, not signed decisions. Hash linkage is
not authentication or immutable storage. Public demo links must not contain
buyer-sensitive data. Both agent and sidecar enforce the exact reviewed
`graph/read-policy.json` catalogue before executing Cypher. Each sidecar request
owns its client/graph/commit/change and closes the HTTP transport. The daemon must
be loopback HTTP. Separate `/change/*` endpoints are removed; the one reviewed
marker simulation cannot submit and requires a verified analyst/reviewer.
Restart an existing old sidecar explicitly to load the new implementation;
health refuses to report the old bridge as a safe available service.
Abandoned server-side change reclamation and coordination with administrative
writers remain open. CORS is not authorization or customer-data protection.

## OIDC and the defence verification journey

Configure all four `BOTHY_OIDC_*` variables in the ignored runtime environment:
HTTPS issuer, dedicated API access-token audience, HTTPS JWKS URL, and JSON
subject-to-role map (`analyst`, `reviewer`, `action-owner`). Role claims in the
token and browser-provided names/roles are ignored. `jose` verifies RS256/ES256,
issuer, audience, `sub`, `iat`, and `exp`; token age is limited to one hour.
Missing/invalid configuration returns 503 on protected operations. Bad tokens
return 401, unassigned/wrong-role subjects 403, conflicting transitions 409.

The agent side of this is a bearer API adapter. The browser login flow lives in
the web app as a backend-for-frontend: `app/api/auth/{login,callback,logout}`
performs authorization code + PKCE (S256) against your IdP, exchanges the code
server-side for an API access token, and stores that token in an encrypted
(HttpOnly, Secure, SameSite=Lax) `bt_sess` cookie keyed by
`BOTHY_SESSION_SECRET`. `app/api/defense/[...path]` reads the cookie and forwards
`Authorization: Bearer …` to the agent. Use a dedicated API audience, not the
browser application's ID-token audience. Do not paste tokens into this demo UI,
put them in localStorage, logs, commands, or public artifacts. No cookies are
accepted directly by the agent and no identity headers are trusted: the bridge
strips any browser-supplied `Authorization` header, and the agent never sees a
cookie.

Set `BOTHY_SSO_*` and `BOTHY_SESSION_SECRET` (see `.env.example`). This requires
a **confidential** OIDC client able to mint a token for the API audience; a
browser-only public/SPA registration usually cannot. Incomplete configuration
fails closed: `/api/auth/login` returns 503; there is no signature or role bypass.
A disposable local protocol rehearsal is available via `node scripts/demo-sso.mjs`.
Agent HTTP issuer/JWKS requires both `NODE_ENV=development` and explicit
`BOTHY_OIDC_ALLOW_LOCAL_DEMO=true` with loopback URLs; production stays HTTPS-only.
The provider has fixed synthetic accounts and ephemeral secrets, and must never
be exposed as real authentication. Optional `BOTHY_SSO_RESOURCE` supports RFC 8707.
See [local SSO runbook](demo-sso-rehearsal.md) for setup and verified results.
Rotate `BOTHY_SESSION_SECRET` to invalidate every live session.

`next.config.ts` excludes `/api/defense` and `/api/auth` from the `/api/:path*`
agent rewrite. This is load-bearing, not an optimisation: a bare array is an
`afterFiles` rewrite, which Next checks *before* dynamic routes, so the rewrite
would otherwise shadow the defence route handler and forward review traffic to
the agent with no token.

- `GET /api/defense/session`: configuration/verified-session state. Public on
  the agent (so an anonymous visitor can still tell "not configured" from "not
  signed in"); the bridge forwards a bearer only when a session cookie exists.
  Returns no token either way.
- `POST /api/defense/briefs`: only `{runId}`; public/synthetic deterministic
  draft, bound to complete evidence hash, graph revision, query hash, and
  `defense-brief-v1`. Legacy unpinned runs return 409. The agent permits anonymous
  synthetic drafting; a supplied bearer must verify, and its subject is recorded
  as creator. The browser bridge requires a session even for drafting.
- `GET /api/defense/briefs/:id`, `/evidence`, `/audit`: case access and a verified
  workspace role required; no-store responses. Creator analysts, assigned action
  owners, and reviewers of synthetic-demo records may read. Out-of-scope IDs
  return 404. Legacy records have no inferred creator and remain reviewer-accessible
  synthetic demos. Unknown scope fails closed. This is not customer tenancy.
  Saved brief URLs require SSO to reopen. Citations fetch stored, hash-checked
  evidence and validate run/revision/query/row/column identity, without rerunning
  the graph.
- `GET /api/defense/briefs/page/:offset`: up to 20 authorized case summaries and
  `nextOffset`; offset is a bounded nonnegative integer. Server filters by verified
  roles/subject using the same synthetic-demo case policy. No identity/filter query
  parameters are accepted. Creation-time/id ordering is deterministic, but pages
  may shift as records are added. Summary responses omit claims and outcome text.
- `GET /api/defense/briefs/page/:filter/:offset`: the same bounded collection
  with a finite `all`, `review`, `assignment`, or `work` view. Review selects pending
  records; assignment selects approved/unassigned records; both require reviewer
  authority. Work requires action-owner authority and selects only the verified
  caller's assigned/acknowledged work. Filters never widen case access.
- `POST /api/defense/briefs/:id/revisions`: authenticated, strict `{runId}` body;
  accessible analyst/reviewer only. Requires a separate pinned capture of the same
  scenario/graph/query and verifies parent evidence. Transactionally creates a
  new pending brief with a server-set `parentBriefId` and `revision_created` audit
  event. Parent state/evidence/audit are unchanged; no approval/action is inherited.
  Multiple branches may exist. Parent navigation remains access-checked.
- `GET /api/defense/owners`: reviewer-only configured action-owner subjects. This
  is not an identity-provider directory or display-name service. Assignment still
  revalidates eligibility on the server. The browser bridge allowlists both routes.
  Saved brief URLs open retained evidence independently of graph availability.
- `POST …/:id/review`: reviewer; only decision and optional note, pending-only.
- `POST …/:id/action`: reviewer; approved brief, configured owner subject and
  ISO `dueAt`; an assigned action cannot be overwritten.
- `POST …/:id/action/acknowledge`: only assigned owner; empty body.
- `POST …/:id/action/outcome`: only acknowledged owner; nonempty outcome.
- `POST …/:id/reassessment`: verified reviewer; strict `decision` (`accepted` or
  `further-verification`) and nonempty `note`. Requires approved brief, completed
  owner finding, unchanged evidence, and no prior reassessment. Decision and audit
  persist transactionally. The owner outcome is immutable. Completed findings
  without reassessment appear in the review queue. Further work is not assigned
  automatically; use a separately reviewed linked revision. Neither decision
  authorizes operational closure or asserts risk eliminated.

Bridge routes, served by the web app rather than the agent:

- `GET /api/auth/login`: 302 to the IdP with PKCE/state/nonce; **503** when SSO
  is not configured.
- `GET /api/auth/callback`: verifies state, exchanges the code, sets/clears the
  session cookie, then redirects to a same-origin relative `returnTo`. On any
  failure it clears both cookies and redirects to `/defense?authError=<code>`
  with a coarse code only — never an IdP response body.
- `GET|POST /api/auth/logout`: clears the session and transaction cookies.
- `/api/defense/*`: the allowlisted subset above; anything else returns 404.

Defence review/action + audit are one SQLite transaction, including rollback
when audit persistence fails. Outcome text is an owner assertion, not independently
verified operational impact. Approving a verification brief never sends an
email or authorizes a production intervention. Customer evidence privacy and
the legacy log-only digest wall are separate hardening gates.

## Approval and email rehearsal

Pending/rejected assessments do not enter the external notification queue.
Approval queues eligible subscribers, and the sender independently filters
legacy queued rows to approved assessments. Pending-only updates return 409
when a decision already exists. Decision + audit + queue are not yet a single
transaction; an outbox remains required. Road decisions now require a verified
OIDC reviewer and ignore any supplied actor name.

Without `RESEND_API_KEY`, the sender logs only a notification identifier, does
not disclose recipient/body, does not call Resend, and leaves rows queued.
Responses distinguish `sent`, `skipped`, and `logged`. With a sender key,
`DIGEST_TOKEN` is mandatory. Do not trigger real email during an implementation
smoke test.

## Nebius connected-mode configuration

Set server-only `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and `NEBIUS_MODEL` from the
current Nebius catalogue. Verify the model is an eligible NVIDIA open-source
model. All three values are required to configure the provider; priority is
controlled by `BOTHY_LLM_PROVIDERS`.

`/defense` performs no cloud inference. The provider remains wiring for the
next brief-generation slice. Cloud inference sends prompt/tool data outside
the local process and is not offline/DIL. Do not send buyer data or incur paid
calls without approval. Provider configuration tests use dummy values only.

## Where the databases lives

To avoid (a) installing gigabytes of local Postgres and (b) exposing a database,
the Bothy Postgres runs **on a small VPS over Docker**:

```
                    mac                          server (your ssh host alias)
 ┌─────────────────────────────┐    SSH tunnel    ┌──────────────────────────────┐
 │  scripts/db-tunnel.sh once  │ ───────────────▶ │  docker run postgis/postgis:16-3.5 │
 │  localhost:5433 ◀───────────┘    (localhost)    │  -p 127.0.0.1:15432:5432            │
 │  DAGENT reads DATABASE_URL                      │   (loopback only — not public!)     │
 └─────────────────────────────┘                  └──────────────────────────────┘
```

- Postgres runs on the **server's loopback (`127.0.0.1:15432`)** — it is *not*
  published on a public interface, so it can't be reached from the internet.
- Your machine reaches it **only** through an SSH tunnel (`scripts/db-tunnel.sh`),
  which maps `localhost:5433` → `server:15432`.
- Ports and host are overridable with env (`BOTHY_DB_HOST`,
  `BOTHY_DB_REMOTE_PORT`, `BOTHY_DB_LOCAL_PORT`) so nothing wire-specific is
  hard-coded.

### Bring it up

```bash
# 1. one SSH alias for the box (already configured in ~/.ssh/config)
# 2. start the PostGIS container once on the server (loopback only):
#    docker run -d --name bothy-db --restart unless-stopped \
#      -e POSTGRES_USER=bothy -e POSTGRES_PASSWORD=<strong-password> \
#      -e POSTGRES_DB=bothy -p 127.0.0.1:15432:5432 postgis/postgis:16-3.5

scripts/db-tunnel.sh      # idempotent; reuses an existing tunnel
cp .env.example .env      # then set DATABASE_URL + real creds
npm run seed              # agent loads repo-root .env automatically
npm run dev
```

The agent (`server` / `seed`) reads `.env` from the **repo root** on startup and does not override variables already set in the shell.

> `npm run seed` refreshes **catalogue** data (scenarios, routes, authored signals, risk snapshots). It keeps `assessments`, `audit_log`, `external_observations`, and operator road reports (`op-*`). Signed decisions survive a seed.

## Operator road ingest

The live desk can land a road report into the score (closure / disruption / report / plough-complete). Open-Meteo stays off the score.

```bash
curl -X POST http://localhost:8787/api/scenario/live/signals/road \
  -H 'content-type: application/json' \
  -d '{"routeId":"r-B5311","roadKind":"closure","headline":"Wasdale Head blocked by drifts","actor":"J. Smith"}'
```

Road approvals now require a verified OIDC reviewer; a typed actor name is
display-only attribution in the audit trail, not authority. Pending/rejected
assessments do not enter the external notification queue.

## Security checklist

- **`.env` is never committed.** It's in `.gitignore`, and the pre-commit hook
  (`scripts/check-secrets.sh`) refuses secret files and high-signal patterns in
  the staged diff. Widen patterns there, don't rely on defaults.
- **DB not on the public interface.** It binds to loopback only; access is via
  SSH keys, not an open port. Don't add `0.0.0.0`/Firewall exceptions for 5432.
- **Change the default DB password.** The demo password here is placeholder.
  Issue a dedicated Postgres user with the **least privileges** the app needs
  (`CREATE TABLE`/`DML` on `public` only), not superuser, and rotate it.
- **SSH keys, not passwords.** Use `~/.ssh/config` + an agent; the tunnel script
  runs non-interactively (`BatchMode=yes`).
- **LLM keys stay server-side.** `VENICE_API_KEY`, `OPENAI_API_KEY`,
  `OPENROUTER_API_KEY`, etc. live only in ignored `.env` files. Never paste a
  key into source, a committed template, a deployment variable, browser code, or a
  shell command saved in history. The agent's default chain needs zero keys
  (free Qwen endpoint) and always falls back to scripted.
- **Audit everything.** Every assessment, tool call, and duty-officer decision is
  written to the audit trail (`/api/scenario/:id/audit`) — use it.
- **Scan for leaks in CI.** Heavier heuristics via `gitleaks detect --source .`
  catches tokens the local grep hook might miss.

## Local (disk-heavy) alternative

`scripts/setup_db.sh` installs Postgres 17 + PostGIS + pgvector via Homebrew and
creates the DB locally. Use it only on machines with disk to spare; this repo's
default is the tunnel above.

## Troubleshooting

- `nc: command not found` — install `netcat`/`nc` (macOS ships it in newer
  Homebrew or via `brew install netcat`). The tunnel script just checks the port;
  you can also start the SSH tunnel manually.
- Tunnel up but agent can't connect: confirm `DATABASE_URL` uses the *local*
  port (`5433`) and the same credentials the container was created with.
- PostGIS missing on the server: the `postgis/postgis` image ships PostGIS already
  (`SELECT postgis_version();` to confirm); you do not need to install it.



## Live-weather rehearsal

The watch room reads only the most recently persisted Open-Meteo snapshot. Before
a demo, start the agent and perform one operator refresh; this records provider,
source URL, observation time, fetch time, and ingestion time in Postgres:

```bash
curl -X POST http://localhost:8787/api/scenario/live/live-weather/refresh
curl http://localhost:8787/api/scenario/live/live-weather
```

The second command must remain available if venue connectivity disappears. A full
provider failure returns `503` and retains the last good snapshot rather than
replacing it with fallback data. Acquisition mode is preserved on each persisted
route observation. The weather context is deliberately non-evidentiary: it never
changes seeded risk scores or backtest replay inputs. The watch room labels it
*not in the score*. `npm run seed` drops these
snapshots along with the other demo tables, so refresh again after a destructive
reset.



## Deploy to Fly.io (pay-as-you-go)

Fly.io runs real Docker containers with persistent volumes and does not sleep
like Render/Railway, but it has no free tier for new accounts (about $8/month
for the two always-on apps). The TuringDB graph service is not provisioned on
Fly yet. For a no-cost demo use "Demo on a plain VPS" below.

### Quick start

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Authenticate
fly auth login

# Create apps
cd /path/to/bothy
fly apps create bothy-agent --org personal
fly apps create bothy-web --org personal

# Set secrets (never committed)
fly secrets set DATABASE_URL="<your-postgres-url>" \
  WEB_ORIGIN="https://bothy.fly.dev" \
  PUBLIC_WEB_URL="https://bothy.fly.dev" \
  PORT=8787 \
  --app bothy-agent

fly secrets set AGENT_URL="http://bothy-agent.internal:8787" \
  PORT=8080 \
  --app bothy-web

# Deploy
cp fly/agent.toml fly.toml && fly deploy --app bothy-agent
cp fly/web.toml fly.toml && fly deploy --app bothy-web
```

Full guide: [`fly/DEPLOY.md`](fly/DEPLOY.md)

### Indicative cost

Two always-on shared-cpu-1x apps at 512 MB are roughly $7.4/month, plus
volumes ($0.15/GB) and egress ($0.02/GB in North America and Europe). See
fly.io/docs/about/pricing for current prices.

### Fly.io + Postgres

Use an existing managed Postgres with PostGIS (Neon, Supabase, etc.) or create one on Fly:

```bash
fly postgres create --name bothy-db --org personal
fly postgres attach --app bothy-agent --database-app bothy-db
```

## Deploy to Railway (paid, simpler)

Railway has managed Postgres and a simpler DX. Good if you want zero-config
hosting without Fly's volume setup.

```bash
npm install -g @railway/cli
railway login
railway init -p bothy-production
railway add -s agent --service apps/agent/railway.toml
railway add -s web --service apps/web/railway.toml
# Set DATABASE_URL, WEB_ORIGIN, PUBLIC_WEB_URL, AGENT_URL
railway up -s agent && railway up -s web
```

## Local Docker Compose (self-hosted)

For a quick local or self-hosted test:

```bash
cd deploy
cp .env.production.example .env.production
docker compose -f docker-compose.local.yml up -d --build
curl http://localhost:8787/api/health
open http://localhost:3001
```

## Existing VPS + Coolify/Traefik

See the "Public demo deployment" section below.

The public watch room formerly ran on an external web host; the agent runs as `bothy-agent` on the
VPS, where Coolify's existing Traefik proxy terminates TLS for
`https://api.bothy.trustfall.xyz`. The agent is attached to the proxy's external
`coolify` Docker network and has no host-published port. Traefik is the only
public path to it.

The agent container reaches the existing PostGIS container through the private
`bothy-internal` Docker network using the `bothy-db` hostname. Do not expose
Postgres publicly or replace the existing Coolify proxy with another listener.

### Deploy or update the agent

```bash
# On the VPS, from the checked-out repository root:
cp deploy/.env.production.example deploy/.env.production
# Set DATABASE_URL to the real password and WEB_ORIGIN to the final web URL.
docker compose -f deploy/docker-compose.vps.yml up -d --build
curl https://api.bothy.trustfall.xyz/api/health
```

`deploy/.env.production` is ignored by Git. For web builds, set the
server-only `AGENT_URL=https://api.bothy.trustfall.xyz` environment variable;
the existing Next rewrite then proxies browser `/api/*` requests to the agent.
After the agent is healthy, refresh an operator snapshot before rehearsal:

```bash
curl -X POST https://api.bothy.trustfall.xyz/api/scenario/live/live-weather/refresh
```


### Optional Venice AI provider

Venice runs as an external OpenAI-compatible inference provider. The VPS hosts
only the Bothy agent; it does not host Venice or expose the Venice key. First
revoke any key that has been pasted into a chat, issue a replacement in Venice,
and enter the replacement directly into the ignored VPS-local
`deploy/.env.production` with a protected editor or secret manager. Do not put
the key in Git, deployment environment variables, shell history, or a command pasted into a shared
terminal.

Set only these non-browser server variables on the VPS:

```dotenv
BOTHY_LLM_PROVIDERS=qwen-hf,venice,openrouter,openai,ollama
VENICE_API_KEY=<newly-rotated-key>
VENICE_BASE_URL=https://api.venice.ai/api/v1
VENICE_MODEL=venice-uncensored
VENICE_TIMEOUT=60000
```

Then recreate the private agent container and inspect only its configuration
summary (never the secret itself):

```bash
cd /home/linuxuser/bothy
docker compose -f deploy/docker-compose.vps.yml up -d --build
curl https://api.bothy.trustfall.xyz/api/health
curl https://api.bothy.trustfall.xyz/api/llm
```

`/api/llm` should list `venice` after restart. It confirms configuration, not
provider reachability; provider failures are traced during an LLM assessment
and fall through to the next provider and then to the deterministic scripted
brain.

## Demo on a plain VPS (Docker + Caddy)

`deploy/docker-compose.demo.yml` is a stand-alone stack for a fresh VPS: Caddy
(automatic HTTPS) -> web -> agent -> PostGIS. Only ports 80/443 are published.
It does not need Coolify/Traefik.

1. DNS: add an `A` record `bothy.trustfall.xyz` -> the VPS IPv4 address (DNS only,
   not proxied, if using Cloudflare). Wait until `dig +short bothy.trustfall.xyz` returns it.
2. On the VPS, clone the repo, then:

   ```bash
   cd deploy
   cp .env.production.example .env.production
   # edit: POSTGRES_PASSWORD, WEB_ORIGIN/PUBLIC_WEB_URL/PUBLIC_APP_URL=https://bothy.trustfall.xyz,
   # and any LLM keys. DATABASE_URL in this file is ignored (compose overrides it).
   docker compose -f docker-compose.demo.yml --env-file .env.production up -d --build
   docker compose -f docker-compose.demo.yml --env-file .env.production run --rm agent npm run seed
   curl https://bothy.trustfall.xyz/api/health
   ```

3. Update: re-sync the repo, then re-run the `up -d --build` command.

The stack includes a `graph` container (TuringDB daemon plus the loopback-only
read bridge, republished on the private compose network by socat). It reads the
prebuilt stores from the repo's `graphs/` directory, which is not in Git (see
`graphs/README.md`) and must be present on the VPS. Check it with
`curl https://bothy.trustfall.xyz/api/graph/health`.

The web image bakes the agent URL in at build time (Next rewrites), so changing
`AGENT_URL` requires a rebuild.

### Sign-in for testers (hosted demo identity provider)

The demo stack includes `idp` (`deploy/idp/`), the same synthetic
analyst/reviewer/owner accounts as `docs/demo-sso-rehearsal.md`, served at
`https://<domain>/idp`. It has no passwords, so Caddy puts `/idp/interaction/*`
(the account picker) behind an invite passphrase (HTTP basic auth, username
`tester`). Token, JWKS and authorize endpoints stay open for the redirect and
the server-side code exchange. Synthetic data only; never use it for real
identities.

Per-deployment secrets (never committed, both ignored by Git):

```bash
cd deploy
cp .env.sso.example .env.sso        # fill hostnames and generate secrets with openssl rand -hex 32
openssl rand -base64 18 | tr -d '=+/' > .invite-passphrase
echo "tester $(docker run --rm caddy:2 caddy hash-password --plaintext "$(cat .invite-passphrase)")" > invite.caddy
chmod 600 .env.sso .invite-passphrase invite.caddy
docker compose -f docker-compose.demo.yml --env-file .env.production up -d --build
```

Share the passphrase with testers out of band (`cat deploy/.invite-passphrase`
on the server). Rotate by regenerating `invite.caddy` and restarting `caddy`.
Verified end to end in production: reviewer sign-in, graph analysis, cited
brief, approval, owner assignment, owner sign-in, acknowledgment and recorded
outcome. Provider state is in memory (sessions reset when `idp` restarts); the
signing key persists in the `bothy-idp-data` volume.

When syncing the repo to the server, quote exclusions so the shell does not
expand them (`--exclude '.env*' --exclude invite.caddy --exclude .invite-passphrase`);
an unquoted `.env*` once deleted the server's `.env.production`.
