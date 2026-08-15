# Operations & security

How the demo is hosted, how to keep it secure, and how to run it on a
disk-constrained machine. Nothing here contains real credentials — you keep
those out of the repo in `.env` (never committed).

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
npm run seed
npm run dev
```

> `npm run seed` is a destructive demo reset: it drops and recreates the
> application tables before loading the bundled scenarios. Do not run it against
> a database containing data you need to retain.

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
- **LLM keys stay local.** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `OPENROUTER_API_KEY`, etc. live only in `.env`. The agent's default chain
  needs zero keys (free Qwen endpoint) and always falls back to scripted.
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
changes seeded risk scores or backtest replay inputs. `npm run seed` drops these
snapshots along with the other demo tables, so refresh again after a destructive
reset.



## Public demo deployment

The public watch room runs on Netlify; the agent runs as `bothy-agent` on the
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
# Set DATABASE_URL to the real password and WEB_ORIGIN to the final Netlify URL.
docker compose -f deploy/docker-compose.vps.yml up -d --build
curl https://api.bothy.trustfall.xyz/api/health
```

`deploy/.env.production` is ignored by Git. For the Netlify build, set the
server-only `AGENT_URL=https://api.bothy.trustfall.xyz` environment variable;
the existing Next rewrite then proxies browser `/api/*` requests to the agent.
After the agent is healthy, refresh an operator snapshot before rehearsal:

```bash
curl -X POST https://api.bothy.trustfall.xyz/api/scenario/live/live-weather/refresh
```
