import copy
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from unittest.mock import patch

import sidecar


class Frame:
    def __init__(self, rows):
        self.rows = rows
        self.columns = list(rows[0]) if rows else []

    def to_dict(self, orient):
        return copy.deepcopy(self.rows)


class Client:
    def __init__(self, graph):
        self.graph = graph
        self.commit = "HEAD"
        self.change = None
        self.written = False
        self.checkout_count = 0
        self.fail_write = False

    def checkout(self, change="main", commit="HEAD"):
        self.commit = commit
        self.change = None if change == "main" else change
        self.checkout_count += 1

    def new_change(self):
        self.change = 1
        return 1

    def query(self, cypher):
        time.sleep(0.001)
        if cypher == "CALL db.history()":
            return Frame([{"commit": "abc12345(HEAD)"}])
        if "SET p.sim_closed" in cypher:
            if self.fail_write:
                raise RuntimeError("injected write failure")
            self.written = True
            return Frame([])
        if "sim_closed" in cypher:
            return Frame([{"p.name": "hypothetical"}] if self.written else [])
        return Frame([{"graph": self.graph, "commit": self.commit, "change": self.change}])


class SidecarTest(unittest.TestCase):
    def setUp(self):
        self.clients = []
        self.lock = threading.Lock()

        @contextmanager
        def factory(graph=None):
            client = Client(graph)
            with self.lock:
                self.clients.append(client)
            yield client

        self.patch = patch.object(sidecar, "request_client", factory)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_concurrent_replays_and_simulation_do_not_share_graph_commit_or_change(self):
        bodies = [{"graph": graph, "cypher": reads[0], "commit": revision}
                  for graph, reads in sidecar.POLICY["reads"].items()
                  for revision in ("abc12345", "de123456")]
        with ThreadPoolExecutor(max_workers=7) as pool:
            futures = [pool.submit(sidecar.query, body) for body in bodies]
            simulated = pool.submit(sidecar.simulate, sidecar.POLICY["simulation"])
            for body, future in zip(bodies, futures):
                result = future.result()
                self.assertEqual(result["rows"], [{"graph": body["graph"], "commit": body["commit"], "change": None}])
                self.assertEqual(result["graphCommit"], body["commit"])
            self.assertFalse(simulated.result()["kept"])
        self.assertEqual(len(self.clients), 7)
        self.assertTrue(all(client.change is None for client in self.clients))

    def test_default_reads_pin_head_before_execution(self):
        result = sidecar.query({"graph": "supply_chain_deep", "cypher": sidecar.POLICY["reads"]["supply_chain_deep"][0]})
        self.assertEqual(result["graphCommit"], "abc12345")
        self.assertEqual(result["rows"][0]["commit"], "abc12345")

    def test_write_language_and_unreviewed_calls_are_rejected(self):
        for cypher in ["MATCH (n) SET n.x = 1", "CALL db.history()", "MATCH (n) RETURN n; CHANGE SUBMIT",
                       sidecar.POLICY["reads"]["supply_chain_deep"][0] + " /* SET */"]:
            with self.assertRaises(sidecar.InvalidRequest):
                sidecar.query({"graph": "supply_chain_deep", "cypher": cypher})
        self.assertEqual(self.clients, [])

    def test_submit_and_arbitrary_simulation_are_rejected_before_opening_change(self):
        for body in [{**sidecar.POLICY["simulation"], "keep": True},
                     {**sidecar.POLICY["simulation"], "writes": ["CREATE (n)"]},
                     {**sidecar.POLICY["simulation"], "commit": "forged"}]:
            with self.assertRaises(sidecar.InvalidRequest):
                sidecar.simulate(body)
        self.assertEqual(self.clients, [])

    def test_failed_simulation_leaves_change_without_submitting(self):
        client = Client("supply_chain_deep")
        client.fail_write = True

        @contextmanager
        def factory(_graph=None):
            yield client

        with patch.object(sidecar, "request_client", factory):
            with self.assertRaisesRegex(RuntimeError, "injected"):
                sidecar.simulate(sidecar.POLICY["simulation"])
        self.assertIsNone(client.change)
        self.assertGreaterEqual(client.checkout_count, 3)

    def test_json_normalizes_nonfinite_values(self):
        self.assertEqual(sidecar.to_payload(Frame([{"a": float("nan"), "b": float("inf")}]), 1)["rows"], [{"a": None, "b": None}])


if __name__ == "__main__":
    unittest.main()
