import { createHash, randomUUID } from "node:crypto";
import type { GraphRows, GraphRun, GraphScenario, GraphWitness } from "../../../../packages/shared/src/types";

export function captureGraphRun(scenario: GraphScenario, result: GraphRows, commit?: string): GraphRun {
  return {
    ...result,
    runId: randomUUID(),
    scenarioId: scenario.id,
    graph: scenario.graph,
    cypher: scenario.cypher,
    graphCommit: result.graphCommit ?? (commit ? commit.replace(/\(HEAD\)$/, "") : null),
    queryHash: createHash("sha256").update(scenario.cypher).digest("hex"),
    capturedAt: new Date().toISOString(),
    sourceBoundary: "Hackathon pack: synthetic supply/logistics data and public WRI energy data. Query rows may be limited; exposure is not proven operational impact.",
  };
}

export function createWitness(run: GraphRun, prev: string | null): GraphWitness {
  const pack: GraphWitness["pack"] = {
    version: 2,
    runId: run.runId,
    scenarioId: run.scenarioId,
    graph: run.graph,
    cypher: run.cypher,
    graphCommit: run.graphCommit,
    queryHash: run.queryHash ?? createHash("sha256").update(run.cypher).digest("hex"),
    capturedAt: run.capturedAt,
    sourceBoundary: run.sourceBoundary,
    approval: "unapproved",
    count: run.count,
    columns: run.columns,
    rows: run.rows,
    at: new Date().toISOString(),
  };
  const hash = createHash("sha256").update(JSON.stringify({ prev, pack })).digest("hex");
  return { hash, prev, at: pack.at, pack };
}

export function witnessRunId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (Object.keys(body).some((key) => key !== "runId")) return null;
  const runId = (body as Record<string, unknown>).runId;
  return typeof runId === "string" && runId.length <= 80 && runId.trim()
    ? runId.trim()
    : null;
}
