#!/usr/bin/env bash
# Self-hosted model lane: tunnel the VPS Ollama fleet (Nemotron) to localhost.
# Usage: bash scripts/model.sh [up|down|status]
set -euo pipefail
HOST="${BOTHY_MODEL_HOST:-snapflip-vultr}"
PORT="${BOTHY_MODEL_PORT:-11434}"
CMD="${1:-status}"

case "$CMD" in
  up)
    ssh -fN -L "${PORT}:localhost:11434" "$HOST"
    echo "tunnel up: localhost:${PORT} -> ${HOST}:11434" ;;
  down)
    pkill -f "ssh -fN -L ${PORT}:localhost:11434 $HOST" && echo "tunnel down" || echo "no tunnel found" ;;
  status)
    if curl -s -m 3 "http://localhost:${PORT}/api/tags" >/dev/null; then
      echo "tunnel live on :${PORT}"; curl -s "http://localhost:${PORT}/api/tags" | python3 -c 'import json,sys; print("models:", ", ".join(m["name"] for m in json.load(sys.stdin)["models"]))'
    else echo "no tunnel on :${PORT} (run: bash scripts/model.sh up)"; fi ;;
  *) echo "usage: bash scripts/model.sh [up|down|status]" >&2; exit 2 ;;
esac
