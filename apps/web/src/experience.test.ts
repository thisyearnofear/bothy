import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canVisitPhase, stageLeaves, validateSelection, type ExperienceSelection } from "../lib/experience";
import GraphPanel from "../components/GraphPanel";
import type { GraphRun } from "../lib/api";

const CHAIN_ROW = {
  "p.name": "IFV-24A", "s.name": "Fire control", "ss.name": "Thermal sight",
  "a.name": "IR imager", "sa.name": "Rangefinder", "c.name": "Laser diode",
  "c.family": "GaAs emitter", "m.name": "GaAs wafer", "g.name": "Primary gallium",
};

const chainRun = (rows: Record<string, unknown>[]): GraphRun => ({
  runId: "run-x", scenarioId: "gallium-chain", graph: "fixture", cypher: "fixture",
  queryHash: "fixture", graphCommit: "abc", capturedAt: "2026-10-03T00:00:00Z",
  sourceBoundary: "Synthetic fixture",
  columns: Object.keys(CHAIN_ROW), rows, count: rows.length, ms: 1,
});

const numericRun = (): GraphRun => ({
  runId: "run-num", scenarioId: "chn-ownership", graph: "fixture", cypher: "fixture",
  queryHash: "fixture", graphCommit: "abc", capturedAt: "2026-10-03T00:00:00Z",
  sourceBoundary: "fixture", columns: ["n", "ok"], rows: [{ n: 0, ok: false }], count: 1, ms: 1,
});

test("selection validates against the live run — stale runId, bad row, bad column rejected", () => {
  const run = chainRun([CHAIN_ROW]);
  const good: ExperienceSelection = { runId: "run-x", row: 0, column: "g.name" };
  assert.deepEqual(validateSelection(run, good), good);
  assert.equal(validateSelection(run, { ...good, runId: "other-run" }), null);
  assert.equal(validateSelection(run, { ...good, row: -1 }), null);
  assert.equal(validateSelection(run, { ...good, row: 1 }), null);
  assert.equal(validateSelection(run, { ...good, row: 0.5 }), null);
  assert.equal(validateSelection(run, { ...good, column: "p.archetype" }), null);
  assert.equal(validateSelection(run, { ...good, column: "nope" }), null);
  assert.equal(validateSelection(null, good), null);
  assert.equal(validateSelection(run, null), null);
});

test("selection rejects blank and absent values but keeps 0/false", () => {
  const run: GraphRun = {
    runId: "run-blank", scenarioId: "gallium-chain", graph: "fixture", cypher: "fixture",
    queryHash: "fixture", graphCommit: "abc", capturedAt: "2026-10-03T00:00:00Z",
    sourceBoundary: "fixture",
    columns: ["a", "b", "c", "d"], rows: [{ a: "", b: null, c: 0, d: false }], count: 1, ms: 1,
  };
  const sel = (column: string): ExperienceSelection => ({ runId: "run-blank", row: 0, column });
  assert.equal(validateSelection(run, sel("a")), null);
  assert.equal(validateSelection(run, sel("b")), null);
  assert.deepEqual(validateSelection(run, sel("c")), sel("c"));
  assert.deepEqual(validateSelection(run, sel("d")), sel("d"));
});

test("selection rejects inherited and schema-absent properties", () => {
  const run: GraphRun = {
    runId: "run-proto", scenarioId: "gallium-chain", graph: "fixture", cypher: "fixture",
    queryHash: "fixture", graphCommit: "abc", capturedAt: "2026-10-03T00:00:00Z",
    sourceBoundary: "fixture", columns: ["constructor", "p.name"], rows: [{ "p.name": "IFV-24A" }], count: 1, ms: 1,
  };
  assert.equal(validateSelection(run, { runId: "run-proto", row: 0, column: "constructor" }), null);
  assert.equal(validateSelection(run, { runId: "run-proto", row: 0, column: "toString" }), null);
  assert.deepEqual(
    validateSelection(run, { runId: "run-proto", row: 0, column: "p.name" }),
    { runId: "run-proto", row: 0, column: "p.name" },
  );
});

test("numeric zero and false captured values are valid selections, not missing", () => {
  const run = numericRun();
  assert.deepEqual(validateSelection(run, { runId: "run-num", row: 0, column: "n" }), { runId: "run-num", row: 0, column: "n" });
  assert.deepEqual(validateSelection(run, { runId: "run-num", row: 0, column: "ok" }), { runId: "run-num", row: 0, column: "ok" });
});

test("folio leaves omit null/blank/schema-absent stages, keep original index order, never amber", () => {
  const sparse: GraphRun = {
    runId: "run-sparse", scenarioId: "gallium-chain", graph: "fixture", cypher: "fixture",
    queryHash: "fixture", graphCommit: "abc", capturedAt: "2026-10-03T00:00:00Z",
    sourceBoundary: "fixture",
    columns: ["p.name", "s.name", "c.name", "g.name"],
    rows: [{ "p.name": "IFV-24A", "s.name": "", "c.name": "Laser diode", "g.name": "Primary gallium" }],
    count: 1, ms: 1,
  };
  const leaves = stageLeaves(sparse, 0);
  assert.deepEqual(leaves.map((l) => l.index), [0, 5, 7]);
  assert.equal(leaves.every((l) => l.tone === "paper" || l.tone === "stone"), true);
  assert.equal(leaves.at(-1)?.tone, "stone");
  assert.equal(stageLeaves(sparse, 9).length, 0);
  assert.equal(stageLeaves(null, 0).length, 0);
  const full = chainRun([CHAIN_ROW]);
  assert.equal(stageLeaves(full, 0).length, 8);
});

test("phase prerequisites never advance past real evidence", () => {
  const run = chainRun([CHAIN_ROW]);
  const sel: ExperienceSelection = { runId: "run-x", row: 0, column: "g.name" };
  assert.equal(canVisitPhase("arrival", null, null), true);
  assert.equal(canVisitPhase("question", null, null), true);
  assert.equal(canVisitPhase("dependency", null, null), false);
  assert.equal(canVisitPhase("dependency", run, null), true);
  assert.equal(canVisitPhase("evidence", run, null), false);
  assert.equal(canVisitPhase("evidence", run, sel), true);
  assert.equal(canVisitPhase("evidence", run, { ...sel, runId: "stale" }), false);
  assert.equal(canVisitPhase("handoff", run, null), false);
  assert.equal(canVisitPhase("handoff", run, sel), true);
  assert.equal(canVisitPhase("dependency", run, { ...sel, row: 9 }), true);
});

test("GraphPanel default presentation surface is unchanged", () => {
  const html = renderToStaticMarkup(createElement(GraphPanel, {
    initialSession: { configured: false, authenticated: false, roles: [] },
  }));
  assert.match(html, /Exposure question/);
  assert.match(html, /Analyze exposure/);
  assert.doesNotMatch(html, /experience-marker/);
});

test("GraphPanel presentation replaces the workspace shell but keeps the question state", () => {
  const html = renderToStaticMarkup(createElement(GraphPanel, {
    initialSession: { configured: false, authenticated: false, roles: [] },
    presentation: (state) => createElement("div", { "data-test": "experience-marker" },
      `catalogue:${state.catalogue} run:${state.run ? "yes" : "none"}`),
  }));
  assert.match(html, /experience-marker/);
  assert.match(html, /catalogue:loading/);
  assert.doesNotMatch(html, /Inspect captured run/);
});
