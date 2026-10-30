// Canonical anchor payloads for Bothy's Arweave evidence receipts.
//
// A receipt stores a fingerprint — sha256(canonicalJSON(payload)) — never the
// record itself. Anyone can recompute the fingerprint from the record later
// and compare it to what was anchored. That only works if the serialization
// is deterministic (Postgres jsonb reorders keys, float4 round-trips nudge
// scores) and if the payload excludes fields that legitimately change after
// anchoring (status, decisionNote, decidedAt, toolTrace).
//
// Pure TS: no node/browser imports — hashing lives with the caller
// (node:crypto on the agent, crypto.subtle in the browser).

/** Deterministic JSON: object keys sorted recursively, array order kept,
 *  `undefined` properties dropped (JSON.stringify drops them anyway — this
 *  makes it explicit and recursive). */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

// Postgres real (float4) round-trips nudge scores a few ulps; rounding to 4
// decimals keeps the anchored digest reproducible from the stored row.
export const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

// Structural, not `Assessment`: any object carrying these fields qualifies.
export interface AssessmentAnchorSource {
  id: string;
  scenario: string;
  routeId: string;
  at: string;
  score: number;
  label: string;
  confidence: number;
  causalChain: string[];
  evidence: unknown;
  draft: string;
  engine: string;
  responsibleActor: string;
  priority: string;
}

export function assessmentAnchorPayload(a: AssessmentAnchorSource) {
  return {
    id: a.id,
    scenario: a.scenario,
    routeId: a.routeId,
    at: new Date(a.at).toISOString(),
    score: r4(a.score),
    label: a.label,
    confidence: r4(a.confidence),
    causalChain: a.causalChain,
    evidence: a.evidence,
    draft: a.draft,
    engine: a.engine,
    responsibleActor: a.responsibleActor,
    priority: a.priority,
  };
}

// Structural DefenseBrief subset — deliberately excludes status/review/
// action/reasoning/memory, which legitimately change after drafting.
export function briefAnchorPayload(b: {
  id: string;
  runId: string;
  title: string;
  createdAt: string;
  evidenceHash: string;
  graphCommit: string;
  queryHash: string;
  generator: unknown;
  resultCount: number;
  claims: unknown;
  gaps: string[];
  federated?: { hash: string };
  parentBriefId?: string;
}) {
  return {
    id: b.id,
    runId: b.runId,
    title: b.title,
    createdAt: b.createdAt,
    evidenceHash: b.evidenceHash,
    graphCommit: b.graphCommit,
    queryHash: b.queryHash,
    generator: b.generator,
    resultCount: b.resultCount,
    claims: b.claims,
    gaps: b.gaps,
    federatedHash: b.federated?.hash ?? null,
    parentBriefId: b.parentBriefId ?? null,
  };
}

export function decisionAnchorPayload(d: {
  subjectDigest: string;
  decision: string;
  decidedAt: string;
  actorDigest: string;
  auditHead?: string;
}) {
  const payload: Record<string, unknown> = {
    subjectDigest: d.subjectDigest,
    decision: d.decision,
    decidedAt: new Date(d.decidedAt).toISOString(),
    actorDigest: d.actorDigest,
  };
  if (d.auditHead !== undefined) payload.auditHead = d.auditHead;
  return payload;
}

export type AnchorKind = "assessment" | "defense-brief";
export type AnchorMoment = "generated" | "decided";
export type AnchorState = "pending" | "anchored" | "failed";

export interface AnchorRecord {
  kind: AnchorKind;
  subjectId: string;
  moment: AnchorMoment;
  state: AnchorState;
  digest: string;
  txId?: string;
  url?: string;
  gateway: string;
  receipt: Record<string, unknown>;
  reason?: string;
  at: string;
}
