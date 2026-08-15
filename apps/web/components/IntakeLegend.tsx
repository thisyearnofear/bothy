"use client";

import type { ScenarioId } from "../../../packages/shared/src/types";

/** Quiet intake contract: reports in the score, live API off it, news beyond the hatch. */
export default function IntakeLegend({
  caseId,
  compact,
}: {
  caseId: ScenarioId | null;
  compact?: boolean;
}) {
  const clock =
    caseId === "backtest"
      ? "Beyond the hatch: ITV News — sourced outcome, not in the score"
      : caseId === "live"
        ? "In the room, not the score: Open-Meteo — operator-fetched, frozen"
        : null;

  return (
    <section
      className={`mb-4 rounded-lg border px-4 ${compact ? "py-2" : "py-3"}`}
      style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
      aria-label="Intake"
    >
      <p className={`mono uppercase tracking-widest ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--text-faint)" }}>
        Intake
      </p>
      <p className={`mt-1 leading-snug ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--text-body)" }}>
        <span style={{ color: "var(--text-strong)" }}>In the score</span>
        {" — "}
        warning · forecast · road · incident
      </p>
      {clock && (
        <p className={`mono mt-1 leading-snug ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--text-faint)" }}>
          {clock}
        </p>
      )}
      <p className={`mono mt-1 leading-snug ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--text-faint)" }}>
        Not ingested — audio · radio · social
      </p>
    </section>
  );
}
