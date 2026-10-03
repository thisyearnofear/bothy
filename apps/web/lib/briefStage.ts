import type { DefenseBrief } from "./api";

export function briefStage(brief: DefenseBrief | null, analyzed: boolean) {
  if (!brief) return analyzed ? "Analyzed · ready to draft" : "Awaiting analysis";
  if (brief.status === "rejected") return "Rejected · new analysis required";
  if (brief.status === "pending") return "Awaiting reviewer decision";
  if (!brief.action) return "Approved · awaiting assignment";
  if (brief.action.status === "assigned") return "Assigned · awaiting owner acknowledgment";
  if (brief.action.status === "acknowledged") return "Acknowledged · verification in progress";
  if (brief.reassessment?.decision === "accepted") return "Verification finding accepted";
  if (brief.reassessment?.decision === "further-verification") return "Further verification required";
  return "Finding recorded · awaiting reviewer reassessment";
}
