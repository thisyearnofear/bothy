import type { SandboxAction, SandboxState } from "./api";

export function guidedDeskComplete(state: SandboxState): boolean {
  return state.briefStatus === "rejected" || (state.reassessed && state.steps.at(-1)?.label === "Verify the audit chain");
}

export function guidedDeskAction(state: SandboxState): SandboxAction | null {
  if (guidedDeskComplete(state)) return null;
  if (state.briefStatus === "pending") return "approve";
  if (state.briefStatus === "approved" && state.actionStatus === "none") return "assign";
  if (state.actionStatus === "assigned") return "acknowledge";
  if (state.actionStatus === "acknowledged") return "complete";
  if (state.actionStatus === "completed" && !state.reassessed) return "accept";
  if (state.reassessed) return "verify";
  return null;
}
