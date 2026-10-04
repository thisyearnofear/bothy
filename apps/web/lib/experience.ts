import type { GraphRun } from "./api";
import { CHAIN_STAGES } from "./atlas";

export type ExperiencePhase = "arrival" | "question" | "dependency" | "evidence" | "handoff";

export const EXPERIENCE_PHASES: ExperiencePhase[] = ["arrival", "question", "dependency", "evidence", "handoff"];

export interface ExperienceSelection {
  runId: string;
  row: number;
  column: string;
}

export function validateSelection(run: GraphRun | null, selection: ExperienceSelection | null): ExperienceSelection | null {
  if (!run || !selection) return null;
  if (selection.runId !== run.runId) return null;
  if (!Number.isInteger(selection.row) || selection.row < 0 || selection.row >= run.rows.length) return null;
  if (!run.columns.includes(selection.column)) return null;
  const row = run.rows[selection.row];
  if (!Object.hasOwn(row, selection.column)) return null;
  const value = row[selection.column];
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  return selection;
}

export function canVisitPhase(phase: ExperiencePhase, run: GraphRun | null, selection: ExperienceSelection | null): boolean {
  if (phase === "arrival" || phase === "question") return true;
  if (!run) return false;
  if (phase === "dependency") return true;
  return validateSelection(run, selection) !== null;
}

export interface StageLeaf {
  index: number;
  column: string;
  label: string;
  value: string;
  tone: "paper" | "stone";
}

export function stageLeaves(run: GraphRun | null, rowIndex: number): StageLeaf[] {
  if (!run) return [];
  const row = run.rows[rowIndex];
  if (!row) return [];
  const leaves: StageLeaf[] = [];
  CHAIN_STAGES.forEach(([label, column], index) => {
    if (!run.columns.includes(column) || !Object.hasOwn(row, column)) return;
    const value = row[column];
    if (value === null || value === undefined) return;
    if (typeof value === "string" && !value.trim()) return;
    leaves.push({ index, column, label, value: String(value), tone: index % 2 ? "stone" : "paper" });
  });
  return leaves;
}
