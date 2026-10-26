import type { BriefClaim, DefenseBrief, FederatedRun, GraphRun } from "../../../packages/shared/src/types";

export function validateCitation(brief: DefenseBrief, run: GraphRun, citation: BriefClaim["citations"][number]) {
  if (run.runId !== brief.runId || citation.runId !== brief.runId ||
      run.graphCommit !== brief.graphCommit || run.queryHash !== brief.queryHash ||
      !Number.isInteger(citation.row) || citation.row < 0 || citation.row >= run.rows.length ||
      !run.columns.includes(citation.column) || !Object.hasOwn(run.rows[citation.row], citation.column)) {
    throw new Error("The citation does not match the captured evidence. Inspection was blocked.");
  }
  return { row: citation.row, column: citation.column, value: run.rows[citation.row][citation.column] };
}

// Federated citations resolve against the brief's captured Zetaris runs the
// same way: the run id must be bound into the brief, and the row/column must
// exist in the stored capture.
export function validateFederatedCitation(brief: DefenseBrief, run: FederatedRun, citation: BriefClaim["citations"][number]) {
  if (!(brief.federated?.runIds ?? []).includes(run.runId) || citation.runId !== run.runId ||
      !Number.isInteger(citation.row) || citation.row < 0 || citation.row >= run.rows.length ||
      !run.columns.includes(citation.column) || !Object.hasOwn(run.rows[citation.row], citation.column)) {
    throw new Error("The citation does not match the captured evidence. Inspection was blocked.");
  }
  return { row: citation.row, column: citation.column, value: run.rows[citation.row][citation.column] };
}
