import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  canonicalJSON,
  r4,
  assessmentAnchorPayload,
  briefAnchorPayload,
  decisionAnchorPayload,
} from "../../../packages/shared/src/anchor";
import { sha256Hex } from "./integrations/arweave";

const base = {
  id: "a-flood-1",
  scenario: "flood",
  routeId: "a66",
  at: "2026-02-12T16:00:00Z",
  score: 0.73,
  label: "ELEVATED",
  confidence: 0.8,
  causalChain: ["signal", "score"],
  evidence: [{ eventId: "e1" }],
  draft: "draft text",
  engine: "scripted",
  responsibleActor: "duty officer",
  priority: "urgent",
  // Post-anchor fields that must not move the digest.
  status: "pending",
  decisionNote: null,
  decidedAt: null,
  toolTrace: [{ tool: "t" }],
  phases: ["detect"],
};

describe("canonicalJSON", () => {
  it("is invariant to object key order, recursively", () => {
    const a = { z: 1, a: { y: 2, b: 3 }, m: [4, 5] };
    const b = { m: [4, 5], a: { b: 3, y: 2 }, z: 1 };
    assert.equal(canonicalJSON(a), canonicalJSON(b));
    assert.equal(canonicalJSON(a), '{"a":{"b":3,"y":2},"m":[4,5],"z":1}');
  });

  it("preserves array order and drops undefined properties", () => {
    assert.equal(canonicalJSON({ a: undefined, b: [3, 1, 2] }), '{"b":[3,1,2]}');
  });
});

describe("assessmentAnchorPayload", () => {
  it("ignores status, decision fields and tool traces", () => {
    const pending = sha256Hex(assessmentAnchorPayload(base));
    const decidedRow = { ...base, status: "approved", decisionNote: "signed", decidedAt: "2026-02-13T00:00:00Z", toolTrace: [] };
    assert.equal(pending, sha256Hex(assessmentAnchorPayload(decidedRow)));
  });

  it("normalizes timestamp format differences", () => {
    const a = sha256Hex(assessmentAnchorPayload({ ...base, at: "2026-02-12T16:00:00Z" }));
    const b = sha256Hex(assessmentAnchorPayload({ ...base, at: "2026-02-12T16:00:00.000Z" }));
    assert.equal(a, b);
  });

  it("rounds float4 noise out of score and confidence (r4)", () => {
    const a = sha256Hex(assessmentAnchorPayload({ ...base, score: 0.73000001907, confidence: 0.80000001192 }));
    const b = sha256Hex(assessmentAnchorPayload({ ...base, score: 0.73, confidence: 0.8 }));
    assert.equal(a, b);
    assert.equal(r4(0.73000001907), 0.73);
  });

  it("changes when real evidence fields change", () => {
    const a = sha256Hex(assessmentAnchorPayload(base));
    const b = sha256Hex(assessmentAnchorPayload({ ...base, draft: "different draft" }));
    assert.notEqual(a, b);
  });
});

describe("briefAnchorPayload / decisionAnchorPayload", () => {
  const brief = {
    id: "b-1", runId: "r-1", title: "t", createdAt: "2026-02-12T16:00:00Z",
    evidenceHash: "eh", graphCommit: "gc", queryHash: "qh", generator: { id: "bothy-scripted" },
    resultCount: 3, claims: [{ text: "x" }], gaps: ["g"],
    status: "approved", review: { subject: "s", decision: "approved", note: "", at: "x" },
  };

  it("excludes status/review and defaults nullable fields", () => {
    const draft = sha256Hex(briefAnchorPayload(brief));
    const reviewedBrief = { ...brief, status: "rejected" };
    assert.equal(draft, sha256Hex(briefAnchorPayload(reviewedBrief)));
    const payload = briefAnchorPayload(brief) as Record<string, unknown>;
    assert.equal(payload.federatedHash, null);
    assert.equal(payload.parentBriefId, null);
  });

  it("normalizes decidedAt and omits auditHead when absent", () => {
    const withHead = decisionAnchorPayload({ subjectDigest: "s", decision: "approved", decidedAt: "2026-02-12T16:00:00Z", actorDigest: "a", auditHead: "h" });
    const without = decisionAnchorPayload({ subjectDigest: "s", decision: "approved", decidedAt: "2026-02-12T16:00:00.000Z", actorDigest: "a" });
    assert.equal(canonicalJSON(without).includes("auditHead"), false);
    const headless = { ...withHead, auditHead: undefined };
    assert.equal(sha256Hex(headless), sha256Hex(without));
  });
});
