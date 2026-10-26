import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DefenseBrief, GraphRun } from "../../../../packages/shared/src/types";

// Isolate case memory in a temp dir; set before importing the module under test.
const dir = mkdtempSync(join(tmpdir(), "bothy-hmem-"));
process.env.BOTHY_HMEM_DIR = dir;

const { recallInvestigations, recordDecision, recordInvestigation, caseMemoryStatus, resetCaseMemory } = await import("./caseMemory.ts");
const { SCENARIOS } = await import("../graph/scenarios.ts");
const { captureGraphRun } = await import("../graph/witness.ts");

const scenario = SCENARIOS[1]; // gallium-exposure
const run: GraphRun = captureGraphRun(scenario, {
  rows: [{ "p.name": "Test platform" }],
  columns: ["p.name"], count: 1, ms: 1, graphCommit: "abc12345",
});

const brief = {
  id: "b-1", runId: run.runId, title: `${scenario.title}: verification brief`,
  createdAt: "2026-10-22T00:00:00.000Z", evidenceHash: "e", graphCommit: "g", queryHash: "q",
  generator: { id: "bothy-scripted", version: "defense-brief-v1", cloudInference: false },
  resultCount: 1, claims: [], gaps: [], recommendedAction: "verify inventory", status: "pending",
} as DefenseBrief;

test("an investigation is remembered and later recalled by a related question", () => {
  assert.equal(recallInvestigations(`${scenario.title}. ${scenario.stakes}`)?.recalled.length ?? 0, 0);
  recordInvestigation(brief, run, run.runId);
  const warm = recallInvestigations(`${scenario.title}. ${scenario.stakes}`);
  assert.ok(warm && warm.recalled.length > 0, "second enquiry must recall the first investigation");
  assert.equal(warm.recalled[0].id, "mem-1");
  assert.match(warm.recalled[0].content, /captured 1 evidence rows/);
});

test("decisions are recorded and the trust ledger tracks every mutation", () => {
  recordDecision(brief, "approved", "reviewer-1");
  const status = caseMemoryStatus();
  assert.equal(status.engine, "meterless-hmem");
  assert.equal(status.memories, 2);
  assert.ok((status.ledger.create ?? 0) >= 2, "each write must be ledger-logged");
  assert.ok((status.ledger.read ?? 0) >= 1, "recall reads must be ledger-logged");
});

test("state persists across a fresh engine instance", () => {
  resetCaseMemory();
  const status = caseMemoryStatus();
  assert.equal(status.memories, 2, "records must reload from BOTHY_HMEM_DIR");
  assert.ok(existsSync(join(dir, "state.json")) && existsSync(join(dir, "ledger.jsonl")));
});

test.after(() => rmSync(dir, { recursive: true, force: true }));
