import assert from "node:assert/strict";
import test from "node:test";
import { validateCitation } from "../lib/citation";
import { ApiError, ApiAuthError, recoveryMessage } from "../lib/api";
import type { DefenseBrief, GraphRun } from "../lib/api";

const run: GraphRun = {
  runId: "run", scenarioId: "gallium-exposure", graph: "fixture", cypher: "fixture", queryHash: "query",
  graphCommit: "commit", capturedAt: "2026-10-03T00:00:00Z", sourceBoundary: "Synthetic",
  columns: ["p.name"], rows: Array.from({ length: 60 }, (_, i) => ({ "p.name": `Platform ${i}` })), count: 60, ms: 1,
};
const brief = { runId: "run", graphCommit: "commit", queryHash: "query" } as DefenseBrief;
const citation = { runId: "run", row: 59, column: "p.name" };

test("citations resolve exact stored rows beyond the table preview", () => {
  assert.deepEqual(validateCitation(brief, run, citation), { row: 59, column: "p.name", value: "Platform 59" });
});

test("mismatched evidence, row and column block inspection", () => {
  for (const bad of [{ ...run, runId: "wrong" }, { ...run, graphCommit: "wrong" }, { ...run, queryHash: "wrong" }]) {
    assert.throws(() => validateCitation(brief, bad, citation), /blocked/);
  }
  for (const bad of [{ ...citation, row: -1 }, { ...citation, row: 60 }, { ...citation, row: 0.5 }, { ...citation, column: "wrong" }, { ...citation, runId: "wrong" }]) {
    assert.throws(() => validateCitation(brief, run, bad), /blocked/);
  }
});

test("recovery distinguishes session, permission, conflict and service failure", () => {
  assert.match(recoveryMessage(new ApiAuthError("expired")), /Sign in again/);
  assert.match(recoveryMessage(new ApiError(403, "forbidden")), /not permitted/);
  assert.match(recoveryMessage(new ApiError(404, "missing")), /access scope/);
  assert.match(recoveryMessage(new ApiError(409, "changed")), /Reload.*retained/);
  assert.match(recoveryMessage(new ApiError(503, "unavailable")), /not been deleted/);
  assert.match(recoveryMessage(new ApiError(400, "invalid")), /supplied fields/);
});
