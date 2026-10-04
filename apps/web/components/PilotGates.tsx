import LensTabs from "./LensTabs";

const GATES = [
  ["Scope", "One question · analyst + reviewer", "Agree the recurring exposure question and what an approval authorizes."],
  ["Boundary", "Approved fields · access · egress", "Agree BOM and dependency fields, source versions, reference evidence, hosting, identity, retention, export controls and any model egress before transfer. Private access and customer tenancy need separate approval."],
  ["Rehearsal", "Checked dependencies · visible gaps", "Validate roles and case access. Compare dependencies, interpretation errors and time to a review-ready brief against today's process."],
  ["Acceptance", "Review the results · proceed or stop", "Agree targets first. Review accuracy issues, handoff completion and remaining security gaps before deciding on operational use."],
] as const;

export default function PilotGates() {
  return <LensTabs label="Pilot gates" variant="gates" items={GATES.map(([title, caption, detail]) => ({
    id: title, label: title, caption,
    content: <div className="gate-detail"><p className="eyebrow">{title} / agreed output</p><p>{detail}</p><span className="hint">Planning gates, not completed milestones.</span></div>,
  }))} />;
}
