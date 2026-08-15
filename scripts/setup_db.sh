#!/usr/bin/env bash
# Bootstrap local Postgres 17 + PostGIS + pgvector for the Bothy demo.
# (Homebrew bottles of postgis/pgvector target PG17/PG18, so we run 17.)
set -uo pipefail

echo "==> [1/4] Ensuring postgresql@17 + postgis + pgvector are installed"
for pkg in postgresql@17 postgis pgvector; do
  if brew list --versions "$pkg" >/dev/null 2>&1; then
    echo "    $pkg already installed: $(brew list --versions "$pkg")"
  else
    echo "    installing $pkg..."
    if ! brew install "$pkg" >/tmp/bothy-brew-$pkg.log 2>&1; then
      if brew list --versions "$pkg" >/dev/null 2>&1; then
        echo "    $pkg installed (non-zero exit from cleanup, ignoring)"
      else
        echo "FAILED: brew install $pkg (see /tmp/bothy-brew-$pkg.log)"
        exit 1
      fi
    fi
  fi
done

echo "==> [2/4] Starting postgresql@17 (stop any other major first)"
# Stop any other running postgres service to avoid port conflicts.
for other in postgresql@14 postgresql@15 postgresql@16; do
  if brew list --versions "$other" >/dev/null 2>&1; then
    brew services stop "$other" >/dev/null 2>&1 || true
  fi
done
brew services stop postgresql@17 >/dev/null 2>&1 || true
brew services start postgresql@17 || { echo "FAILED: brew services start postgresql@17"; exit 1; }

echo "==> [3/4] Waiting for server"
up=0
for i in $(seq 1 90); do
  if psql postgres -tAc "select 1" >/dev/null 2>&1; then up=1; break; fi
  sleep 1
done
if [ "$up" -ne 1 ]; then echo "FAILED: postgres never came up"; exit 1; fi
echo "    server is up"

echo "==> [4/4] Creating database + extensions"
if ! psql postgres -tAc "select 1 from pg_database where datname='bothy'" | grep -q 1; then
  createdb bothy && echo "    createdb bothy" || echo "    'bothy' db already present"
fi
psql bothy -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
SQL
if [ $? -ne 0 ]; then echo "FAILED: extensions"; exit 1; fi

echo "==> DONE. Verify with: psql bothy -c '\\dx'"
