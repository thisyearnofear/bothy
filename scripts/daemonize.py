#!/usr/bin/env python3
"""Detach a command into its own session so it survives the parent shell.

On macOS there is no `setsid` binary, so `nohup ... &` still shares a process
group — a `killpg` from the launching shell (Ctrl-C, terminal close, a CI job
timeout) takes the child down with it. `os.setsid()` puts the child in a fresh
session/process group, which is what makes `scripts/venue.sh` services actually
outlive the shell that started them.

Usage:
  python3 scripts/daemonize.py <logfile> <cmd> [args...]
"""
import os
import subprocess
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    log_path, cmd = sys.argv[1], sys.argv[2:]
    os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
    pid = os.fork()
    if pid > 0:
        # Parent: report the child's pid and return.
        print(pid)
        return 0
    # Child: new session, detached stdio.
    os.setsid()
    log = open(log_path, "ab", buffering=0)
    devnull = open(os.devnull, "rb")
    os.dup2(devnull.fileno(), 0)
    os.dup2(log.fileno(), 1)
    os.dup2(log.fileno(), 2)
    try:
        os.execvp(cmd[0], cmd)
    except OSError as e:
        print(f"daemonize: failed to exec {cmd[0]}: {e}", file=log)
        os._exit(127)


if __name__ == "__main__":
    raise SystemExit(main())