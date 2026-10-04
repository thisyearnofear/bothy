import assert from "node:assert/strict";
import test from "node:test";
import { LAB_SCENARIOS, runLab } from "./lab";

const outcomes = (id: string) => runLab(id)!.steps.map((step) => step.outcome);

test("every lab scenario runs and refuses what the workflow forbids", () => {
  for (const scenario of LAB_SCENARIOS) assert.ok(runLab(scenario.id), scenario.id);
  assert.equal(runLab("nope"), null);
  assert.ok(outcomes("self-approval").includes("blocked"));
  assert.deepEqual(outcomes("replayed-approval").slice(-2), ["duplicate", "duplicate"]);
  assert.equal(outcomes("wrong-owner").filter((o) => o === "blocked").length, 2);
  assert.equal(outcomes("skip-ahead").filter((o) => o === "blocked").length, 2);
  assert.equal(outcomes("tampered-evidence").filter((o) => o === "blocked").length, 2);
});

test("a rewritten audit entry breaks the chain at that entry", () => {
  const steps = runLab("tampered-audit")!.steps;
  assert.equal(steps.find((s) => s.label === "Verify the audit chain")?.outcome, "verified");
  const last = steps.at(-1)!;
  assert.equal(last.outcome, "tamper-detected");
  assert.match(last.detail, /breaks at entry 1/);
});

test("the guided happy path completes and its audit chain verifies", () => {
  const result = runLab("happy-path")!;
  assert.ok(result.steps.every((step) => step.outcome === "allowed" || step.outcome === "verified"));
  assert.equal(result.steps.at(-1)?.outcome, "verified");
  assert.ok(!LAB_SCENARIOS.some((scenario) => scenario.id === "happy-path"));
});
