#!/usr/bin/env bash
# Venue freeze: one command to bring the whole defense stack up, idempotent,
# with health gates. Brings up: TuringDB (:6677) -> sidecar (:6777) ->
# agent (:8787) -> web (:3001). Re-running is safe; already-up services are
# detected and left alone.
#
# Usage:  bash scripts/venue.sh            # start everything
#         bash scripts/venue.sh stop       # stop agent/sidecar (leaves TuringDB)
#         bash scripts/venue.sh status     # health of all four
#
# Notes:
#   - Durable loop state (witness chain, digests, pilot counter) lives in
#     apps/agent/data/bothy-loop.db (SQLite) and survives restarts.
#   - TuringDB graphs are 465MB under ./graphs (gitignored) — see graphs/README.md.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TURING_DIR="${TURING_DIR:-$ROOT}"
TURING_PORT="${TURING_PORT:-6677}"
UI_PORT="${UI_PORT:-8087}"
SIDECAR_PORT="${SIDECAR_PORT:-6777}"
AGENT_PORT="${AGENT_PORT:-8787}"
WEB_PORT="${WEB_PORT:-3001}"
export PATH="$HOME/.local/bin:$PATH"

# Detach into a fresh session: survives Ctrl-C, terminal close, and CJ/CI
# process-group kills. macOS has no `setsid`; scripts/daemonize.py does it.
daemon() { # logfile, cmd...
  python3 "$ROOT/scripts/daemonize.py" "$@" >/dev/null
}

ok()   { printf '  \033[32mok\033[0m   %s\n' "$1"; }
warn() { printf '  \033[33mwarn\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31mfail\033[0m %s\n' "$1"; }

probe() { # single clean code: "000" when unreachable (never append 000 to 000)
  local code
  code="$(curl -s -m 3 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true)"
  case "$code" in
    [1-5][0-9][0-9]) printf '%s' "$code" ;;
    *) printf '000' ;;
  esac
}

status() {
  echo "Bothy defense stack"
  [ "$(probe "http://127.0.0.1:$TURING_PORT/")" != "000" ] && ok "TuringDB   :$TURING_PORT" || bad "TuringDB   :$TURING_PORT"
  [ "$(probe "http://127.0.0.1:$SIDECAR_PORT/health")" = "200" ] && ok "sidecar    :$SIDECAR_PORT" || bad "sidecar    :$SIDECAR_PORT"
  [ "$(probe "http://127.0.0.1:$AGENT_PORT/api/health")" = "200" ] && ok "agent      :$AGENT_PORT" || bad "agent      :$AGENT_PORT"
  [ "$(probe "http://127.0.0.1:$WEB_PORT/watch")" != "000" ] && ok "web        :$WEB_PORT" || bad "web        :$WEB_PORT"
}

stop_all() {
  pkill -f 'tsx src/server.ts' 2>/dev/null && ok "stopped agent" || warn "agent not running"
  pkill -f 'graph/sidecar.py' 2>/dev/null && ok "stopped sidecar" || warn "sidecar not running"
  echo "  (TuringDB left running; use: turingdb stop -turing-dir $TURING_DIR)"
}

wait_for() { # url, label, tries
  local url="$1" label="$2" tries="${3:-20}"
  for _ in $(seq 1 "$tries"); do
    [ "$(probe "$url")" != "000" ] && return 0
    sleep 1
  done
  bad "$label did not come up ($url)"; return 1
}

start_all() {
  status; echo

  if ! command -v turingdb >/dev/null; then
    bad "turingdb not on PATH — run: uv tool install turingdb"; exit 1
  fi
  if [ ! -d "$TURING_DIR/graphs/supply_chain_deep" ]; then
    bad "graphs/supply_chain_deep missing — see graphs/README.md for the fetch steps"; exit 1
  fi

  if [ "$(probe "http://127.0.0.1:$TURING_PORT/")" = "000" ]; then
    echo "starting TuringDB (dir=$TURING_DIR)..."
    daemon /tmp/turing-venue.log turingdb start -turing-dir "$TURING_DIR" -p "$TURING_PORT" -ui -ui-port "$UI_PORT" -demon
    wait_for "http://127.0.0.1:$TURING_PORT/" "TuringDB" 30 || exit 1
    ok "TuringDB up (visualizer http://127.0.0.1:$UI_PORT)"
  else
    ok "TuringDB already up"
  fi

  if [ "$(probe "http://127.0.0.1:$SIDECAR_PORT/health")" != "200" ]; then
    echo "starting sidecar..."
    ( cd "$ROOT" && TURING_HOST="http://127.0.0.1:$TURING_PORT" PORT="$SIDECAR_PORT" \
      daemon /tmp/sidecar-venue.log python3 "$ROOT/apps/agent/src/graph/sidecar.py" )
    for _ in $(seq 1 15); do
      [ "$(probe "http://127.0.0.1:$SIDECAR_PORT/health")" = "200" ] && break
      sleep 1
    done
    [ "$(probe "http://127.0.0.1:$SIDECAR_PORT/health")" = "200" ] && ok "sidecar up" || { bad "sidecar failed — see /tmp/sidecar-venue.log"; exit 1; }
  else
    ok "sidecar already up"
  fi

  if [ "$(probe "http://127.0.0.1:$AGENT_PORT/api/health")" != "200" ]; then
    echo "starting agent..."
    ( cd "$ROOT/apps/agent" && PORT="$AGENT_PORT" DATABASE_URL="${DATABASE_URL:-postgres://bothy:bothy@localhost:5433/bothy}" \
      daemon /tmp/agent-venue.log npx tsx src/server.ts )
    wait_for "http://127.0.0.1:$AGENT_PORT/api/health" "agent" 40 || { bad "see /tmp/agent-venue.log"; exit 1; }
    ok "agent up"
  else
    ok "agent already up"
  fi

  # Warm the graphs so the first demo query is not the cold one.
  for g in supply_chain_deep logistics_risk power_plants; do
    curl -s -m 20 -X POST "http://127.0.0.1:$SIDECAR_PORT/query" -H 'content-type: application/json' \
      -d "{\"graph\":\"$g\",\"cypher\":\"MATCH (n) RETURN count(n)\"}" >/dev/null 2>&1 \
      && ok "warmed $g" || warn "warm failed for $g"
  done

  if [ "$(probe "http://127.0.0.1:$WEB_PORT/watch")" = "000" ]; then
    echo "starting web..."
    ( cd "$ROOT/apps/web" && PORT="$WEB_PORT" AGENT_URL="http://127.0.0.1:$AGENT_PORT" \
      daemon /tmp/web-venue.log npm run dev )
    wait_for "http://127.0.0.1:$WEB_PORT/watch" "web" 40 || { bad "see /tmp/web-venue.log"; exit 1; }
    ok "web up"
  else
    ok "web already up"
  fi

  echo
  status
  echo
  echo "Demo doors:"
  echo "  watch room   http://127.0.0.1:$WEB_PORT/watch"
  echo "  digest wall  http://127.0.0.1:$WEB_PORT/digest"
  echo "  pilot        http://127.0.0.1:$WEB_PORT/pilot"
  echo "  visualizer   http://127.0.0.1:$UI_PORT"
  echo
  echo "Generate fresh witness QR targets:  bash scripts/witness-qr.sh"
}

case "${1:-start}" in
  start)  start_all ;;
  stop)   stop_all ;;
  status) status ;;
  *)      echo "usage: $0 [start|stop|status]"; exit 1 ;;
esac