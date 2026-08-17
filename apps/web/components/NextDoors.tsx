"use client";

/** Scene exits — same verbs as the job, only at tape-end and after a sign. */
export default function NextDoors({
  beat,
  compact,
  otherHill,
  pendingName,
  onRewind,
  onSign,
  onOtherHill,
  onNextCorridor,
}: {
  beat: "tape-end" | "signed";
  compact?: boolean;
  otherHill: string;
  pendingName?: string;
  onRewind: () => void;
  onSign?: () => void;
  onOtherHill: () => void;
  onNextCorridor?: () => void;
}) {
  const line =
    beat === "tape-end"
      ? "The hatch is the agent's view. The day is yours now."
      : pendingName
        ? "Recorded. Other corridors still wait."
        : "Recorded. Floods · fires · convoys — same shelter, different hill.";

  return (
    <section
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 ${compact ? "py-2" : "py-3"}`}
      style={{ borderColor: "var(--cursor)", background: "var(--panel)" }}
      aria-label="What next"
    >
      <p className={`leading-relaxed ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--text-body)" }}>
        {line}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" onClick={onRewind} className="mono text-xs underline" style={{ color: "var(--cursor)" }}>
          Rewind the day
        </button>
        {beat === "tape-end" && onSign && (
          <button type="button" onClick={onSign} className="mono text-xs underline" style={{ color: "var(--cursor)" }}>
            Sign the draft
          </button>
        )}
        {beat === "signed" && pendingName && onNextCorridor && (
          <button type="button" onClick={onNextCorridor} className="mono text-xs underline" style={{ color: "var(--cursor)" }}>
            {pendingName} still waits
          </button>
        )}
        <button type="button" onClick={onOtherHill} className="mono text-xs underline" style={{ color: "var(--cursor)" }}>
          {otherHill}
        </button>
      </div>
    </section>
  );
}
