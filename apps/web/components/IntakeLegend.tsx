"use client";

import { useState } from "react";
import type { ScenarioId } from "../../../packages/shared/src/types";

/** Quiet intake contract, one line by default — the fine print discloses on demand. */
export default function IntakeLegend({
  caseId,
  compact,
}: {
  caseId: ScenarioId | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const clock =
    caseId === "backtest"
      ? "Beyond the hatch: ITV News — sourced outcome, not in the score"
      : caseId === "live"
        ? "In the room, not the score: Open-Meteo — operator-fetched, frozen"
        : caseId === "flood"
          ? "Same ledger, different wedge: Environment Agency river gauges — report-shaped, in the score"
          : null;

  return (
    <section
      className={`mb-4 rounded-lg border px-4 ${compact ? "py-1.5" : "py-2"}`}
      style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
      aria-label="Intake"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <p className={`mono uppercase tracking-widest ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--text-faint)" }}>
          Intake
        </p>
        <p className={`leading-snug ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--text-body)" }}>
          <span style={{ color: "var(--text-strong)" }}>In the score</span>
          {" — "}
          warning · forecast · road · incident · traffic
        </p>
        {!compact && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mono text-xs underline"
            style={{ color: "var(--cursor)" }}
            aria-expanded={open}
          >
            {open ? "less" : "the clocks"}
          </button>
        )}
      </div>
      {(open || compact) && (
        <>
          {clock && (
            <p className={`mono mt-1 leading-snug ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--text-faint)" }}>
              {clock}
            </p>
          )}
          <p className={`mono mt-1 leading-snug ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--text-faint)" }}>
            {caseId === "live"
              ? "Operator road reports land in the score · audio · radio · social are not ingested"
              : "Not ingested — audio · radio · social"}
          </p>
        </>
      )}
    </section>
  );
}
