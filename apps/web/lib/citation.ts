import type { BriefClaim, DefenseBrief, GraphRun } from "../../../packages/shared/src/types";

export function validateCitation(brief: DefenseBrief, run: GraphRun, citation: BriefClaim["citations"][number]) {
  if (run.runId !== brief.runId || citation.runId !== brief.runId ||
      run.graphCommit !== brief.graphCommit || run.queryHash !== brief.queryHash ||
      !Number.isInteger(citation.row) || citation.row < 0 || citation.row >= run.rows.length ||
      !run.columns.includes(citation.column) || !Object.hasOwn(run.rows[citation.row], citation.column)) {
    throw new Error("The citation does not match the captured evidence. Inspection was blocked.");
  }
  return { row: citation.row, column: citation.column, value: run.rows[citation.row][citation.column] };
}
