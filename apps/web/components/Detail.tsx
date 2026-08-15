"use client";

import { useState } from "react";
import type { Assessment, AuditEntry, RiskSnapshot, RouteInfo, ToolCall } from "../../../packages/shared/src/types";
import { clamp01, fmtDateTime, riskLabel } from "../../../packages/shared/src/lib";

const t = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export default function Detail({
  route,
  horizon,
  horizonTime,
  color,
  cursorSignals,
  cursorTime,
  assessment,
  audit,
  running,
  traceLines,
  llmAvailable,
  onRun,
  onApprove,
  onReject,
}: {
  route: RouteInfo | null;
  horizon: RiskSnapshot | undefined;
  horizonTime: string;
  color: string;
  cursorSignals: number;
  cursorTime: string;
  assessment: Assessment | null;
  audit: AuditEntry[];
  running?: boolean;
  traceLines?: ToolCall[];
  llmAvailable?: boolean;
  onRun: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showAllAudit, setShowAllAudit] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  if (!route || !horizon) {
    return (
      <p className="text-sm" style={{ color: "var(--text-faint)" }}>
        Select a route to inspect.
      </p>
    );
  }
  const visibleCitations = showAll ? horizon.citations : horizon.citations.slice(0, 3);
  // counterfactual: the single load-bearing piece of evidence — remove it and
  // the label changes. Pure client arithmetic over signed contributions.
  const loadBearing = horizon.citations.reduce<null | (typeof horizon.citations)[number]>(
    (best, c) => (!best || Math.abs(c.contribution) > Math.abs(best.contribution) ? c : best),
    null
  );
  const withoutScore = loadBearing ? clamp01(horizon.score - loadBearing.contribution) : null;
  const withoutLabel = withoutScore != null ? riskLabel(withoutScore) : null;
  const pending = assessment?.status === "pending" || !assessment;
  const decided = assessment && assessment.status !== "pending";
  return (
    <div className="space-y-4">
      <div>
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
          Decision case
        </p>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-strong)" }}>
          {route.name}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>
          <span className="font-semibold" style={{ color }}>
            {horizon.label}
          </span>{" "}
          <span className="mono tnum">{horizon.score.toFixed(2)}</span>{" · assessed at "}
          <span className="mono">{horizonTime}</span>
        </p>
        {assessment && (
          <p className="mono text-xs" style={{ color: "var(--text-faint)" }}>
            engine: {assessment.engine} · confidence <span className="tnum">{assessment.confidence.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
          Causal chain <span>(at {horizonTime})</span>
        </p>
        {/* evidence chips — time, text, and the signed contribution that earned it */}
        <ol className="space-y-1.5">
          {visibleCitations.map((c, i) => (
            <li
              key={`${c.eventId}-${i}`}
              className="flex items-start justify-between gap-2 rounded border px-2 py-1.5"
              style={{ borderColor: "var(--rule)", background: "color-mix(in oklch, var(--panel) 60%, transparent)" }}
            >
              <span className="min-w-0 text-sm leading-snug" style={{ color: "var(--text-body)" }}>
                <span className="mono mr-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                  {t(c.at)}
                </span>
                {c.text}
              </span>
              <span
                className="mono tnum shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold"
                style={{
                  background: `color-mix(in oklch, ${c.contribution >= 0 ? "oklch(72% 0.17 55)" : "var(--rule)"} 14%, transparent)`,
                  color: c.contribution >= 0 ? "oklch(72% 0.17 55)" : "var(--text-faint)",
                }}
              >
                {c.contribution >= 0 ? "+" : ""}
                {c.contribution.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
        {horizon.citations.length > 3 && (
          <button onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs underline" style={{ color: "var(--cursor)" }}>
            {showAll ? "collapse" : `+${horizon.citations.length - 3} earlier signals`}
          </button>
        )}
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Rewound lens — <span className="mono">{cursorTime}</span>: {cursorSignals} signals known here.
        </p>
        {loadBearing && withoutScore != null && withoutLabel !== horizon.label && (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            Counterfactual — without the <span className="mono">{t(loadBearing.at)}</span> signal, risk would be{" "}
            <span className="font-semibold" style={{ color: "var(--text-body)" }}>
              {withoutLabel}
            </span>{" "}
            (<span className="mono tnum">{withoutScore.toFixed(2)}</span>).
          </p>
        )}
      </div>

      {/* reasoning state — the live code path, streaming tool call by tool call */}
      {running && (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-live="polite">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            reasoning…
          </p>
          {(traceLines ?? []).length === 0 ? (
            <div className="mt-2 space-y-2">
              <div className="h-3 w-11/12 animate-pulse rounded" style={{ background: "var(--rule)" }} />
              <div className="h-3 w-4/5 animate-pulse rounded" style={{ background: "var(--rule)", animationDelay: "120ms" }} />
              <div className="h-3 w-2/3 animate-pulse rounded" style={{ background: "var(--rule)", animationDelay: "240ms" }} />
            </div>
          ) : (
            <ul className="mono mt-2 max-h-44 space-y-1 overflow-auto text-xs leading-5">
              {(traceLines ?? []).map((tc, i) => (
                <li key={i} className="pin-in" style={{ color: tc.ok ? "var(--text-body)" : "oklch(64% 0.21 25)" }}>
                  <span style={{ color: "var(--text-faint)" }}>{t(tc.at)}</span> {tc.tool}: {tc.summary}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!running && assessment?.draft && (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
          <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--text-body)" }}>
            {assessment.draft}
          </p>
        </div>
      )}

      {/* The accountable gate: Bothy never publishes automatically. */}
      <div className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
          Bothy never publishes automatically
        </p>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          a shelter for the decision — the agent watches, a human owns the call.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={onRun}
            disabled={running}
            className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96] disabled:opacity-50"
            style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
          >
            {running ? "Reasoning…" : llmAvailable ? "Run agent (live LLM)" : "Run agent"}
          </button>
          {assessment && pending && (
            <>
              {/* Approval is a ledger treatment — neutral, strong border; risk colour stays risk-only. */}
              <button
                onClick={onApprove}
                className="awaiting-pulse rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-transform active:scale-[0.96]"
                style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
              >
                Approve
              </button>
              <button
                onClick={onReject}
                className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96]"
                style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
              >
                Reject
              </button>
              <span className="mono w-full text-xs" style={{ color: "var(--text-faint)" }}>
                awaiting {route.actor}…
              </span>
            </>
          )}
        </div>

        {/* Ledger receipt — official and final, like a stamp. One settle pulse, then quiet. */}
        {decided && assessment && (
          <p className="receipt-in mono mt-3 border-t pt-3 text-sm" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
            <span className="settle inline-block font-semibold" style={{ color: "var(--text-strong)" }}>
              {assessment.status === "approved" ? "APPROVED" : "REJECTED"}
            </span>
            {" · "}
            {assessment.decidedAt ? fmtDateTime(assessment.decidedAt) : ""} · {route.actor} — recorded, pending dispatch (demo)
          </p>
        )}
      </div>

      {/* Audit line — appends after the decision, announced politely; latest first. */}
      {audit.length > 0 && (
        <div aria-live="polite">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Audit
          </p>
          <ul className="mt-1 space-y-1">
            {(showAllAudit ? audit.slice().reverse() : audit.slice(-2).reverse()).map((a) => (
              <li key={a.id} className="mono text-xs" style={{ color: "var(--text-faint)" }}>
                {fmtDateTime(a.at)} · {a.actor} · {a.action} · {a.detail}
              </li>
            ))}
          </ul>
          {audit.length > 2 && (
            <button
              onClick={() => setShowAllAudit((v) => !v)}
              className="mt-1 text-xs underline"
              style={{ color: "var(--cursor)" }}
            >
              {showAllAudit ? "collapse" : `+${audit.length - 2} earlier entries`}
            </button>
          )}
        </div>
      )}

      {assessment && assessment.toolTrace != null && (
        <div>
          <button onClick={() => setShowTrace((v) => !v)} className="text-xs underline" style={{ color: "var(--cursor)" }}>
            {showTrace ? "hide" : "show"} agent trace
          </button>
          {showTrace && (
            <pre
              className="mono mt-2 max-h-48 overflow-auto rounded border p-2 text-xs leading-5"
              style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}
            >
              {assessment.phases.join(" -> ")}
              {"\n"}
              {JSON.stringify(assessment.toolTrace, null, 1)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
