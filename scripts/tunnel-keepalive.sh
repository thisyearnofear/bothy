#!/usr/bin/env bash
# Keep the VPS tunnels alive during recording sessions. Both SSH forwards die
# silently; this loop checks ports every 15s and respawns via the existing
# scripts. Run in a terminal that can stay open: bash scripts/tunnel-keepalive.sh
set -u
cd "$(dirname "$0")/.."

while true; do
  nc -z 127.0.0.1 3000 2>/dev/null || bash scripts/federation.sh up >/dev/null 2>&1
  nc -z 127.0.0.1 11434 2>/dev/null || bash scripts/model.sh up >/dev/null 2>&1
  sleep 15
done
