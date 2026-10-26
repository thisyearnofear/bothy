#!/usr/bin/env bash
# Federation lane: tunnel the VPS Zetaris UI proxy (and API) to localhost so
# the agent's reviewed Lightning SQL questions can run over SSH.
# Usage: bash scripts/federation.sh [up|down|status|push]
set -euo pipefail
HOST="${BOTHY_FED_HOST:-snapflip-vultr}"
UI_PORT="${BOTHY_FED_UI_PORT:-3000}"
API_PORT="${BOTHY_FED_API_PORT:-8888}"
CMD="${1:-status}"

case "$CMD" in
  up)
    ssh -fN -L "${UI_PORT}:localhost:3300" -L "${API_PORT}:localhost:8888" "$HOST"
    echo "tunnel up: localhost:${UI_PORT} -> ${HOST}:3300 (UI proxy), localhost:${API_PORT} -> ${HOST}:8888 (API)" ;;
  down)
    pkill -f "ssh -fN -L ${UI_PORT}:localhost:3300" && echo "tunnel down" || echo "no tunnel found" ;;
  push)
    # Ship the in-repo ops extract into the driver's shared customer-data
    # volume, then register it with data/federated/register.sql.
    scp "$(dirname "$0")/../data/federated/inventory-contracts.csv" "$HOST:/tmp/inventory-contracts.csv"
    ssh "$HOST" 'docker cp /tmp/inventory-contracts.csv zetaris-driver-1:/home/zetaris/customer-data/shared/inventory-contracts.csv'
    echo "pushed; register with the SQL in data/federated/register.sql" ;;
  status)
    if nc -z localhost "${UI_PORT}" 2>/dev/null; then
      echo "tunnel live on :${UI_PORT} (set ZETARIS_REST_URL=http://localhost:${UI_PORT})"
    else echo "no tunnel on :${UI_PORT} (run: bash scripts/federation.sh up)"; fi ;;
  *) echo "usage: bash scripts/federation.sh [up|down|status|push]" >&2; exit 2 ;;
esac
