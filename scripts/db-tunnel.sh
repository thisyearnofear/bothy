#!/usr/bin/env bash
# Tunnel the remote Bothy Postgres to localhost for local dev. Idempotent.
#
# Configurable via env so nothing sensitive lives in the repo:
#   BOTHY_DB_HOST          ssh host alias (configure once in ~/.ssh/config)
#   BOTHY_DB_REMOTE_PORT   Postgres port on the server (bound to 127.0.0.1 there)
#   BOTHY_DB_LOCAL_PORT    local port this tunnel listens on (matches .env)
#
# Security: the DB is never published publicly - it only listens on the
# server's loopback (127.0.0.1) and is reached via this tunnel. Auth is your
# SSH keys (BatchMode = non-interactive, agent/keyfile only).
set -euo pipefail

HOST="${BOTHY_DB_HOST:-nuncio-vultr}"
REMOTE="${BOTHY_DB_REMOTE_PORT:-15432}"
LOCAL="${BOTHY_DB_LOCAL_PORT:-5433}"

if nc -z localhost "$LOCAL" 2>/dev/null; then
  echo "tunnel already up on :$LOCAL"
  exit 0
fi

ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -N -f \
  -L "$LOCAL:127.0.0.1:$REMOTE" "$HOST"
echo "tunnel up: localhost:$LOCAL -> $HOST:$REMOTE (bothy DB)"