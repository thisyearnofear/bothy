"""Loopback-only, request-isolated TuringDB bridge. No public write language."""
import json
import math
import os
import re
import time
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from turingdb import TuringDB

TURING_HOST = os.environ.get("TURING_HOST", "http://localhost:6677")
target = urlparse(TURING_HOST)
if target.scheme != "http" or target.hostname not in ("localhost", "127.0.0.1", "::1") or target.username or target.password:
    raise RuntimeError("TuringDB must be a loopback HTTP daemon; remote SDK transport is not approved")
PORT = int(os.environ.get("PORT", "6777"))
POLICY = json.loads(Path(__file__).with_name("read-policy.json").read_text())


class InvalidRequest(ValueError):
    pass


@contextmanager
def request_client(graph=None):
    # HTTPClient stores graph/commit/change on the instance, not the daemon.
    # Explicit JSON transport avoids an ambient TURINGDB_TYPE changing this.
    client = TuringDB(type="json", host=TURING_HOST)
    client.impl._client.timeout = 8
    try:
        if graph:
            client.set_graph(graph)
            client.load_graph(graph, raise_if_loaded=False)
        yield client
    finally:
        client.impl._client.close()


def graph_name(value):
    if not isinstance(value, str) or value not in POLICY["reads"]:
        raise InvalidRequest("graph is not in the read catalogue")
    return value


def read_query(graph, value):
    # Exact allowlist, not a regex purporting to parse Cypher. Extend the
    # reviewed catalogue deliberately; arbitrary CALL/write clauses are denied.
    if not isinstance(value, str) or value not in POLICY["reads"][graph]:
        raise InvalidRequest("query is not in the read-only catalogue")
    return value


def safe_value(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {str(k): safe_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [safe_value(v) for v in value]
    return value


def to_payload(df, ms, commit=None):
    rows = safe_value(df.to_dict(orient="records"))
    payload = {"columns": list(df.columns), "rows": rows, "count": len(rows), "ms": round(ms, 1)}
    if commit:
        payload["graphCommit"] = commit
    return payload


def pinned_commit(client, requested=None):
    if requested is not None:
        if not isinstance(requested, str) or not re.fullmatch(r"[a-fA-F0-9]{1,128}", requested):
            raise InvalidRequest("commit must be a bare hexadecimal graph revision")
        return requested
    history = client.query("CALL db.history()").to_dict(orient="records")
    head = next((str(row.get("commit", "")) for row in history
                 if str(row.get("commit", "")).endswith("(HEAD)")), None)
    if not head:
        raise RuntimeError("graph HEAD could not be resolved; refusing an unpinned capture")
    revision = head.removesuffix("(HEAD)").strip()
    if not re.fullmatch(r"[a-fA-F0-9]{1,128}", revision):
        raise RuntimeError("graph HEAD revision is invalid")
    return revision


def query(body):
    graph = graph_name(body.get("graph"))
    cypher = read_query(graph, body.get("cypher"))
    with request_client(graph) as client:
        revision = pinned_commit(client, body.get("commit"))
        client.checkout(commit=revision)
        t0 = time.monotonic()
        return to_payload(client.query(cypher), (time.monotonic() - t0) * 1000, revision)


def simulate(body):
    allowed = POLICY["simulation"]
    if set(body) - {"graph", "writes", "readCypher", "keep"} or (body.get("keep") is not None and body.get("keep") is not False):
        raise InvalidRequest("simulation is abandon-only; submitting changes is disabled")
    if any(body.get(key) != allowed[key] for key in ("graph", "writes", "readCypher")):
        raise InvalidRequest("only the reviewed temporary-marker simulation is enabled")
    with request_client(allowed["graph"]) as client:
        revision = pinned_commit(client)
        client.checkout(commit=revision)
        before = to_payload(client.query(allowed["readCypher"]), 0, revision)
        client.checkout()
        # CHANGE NEW forks current HEAD, which may have moved since the read.
        # Fail rather than comparing different baselines.
        if pinned_commit(client) != revision:
            raise RuntimeError("graph HEAD changed; retry simulation")
        change = None
        try:
            change = client.new_change()
            for write in allowed["writes"]:
                client.query(write)
            after = to_payload(client.query(allowed["readCypher"]), 0)
            return {"ok": True, "kept": False, "graphCommit": revision,
                    "beforeCount": before["count"], "afterCount": after["count"],
                    "before": before, "after": after}
        finally:
            if change is not None:
                # Never SUBMIT. Checkout leaves the change; no writes reach main.
                # Daemon-side reclamation of abandoned changes is a separate gate.
                client.checkout()


class H(BaseHTTPRequestHandler):
    server_version = "BothySidecar/0.2"

    def _send(self, code, obj):
        body = json.dumps(obj, default=str, allow_nan=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/health":
                with request_client() as client:
                    self._send(200, {"ok": True, "graphs": client.list_available_graphs(),
                                     "requestIsolation": True, "pinnedReads": True,
                                     "readPolicy": "catalogue-only", "simulation": "abandon-only"})
            elif parsed.path == "/history":
                graph = graph_name(parse_qs(parsed.query).get("graph", [None])[0])
                with request_client(graph) as client:
                    t0 = time.monotonic()
                    self._send(200, to_payload(client.query("CALL db.history()"), (time.monotonic() - t0) * 1000))
            else:
                self._send(404, {"error": "unknown route"})
        except InvalidRequest as e:
            self._send(400, {"error": str(e)})
        except Exception:
            self._send(503, {"error": "graph operation unavailable"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length < 1 or length > 32768:
                raise InvalidRequest("JSON request size is invalid")
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise InvalidRequest("JSON object is required")
            if self.path == "/query":
                self._send(200, query(body))
            elif self.path == "/simulate":
                self._send(200, simulate(body))
            else:
                self._send(404, {"error": "unknown route; change lifecycle endpoints are disabled"})
        except (InvalidRequest, json.JSONDecodeError, ValueError) as e:
            self._send(400, {"error": str(e)})
        except Exception:
            self._send(503, {"error": "graph operation unavailable"})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"bothy isolated turing sidecar on :{PORT}", flush=True)
    srv.serve_forever()
