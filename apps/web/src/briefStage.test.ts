import assert from "node:assert/strict";
import test from "node:test";
import { briefStage } from "../lib/briefStage";
import type { DefenseBrief } from "../lib/api";

const brief: DefenseBrief = {
  id: "fixture", runId: "fixture", title: "Fixture", createdAt: "2026-10-03T00:00:00Z",
  evidenceHash: "fixture", graphCommit: "fixture", queryHash: "fixture", resultCount: 1,
  generator: { id: "bothy-scripted", version: "defense-brief-v1", cloudInference: false },
  claims: [], gaps: [], recommendedAction: "Verify", status: "pending",
};

test("case stages reflect server transitions including rejection and recorded outcomes", () => {
  assert.equal(briefStage(null, false), "Awaiting analysis");
  assert.equal(briefStage(null, true), "Analyzed · ready to draft");
  assert.equal(briefStage(brief, true), "Awaiting reviewer decision");
  assert.equal(briefStage({ ...brief, status: "rejected" }, true), "Rejected · new analysis required");
  const approved = { ...brief, status: "approved" as const };
  assert.equal(briefStage(approved, true), "Approved · awaiting assignment");
  for (const [status, expected] of [
    ["assigned", "Assigned · awaiting owner acknowledgment"],
    ["acknowledged", "Acknowledged · verification in progress"],
    ["completed", "Finding recorded · awaiting reviewer reassessment"],
  ] as const) {
    assert.equal(briefStage({ ...approved, action: { owner: "owner", dueAt: "2026-10-03T12:00:00Z", status } }, true), expected);
  }
  const completed = { ...approved, action: { owner: "owner", dueAt: "2026-10-03T12:00:00Z", status: "completed" as const } };
  assert.equal(briefStage({ ...completed, reassessment: { subject: "reviewer", decision: "accepted", note: "Accepted", at: "2026-10-03T12:00:00Z" } }, true), "Verification finding accepted");
  assert.equal(briefStage({ ...completed, reassessment: { subject: "reviewer", decision: "further-verification", note: "Check timing", at: "2026-10-03T12:00:00Z" } }, true), "Further verification required");
});
