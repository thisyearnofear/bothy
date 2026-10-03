#!/bin/bash
set -eu
turingdb start -turing-dir /turing -p 6677 -demon &
for i in $(seq 1 60); do
  (echo > /dev/tcp/127.0.0.1/6677) 2>/dev/null && break
  sleep 1
done
socat TCP-LISTEN:6778,fork,reuseaddr TCP:127.0.0.1:6777 &
exec python sidecar.py
