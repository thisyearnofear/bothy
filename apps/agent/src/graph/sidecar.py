import json
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from turingdb import TuringDB

TURING_HOST = "http://localhost:6677"
PORT = 6777

client = TuringDB(host=TURING_HOST)


def to_payload(df, ms):
    cols = list(df.columns)
    rows = df.to_dict(orient="records")
    # pandas NaN/NaT are not JSON-safe — normalize via json round-trip fallback
    safe = json.loads(json.dumps(rows, default=str))
    return {"columns": cols, "rows": safe, "count": len(safe), "ms": round(ms, 1)}


class H(BaseHTTPRequestHandler):
    server_version = "BothySidecar/0.1"

    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/health":
                graphs = client.list_available_graphs()
                self._send(200, {"ok": True, "turing_host": TURING_HOST, "graphs": graphs})
            elif parsed.path == "/history":
                q = parse_qs(parsed.query)
                if q.get("graph"):
                    client.set_graph(q["graph"][0])
                t0 = time.time()
                df = client.query("CALL db.history()")
                self._send(200, to_payload(df, (time.time() - t0) * 1000))
            else:
                self._send(404, {"ok": False, "error": "unknown route"})
        except Exception as e:
            traceback.print_exc()
            self._send(500, {"ok": False, "error": str(e)})

    def do_POST(self):
        try:
            body = self._read_json()
            graph = body.get("graph")
            if graph:
                client.set_graph(graph)

            if self.path == "/query":
                cypher = body.get("cypher", "")
                commit = body.get("commit")
                if isinstance(commit, str) and "(HEAD)" in commit:
                    # history() reports HEAD as "<hash>(HEAD)"; the daemon
                    # wants the bare hash for set_commit.
                    commit = commit.split("(")[0]
                if commit:
                    client.set_commit(commit)
                try:
                    t0 = time.time()
                    try:
                        df = client.query(cypher)
                    except Exception as qe:
                        # Auto-load graphs that exist on disk but are not in
                        # memory (e.g. logistics_risk after a daemon restart).
                        # load_graph with raise_if_loaded=False is safe whether
                        # or not the graph is already loaded.
                        if "GRAPH_NOT_FOUND" in str(qe) and graph:
                            try:
                                client.load_graph(graph, raise_if_loaded=False)
                            except Exception:
                                pass
                            client.set_graph(graph)
                            if commit:
                                client.set_commit(commit)
                            df = client.query(cypher)
                        else:
                            raise
                    ms = (time.time() - t0) * 1000
                finally:
                    if commit:
                        try:
                            client.checkout()
                        except Exception:
                            pass
                self._send(200, to_payload(df, ms))
            elif self.path == "/change/new":
                ch = client.new_change()
                self._send(200, {"ok": True, "change": int(ch)})
            elif self.path == "/change/checkout":
                client.checkout(change=body.get("change"))
                self._send(200, {"ok": True})
            elif self.path == "/change/submit":
                client.query("CHANGE SUBMIT")
                client.checkout()
                self._send(200, {"ok": True})
            elif self.path == "/change/abandon":
                client.checkout()  # leave the change; uncommitted work is dropped
                self._send(200, {"ok": True})
            else:
                self._send(404, {"ok": False, "error": "unknown route"})
        except Exception as e:
            traceback.print_exc()
            try:
                client.checkout()
            except Exception:
                pass
            self._send(500, {"ok": False, "error": str(e)})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"bothy turing sidecar on :{PORT} -> {TURING_HOST}", flush=True)
    srv.serve_forever()
