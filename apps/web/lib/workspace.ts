import type { DefenseSession } from "./api";
import type { DefenseCaseFilter } from "../../../packages/shared/src/types";

export function workspaceFocus(session: DefenseSession): { title: string; description: string; filter: DefenseCaseFilter } {
  if (session.authenticated && session.roles.includes("reviewer")) return { title: "Decisions needing your review", description: "Check the evidence, decide whether verification should proceed, and assign responsibility.", filter: "review" };
  if (session.authenticated && session.roles.includes("action-owner")) return { title: "Your verification work", description: "Acknowledge assigned work, check the consequences, and return a recorded finding.", filter: "work" };
  return { title: "Your investigations", description: "Establish the dependencies and gaps, then prepare a cited brief for an authorized reviewer.", filter: "all" };
}

export function defenseMode(params: { brief?: string | string[]; mode?: string | string[]; scenario?: string | string[] }) {
  if (typeof params.brief === "string" && params.brief) return "case";
  return params.mode === "investigate" || typeof params.scenario === "string" ? "investigation" : "workspace";
}
