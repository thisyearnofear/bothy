import type { LabOutcome } from "../lib/api";

export const OUTCOME_LABEL: Record<LabOutcome, string> = {
  allowed: "Allowed",
  blocked: "Blocked",
  duplicate: "Duplicate refused",
  "tamper-detected": "Tamper detected",
  verified: "Verified",
};

export default function StatePill({ state, live = false }: { state: LabOutcome; live?: boolean }) {
  return <span className="pill" data-state={state} data-live={live}>{OUTCOME_LABEL[state]}</span>;
}
