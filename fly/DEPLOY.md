# Fly.io Deployment Guide

Fly.io bills per second with no free tier for new accounts; two always-on shared-cpu-1x apps at 512 MB cost roughly $8/month plus volume and egress. Bothy runs as two apps with internal networking, so no reverse proxy is needed. The TuringDB graph service is not provisioned on Fly yet, so the gallium investigation needs it added (see `deploy/graph/` for the container recipe). For a no-cost demo use the VPS stack in the README.

## Prerequisites

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Authenticate
fly auth login
```

## 1. Create the apps

```bash
cd /Users/udingethe/Dev/bothy

# Create the agent app
fly apps create bothy-agent --org personal
fly secrets set \
  DATABASE_URL="postgres://user:pass@your-pg.host.cloud.zdb.io/dbname" \
  WEB_ORIGIN="https://bothy.fly.dev" \
  PUBLIC_WEB_URL="https://bothy.fly.dev" \
  PORT=8787 \
  --app bothy-agent

# Copy the agent config and deploy
cp fly/agent.toml fly.toml
fly deploy --app bothy-agent

# Create the web app
fly apps create bothy-web --org personal
fly secrets set \
  AGENT_URL="http://bothy-agent.internal:8787" \
  PORT=8080 \
  --app bothy-web

# Copy the web config and deploy
cp fly/web.toml fly.toml
fly deploy --app bothy-web
```

## 2. Set up the internal network (private networking)

```bash
# Allocate a private IP for the agent (for web → agent calls)
fly ips allocate-v4 --app bothy-agent
fly ips allocate-v6 --app bothy-agent

# The web app uses the internal .internal DNS to reach the agent
# No public port exposure needed for agent
```

## 3. Add Postgres

```bash
# Use an existing managed Postgres or create one on Fly.io
fly postgres create --name bothy-db --org personal

# Connect to the agent
fly postgres attach --app bothy-agent --database-app bothy-db
```

Or connect to an existing managed Postgres with PostGIS (for example Neon or Supabase):

```bash
fly secrets set \
  DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/bothy?sslmode=require" \
  --app bothy-agent
```

## 4. Set secrets securely

```bash
# Never commit these — use fly secrets
fly secrets set \
  NEBIUS_API_KEY="sk-..." \
  BOTHY_OIDC_ISSUER="https://your-issuer.com" \
  BOTHY_OIDC_AUDIENCE="bothy" \
  BOTHY_OIDC_JWKS_URL="https://your-issuer.com/.well-known/jwks.json" \
  --app bothy-agent
```

## 5. Deploy

```bash
# Agent
cp fly/agent.toml fly.toml
fly deploy --app bothy-agent

# Web
cp fly/web.toml fly.toml
fly deploy --app bothy-web
```

## 6. Custom domain (optional)

```bash
fly certs create your-domain.com --app bothy-web
fly certs create api.your-domain.com --app bothy-agent
```

## Indicative cost (check fly.io/docs/about/pricing)

| Item | Approx. per month |
|------|-------------------|
| 2 x shared-cpu-1x, 512 MB, always on | $7.4 |
| Volume (`agent_data`), per GB | $0.15 |
| Egress (North America / Europe), per GB | $0.02 |
| Dedicated IPv4 (optional), per app | $2.00 |

## Monitoring

```bash
# View logs
fly logs --app bothy-agent
fly logs --app bothy-web

# Check status
fly status --app bothy-agent
fly status --app bothy-web

# SSH into machine
fly ssh console --app bothy-agent
```

## Troubleshooting

- **Agent can't reach Postgres**: Check `DATABASE_URL` is set as a secret on the agent app, not as an env var in `fly.toml` (secrets are injected at runtime)
- **Web can't reach agent**: Use `http://bothy-agent.internal:8787` — the `.internal` DNS resolves within Fly.io's private network
- **Build fails**: Ensure Docker is running and `fly.toml` is in the project root before deploy
- **Out of memory**: Reduce `memory` in `fly.toml` or optimize the agent's TuringDB graph loading

## Local Fly.io simulation

Test the Docker setup locally:

```bash
cd /Users/udingethe/Dev/bothy
docker build -f apps/agent/Dockerfile -t bothy-agent .
docker build -f apps/web/Dockerfile -t bothy-web .

docker run --rm -p 8787:8787 \
  -e DATABASE_URL="postgresql://..." \
  -e WEB_ORIGIN="http://localhost:3000" \
  bothy-agent

docker run --rm -p 3000:8080 \
  -e AGENT_URL="http://localhost:8787" \
  bothy-web
```
