"use client";

export const DESK_KEY = "bothy-desk-seen";

/** One quiet first-visit beat: the officer owns time, then the record. */
export default function DeskCoach({
  tape,
  backtest,
  compact,
  onDismiss,
}: {
  tape?: boolean;
  backtest?: boolean;
  compact?: boolean;
  onDismiss: () => void;
}) {
  const line =
    tape || backtest
      ? "Reports land with a source. Weight sits on the case. The hatch is the agent's view."
      : "Each report is sourced and weighted. Evidence is what was known then. Approve is the record.";

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 ${compact ? "py-2" : "py-3"}`}
      style={{ borderColor: "var(--cursor)", background: "var(--panel)" }}
      role="status"
    >
      <p className={`leading-relaxed ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--text-body)" }}>
        {line}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="mono shrink-0 text-xs underline"
        style={{ color: "var(--cursor)" }}
      >
        got it
      </button>
    </div>
  );
}
