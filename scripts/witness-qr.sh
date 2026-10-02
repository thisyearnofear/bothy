#!/usr/bin/env bash
# Generate the witness-pack QR sheet (see scripts/witness_qr.py).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 "$ROOT/scripts/witness_qr.py" "$@"