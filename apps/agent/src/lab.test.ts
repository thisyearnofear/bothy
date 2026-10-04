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

import { DatabaseSync } from "node:sqlite";
import { actSandbox, createSandbox } from "./labSession";

test("a sandbox session enforces the real rules step by step", () => {
  const source = new DatabaseSync(":memory:");
  source.exec("CREATE TABLE graph_runs (id TEXT PRIMARY KEY, run TEXT NOT NULL)");
  const created = createSandbox(source);
  assert.equal(created.briefStatus, "pending");
  assert.ok(created.available.includes("approve") && !created.available.includes("assign"));
  assert.equal(actSandbox(created.sid, "assign")!.steps.at(-1)?.outcome, "blocked");
  assert.equal(actSandbox(created.sid, "attack-self-approve")!.steps.at(-1)?.outcome, "blocked");
  assert.equal(actSandbox(created.sid, "approve")!.briefStatus, "approved");
  assert.equal(actSandbox(created.sid, "attack-replay")!.steps.at(-1)?.outcome, "duplicate");
  for (const action of ["assign", "acknowledge", "complete", "accept"] as const) actSandbox(created.sid, action);
  const verified = actSandbox(created.sid, "verify")!;
  assert.equal(verified.steps.at(-1)?.outcome, "verified");
  assert.equal(verified.reassessed, true);
  actSandbox(created.sid, "attack-rewrite-audit");
  assert.equal(actSandbox(created.sid, "verify")!.steps.at(-1)?.outcome, "tamper-detected");
  assert.equal(actSandbox("missing", "verify"), null);
});

test("editing evidence in a sandbox blocks later decisions", () => {
  const source = new DatabaseSync(":memory:");
  source.exec("CREATE TABLE graph_runs (id TEXT PRIMARY KEY, run TEXT NOT NULL)");
  const created = createSandbox(source);
  actSandbox(created.sid, "attack-edit-evidence");
  const after = actSandbox(created.sid, "approve")!;
  assert.equal(after.briefStatus, "pending");
  assert.equal(after.steps.at(-1)?.outcome, "blocked");
});
