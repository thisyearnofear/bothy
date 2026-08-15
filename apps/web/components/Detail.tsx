"use client";

import { useState } from "react";
import type { Assessment, AuditEntry, RiskSnapshot, RouteInfo } from "../../../packages/shared/src/types";
import { fmtDateTime } from "../../../packages/shared/src/lib";

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
  llmAvailable?: boolean;
  onRun: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  if (!route || !horizon) {
    return (
      <p className="text-sm" style={{ color: "var(--text-faint)" }}>
        Select a route to inspect.
      </p>
    );
  }
  const chain = horizon.citations.map((c) => `${t(c.at)} · ${c.text}`);
  const visible = showAll ? chain : chain.slice(0, 3);
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
        <p className="mb-1 text-xs" style={{ color: "var(--text-faint)" }}>
          Causal chain <span>(at {horizonTime})</span>
        </p>
        <ol className="space-y-1.5">
          {visible.map((l, i) => (
            <li key={i} className="text-sm" style={{ color: "var(--text-body)" }}>
              {l}
            </li>
          ))}
        </ol>
        {chain.length > 3 && (
          <button onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs underline" style={{ color: "var(--cursor)" }}>
            {showAll ? "collapse" : `+${chain.length - 3} earlier signals`}
          </button>
        )}
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Rewound lens — <span className="mono">{cursorTime}</span>: {cursorSignals} signals known here.
        </p>
      </div>

      {/* reasoning state — the agent trace streaming in */}
      {running && (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-live="polite">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            reasoning…
          </p>
          <div className="mt-2 space-y-2">
            <div className="h-3 w-11/12 animate-pulse rounded" style={{ background: "var(--rule)" }} />
            <div className="h-3 w-4/5 animate-pulse rounded" style={{ background: "var(--rule)", animationDelay: "120ms" }} />
            <div className="h-3 w-2/3 animate-pulse rounded" style={{ background: "var(--rule)", animationDelay: "240ms" }} />
          </div>
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

        {/* Ledger receipt — official and final, like a stamp. */}
        {decided && assessment && (
          <p className="receipt-in mono mt-3 border-t pt-3 text-sm" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
            <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
              {assessment.status === "approved" ? "APPROVED" : "REJECTED"}
            </span>
            {" · "}
            {assessment.decidedAt ? fmtDateTime(assessment.decidedAt) : ""} · {route.actor} — recorded, pending dispatch (demo)
          </p>
        )}
      </div>

      {/* Audit line — appends after the decision, announced politely. */}
      {audit.length > 0 && (
        <div aria-live="polite">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Audit
          </p>
          <ul className="mt-1 space-y-1">
            {audit.slice(-4).reverse().map((a) => (
              <li key={a.id} className="mono text-xs" style={{ color: "var(--text-faint)" }}>
                {fmtDateTime(a.at)} · {a.actor} · {a.action} · {a.detail}
              </li>
            ))}
          </ul>
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
