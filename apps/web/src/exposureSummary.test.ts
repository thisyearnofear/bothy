import assert from "node:assert/strict";
import test from "node:test";
import { catalogueLabel, exposureSummary } from "../lib/exposureSummary";
import type { GraphRun } from "../lib/api";

const run = (rows: Record<string, unknown>[], scenarioId = "gallium-exposure"): GraphRun => ({
  runId: "fixture", scenarioId, graph: "supply_chain_deep", cypher: "fixture", queryHash: "fixture",
  graphCommit: "fixture", capturedAt: "2026-10-03T00:00:00Z", sourceBoundary: "Synthetic fixture",
  columns: ["p.name"], rows, count: rows.length, ms: 1,
});

test("gallium summary counts distinct captured names without inventing programmes or paths", () => {
  const summary = exposureSummary(run([{ "p.name": "Radar" }, { "p.name": "Radar" }, { "p.name": "EW" }]));
  assert.equal(summary.names.length, 2);
  assert.match(summary.heading, /^2 platform names observed/);
  assert.match(summary.explanation, /not the intervening dependency paths/);
  assert.match(summary.gaps.join(" "), /not unique programme identifiers/);
});

test("empty and missing names do not imply no exposure", () => {
  assert.match(exposureSummary(run([])).gaps.join(" "), /not evidence of no exposure/);
  const summary = exposureSummary(run([{ "p.name": null }, { "p.name": " " }, { "p.name": 12 }]));
  assert.equal(summary.names.length, 0);
  assert.match(summary.gaps.join(" "), /3 captured rows have no usable/);
});

test("limit reached means potentially omitted matches, never a complete count", () => {
  const summary = exposureSummary(run(Array.from({ length: 50 }, (_, i) => ({ "p.name": `Platform ${i}` }))));
  assert.match(summary.gaps[0], /additional matches may be omitted/);
  assert.match(exposureSummary(run([{ "p.name": "A" }])).gaps[0], /coverage is unknown/);
});

test("other scenarios do not inherit gallium interpretation", () => {
  const summary = exposureSummary(run([{ "p.name": "A" }], "other"));
  assert.deepEqual(summary.names, []);
  assert.equal(summary.heading, "1 captured dependency row");
});

test("chain scenario remains a bounded row sample rather than a platform count", () => {
  const summary = exposureSummary(run([{ "p.name": "Synthetic platform", "c.name": "Synthetic component" }], "gallium-chain"));
  assert.equal(summary.heading, "1 captured dependency row");
  assert.match(summary.gaps.join(" "), /not a total/);
});

test("catalogue labels distinguish loading, unavailable, and empty", () => {
  assert.equal(catalogueLabel("unavailable"), "Exposure questions unavailable");
  assert.equal(catalogueLabel("empty"), "No exposure questions configured");
  assert.equal(catalogueLabel("loading"), "Loading questions…");
});
