"use client";

import { useEffect, useState } from "react";
import type { Assessment, AuditEntry, EvidenceCitation, EventKind, RiskSnapshot, RouteInfo, ToolCall } from "../../../packages/shared/src/types";
import { clamp01, fmtDateTime, riskLabel } from "../../../packages/shared/src/lib";
import { KIND_LABEL, pipelineLines } from "../lib/derive";
import { copyText, formatCaseRecord, printCaseRecord, readOfficerName, writeOfficerName } from "../lib/caseRecord";
import AgentBeat from "./AgentBeat";
import CitationRows from "./CitationRows";

const t = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export default function Detail({
  route,
  horizon,
  horizonTime,
  color,
  cursorCitations,
  cursorTime,
  cursorKinds = [],
  assessment,
  audit,
  running,
  traceLines,
  llmAvailable,
  compact,
  onRun,
  onApprove,
  onReject,
}: {
  route: RouteInfo | null;
  horizon: RiskSnapshot | undefined;
  horizonTime: string;
  color: string;
  cursorCitations: EvidenceCitation[];
  cursorTime: string;
  cursorKinds?: EventKind[];
  assessment: Assessment | null;
  audit: AuditEntry[];
  running?: boolean;
  traceLines?: ToolCall[];
  llmAvailable?: boolean;
  compact?: boolean;
  onRun: () => void;
  onApprove: (officer: string) => void;
  onReject: (officer: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showAllAudit, setShowAllAudit] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [showCase, setShowCase] = useState(false);
  const [officer, setOfficer] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOfficer(readOfficerName());
  }, []);

  if (!route || !horizon) {
    return (
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
          No corridor under the lamp.
        </p>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-faint)" }}>
          Select a route to open its decision case.
        </p>
      </div>
    );
  }
  const expanded = !compact || showCase;
  const cap = showAll ? undefined : 3;
  const hidden = Math.max(0, cursorCitations.length - 3);
  const lensOffHorizon = cursorTime !== horizonTime;
  const loadBearing = horizon.citations.reduce<null | (typeof horizon.citations)[number]>(
    (best, c) => (!best || Math.abs(c.contribution) > Math.abs(best.contribution) ? c : best),
    null
  );
  const withoutScore = loadBearing ? clamp01(horizon.score - loadBearing.contribution) : null;
  const withoutLabel = withoutScore != null ? riskLabel(withoutScore) : null;
  const pending = assessment?.status === "pending" || !assessment;
  const decided = assessment && assessment.status !== "pending";
  const draftLines = (assessment?.draft ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const draftPreview = draftLines.slice(0, 3).join("\n");
  const draftClipped = draftLines.length > 3;
  const canSign = Boolean(assessment && officer.trim());
  const signedBy =
    assessment?.decisionNote?.match(/^signed by (.+)$/i)?.[1] ??
    audit.find((a) => a.action === "approved" || a.action === "rejected")?.actor;

  const handoff = assessment
    ? formatCaseRecord({
        route,
        label: horizon.label,
        score: horizon.score,
        horizonTime,
        citations: horizon.citations,
        assessment,
        officer: signedBy ?? officer.trim() ?? undefined,
      })
    : "";

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
          <span className="mono tnum">{horizon.score.toFixed(2)}</span>
          {" · "}
          <span className="mono">{horizonTime}</span>
        </p>
        {assessment && (
          <p className="mono text-xs" style={{ color: "var(--text-faint)" }}>
            engine: {assessment.engine} · confidence <span className="tnum">{assessment.confidence.toFixed(2)}</span>
          </p>
        )}
      </div>

      {!running && (
        <AgentBeat
          id={`${route.id}:${horizonTime}`}
          lines={pipelineLines({
            routeName: route.name,
            actor: route.actor,
            label: horizon.label,
            score: horizon.score,
            at: horizonTime,
            citations: horizon.citations,
          })}
        />
      )}

      <div>
        <p className="mb-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
          Known at <span className="mono">{cursorTime}</span>
          {cursorKinds.length > 0 ? ` · ${cursorKinds.map((k) => KIND_LABEL[k]).join(" · ")}` : ""}
        </p>
        {cursorCitations.length === 0 ? (
          <p className="text-sm leading-snug" style={{ color: "var(--text-body)" }}>
            No reports on this corridor yet.
          </p>
        ) : (
          <CitationRows citations={cursorCitations} cap={cap} compact={compact} showMix />
        )}
        {hidden > 0 && (
          <button onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs underline" style={{ color: "var(--cursor)" }}>
            {showAll ? "collapse" : `+${hidden} more reports`}
          </button>
        )}
        {lensOffHorizon && (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            The draft still sits at <span className="mono">{horizonTime}</span> — scrubbing does not re-pin the call.
          </p>
        )}
        {expanded && loadBearing && withoutScore != null && withoutLabel !== horizon.label && (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            Counterfactual — without the <span className="mono">{t(loadBearing.at)}</span> signal, risk would be{" "}
            <span className="font-semibold" style={{ color: "var(--text-body)" }}>
              {withoutLabel}
            </span>{" "}
            (<span className="mono tnum">{withoutScore.toFixed(2)}</span>).
          </p>
        )}
      </div>

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
            {expanded || showDraft || !draftClipped ? assessment.draft : draftPreview}
          </p>
          {!expanded && !showDraft && draftClipped && (
            <button onClick={() => setShowDraft(true)} className="mt-2 text-xs underline" style={{ color: "var(--cursor)" }}>
              full draft
            </button>
          )}
        </div>
      )}

      <div className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
          Bothy never publishes automatically
        </p>
        {expanded && (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            a shelter for the decision — the agent watches, a human owns the call.
          </p>
        )}

        {pending && (
          <label className="mt-2 block text-xs" style={{ color: "var(--text-faint)" }}>
            Duty officer name
            <input
              id="officer-name"
              value={officer}
              onChange={(e) => {
                setOfficer(e.target.value);
                writeOfficerName(e.target.value);
              }}
              placeholder={route.actor}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" }}
              autoComplete="name"
            />
          </label>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {expanded && (
            <button
              onClick={onRun}
              disabled={running}
              className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96] disabled:opacity-50"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
            >
              {running ? "Reasoning…" : llmAvailable ? "Run agent (live LLM)" : "Run agent"}
            </button>
          )}
          {pending && (
            <>
              <button
                id="approve-gate"
                onClick={() => onApprove(officer.trim())}
                disabled={!canSign}
                className="awaiting-pulse rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-transform active:scale-[0.96] disabled:opacity-50"
                style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
              >
                Approve
              </button>
              <button
                onClick={() => onReject(officer.trim())}
                disabled={!canSign}
                className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96] disabled:opacity-50"
                style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
              >
                Reject
              </button>
              <span className="mono w-full text-xs" style={{ color: "var(--text-faint)" }}>
                {officer.trim() ? `awaiting ${officer.trim()}…` : `type your name to sign for ${route.actor}`}
              </span>
            </>
          )}
        </div>

        {decided && assessment && (
          <div className="receipt-in mt-3 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
            <p className="mono text-sm" style={{ color: "var(--text-body)" }}>
              <span className="settle inline-block font-semibold" style={{ color: "var(--text-strong)" }}>
                {assessment.status === "approved" ? "APPROVED" : "REJECTED"}
              </span>
              {" · "}
              {assessment.decidedAt ? fmtDateTime(assessment.decidedAt) : ""} · {signedBy ?? route.actor} — recorded,
              pending dispatch
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void copyText(handoff).then((ok) => {
                    if (ok) {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1600);
                    }
                  });
                }}
                className="mono text-xs underline"
                style={{ color: "var(--cursor)" }}
              >
                {copied ? "Copied" : "Copy case"}
              </button>
              <button
                type="button"
                onClick={() => printCaseRecord(`${route.name} — Bothy case`, handoff)}
                className="mono text-xs underline"
                style={{ color: "var(--cursor)" }}
              >
                Print record
              </button>
            </div>
          </div>
        )}
      </div>

      {compact && !showCase && (
        <button onClick={() => setShowCase(true)} className="text-xs underline" style={{ color: "var(--cursor)" }}>
          full case · trace
        </button>
      )}

      {audit.length > 0 && (
        <div aria-live="polite">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Audit
          </p>
          <ul className="mt-1 space-y-1">
            {(expanded && showAllAudit ? audit.slice().reverse() : audit.slice(-2).reverse()).map((a) => (
              <li key={a.id} className="mono text-xs" style={{ color: "var(--text-faint)" }}>
                {fmtDateTime(a.at)} · {a.actor} · {a.action} · {a.detail}
              </li>
            ))}
          </ul>
          {expanded && audit.length > 2 && (
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

      {expanded && assessment && assessment.toolTrace != null && (
        <div>
          <button onClick={() => setShowTrace((v) => !v)} className="text-xs underline" style={{ color: "var(--cursor)" }}>
            {showTrace ? "hide" : "show"} agent trace
          </button>
          {showTrace && (
            <div
              className="mt-2 rounded border p-2"
              style={{ borderColor: "var(--rule)", background: "color-mix(in oklch, var(--panel) 60%, transparent)" }}
            >
              <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                {assessment.phases.join(" -> ")}
              </p>
              <ul className="mono mt-1.5 max-h-44 space-y-1 overflow-auto text-xs leading-5">
                {assessment.toolTrace.map((tc, i) => (
                  <li key={i} style={{ color: tc.ok ? "var(--text-body)" : "oklch(64% 0.21 25)" }}>
                    <span style={{ color: "var(--text-faint)" }}>{t(tc.at)}</span> {tc.tool}: {tc.summary}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
