const STAGES = [
  ["Draft", "Analyst", "Cited claim"],
  ["Approve", "Reviewer", "Recorded decision"],
  ["Assign", "Reviewer", "Owner + deadline"],
  ["Report", "Owner", "Finding + unknowns"],
  ["Accept", "Reviewer", "Verification, not operational closure"],
] as const;

export default function WorkflowStrip() {
  return <ol className="workflow-strip" aria-label="Case handoff">
    {STAGES.map(([action, role, output], index) => <li key={action}>
      <span className="docref">{String(index + 1).padStart(2, "0")} / {role}</span>
      <strong>{action}</strong>
      <span>{output}</span>
    </li>)}
  </ol>;
}
