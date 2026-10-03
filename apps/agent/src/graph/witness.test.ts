import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { captureGraphRun, createWitness, witnessRunId } from "./witness";
import { SCENARIOS } from "./scenarios";

test("witness uses a captured run and retains its provenance and all rows", () => {
  const rows = Array.from({ length: 60 }, (_, index) => ({ platform: `demo-${index}` }));
  const run = captureGraphRun(SCENARIOS[1], { rows, columns: ["platform"], count: 60, ms: 8 });
  const entry = createWitness(run, null);
  assert.equal(entry.pack.runId, run.runId);
  assert.equal(entry.pack.scenarioId, "gallium-exposure");
  assert.equal(entry.pack.graph, "supply_chain_deep");
  assert.equal(entry.pack.cypher, SCENARIOS[1].cypher);
  assert.equal(entry.pack.graphCommit, null);
  assert.equal(entry.pack.approval, "unapproved");
  assert.equal(entry.pack.rows.length, 60);
  assert.match(entry.pack.sourceBoundary, /Query rows may be limited/);
  const hash = createHash("sha256").update(JSON.stringify({ prev: entry.prev, pack: entry.pack })).digest("hex");
  assert.equal(entry.hash, hash);
});

test("replayed capture retains an explicit commit without HEAD decoration", () => {
  const run = captureGraphRun(SCENARIOS[1], { rows: [], columns: [], count: 0, ms: 1 }, "abc12345(HEAD)");
  const first = createWitness(run, null);
  const next = createWitness(run, first.hash);
  assert.equal(next.pack.graphCommit, "abc12345");
  assert.equal(next.prev, first.hash);
  assert.notEqual(next.hash, first.hash);
});

test("witness requests cannot substitute rows, officer, scenario, or approval", () => {
  assert.equal(witnessRunId({ runId: " demo-run " }), "demo-run");
  for (const extra of ["rows", "officer", "scenarioId", "assessmentId", "approval"]) {
    assert.equal(witnessRunId({ runId: "demo-run", [extra]: "forged" }), null);
  }
  for (const body of [null, undefined, [], {}, { runId: "" }, { runId: 12 }, { runId: "x".repeat(81) }]) {
    assert.equal(witnessRunId(body), null);
  }
});
