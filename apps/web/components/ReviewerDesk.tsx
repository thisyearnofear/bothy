"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { api, type SandboxAction, type SandboxState } from "../lib/api";
import StatePill from "./StatePill";

const PLAN: SandboxAction[] = ["approve", "assign", "accept", "attack-self-approve", "attack-replay", "verify", "attack-rewrite-audit", "verify"];
const STATIONS = [
  ["Analyst", "Drafts a cited brief"],
  ["Reviewer", "Approves"],
  ["Reviewer", "Assigns an owner"],
  ["Owner", "Acknowledges and reports"],
  ["Reviewer", "Accepts the finding"],
] as const;

const ATTACKS: [SandboxAction, string][] = [
  ["attack-self-approve", "Approve as the analyst"],
  ["attack-replay", "Replay the approval"],
  ["attack-edit-evidence", "Edit the evidence"],
  ["attack-rewrite-audit", "Rewrite the audit log"],
];

function station(state: SandboxState): number {
  if (state.reassessed) return 5;
  if (state.actionStatus === "completed") return 4;
  if (state.actionStatus === "assigned" || state.actionStatus === "acknowledged") return 3;
  if (state.briefStatus === "approved") return 2;
  return 1;
}

export default function ReviewerDesk({ runId, auto }: { runId?: string; auto: boolean }) {
  const [state, setState] = useState<SandboxState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const planIndex = useRef(0);
  const alive = useRef(true);
  const sid = state?.sid;
  const log = useRef<HTMLOListElement>(null);
  const logged = state?.steps.length ?? 0;
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [logged]);

  useEffect(() => {
    alive.current = true;
    planIndex.current = 0;
    setState(null); setError("");
    api.createSandbox(runId).then((value) => { if (alive.current) setState(value); })
      .catch(() => { if (alive.current) setError("The desk could not start. Check the analysis service and retry."); });
    return () => { alive.current = false; };
  }, [runId, generation]);

  const act = useCallback(async (action: SandboxAction) => {
    if (!sid) return;
    setBusy(true); setError("");
    try { const next = await api.sandboxAct(sid, action); if (alive.current) setState(next); }
    catch { if (alive.current) setError("That session expired. Start the desk again."); }
    finally { if (alive.current) setBusy(false); }
  }, [sid]);

  // The owner is a different person from the viewer, so their two steps happen on their own.
  useEffect(() => {
    if (!state || busy) return;
    const next: SandboxAction | null = state.actionStatus === "assigned" ? "acknowledge" : state.actionStatus === "acknowledged" ? "complete" : null;
    if (!next) return;
    const timer = setTimeout(() => void act(next), 1100);
    return () => clearTimeout(timer);
  }, [state, busy, act]);

  useEffect(() => {
    if (!auto || !state || busy || planIndex.current >= PLAN.length) return;
    if (state.actionStatus === "assigned" || state.actionStatus === "acknowledged") return;
    const timer = setTimeout(() => { const action = PLAN[planIndex.current++]; void act(action); }, 1800);
    return () => clearTimeout(timer);
  }, [auto, state, busy, act]);

  if (error && !state) return <div role="alert" className="text-sm"><p>{error}</p><button className="mt-2 underline" onClick={() => setGeneration((value) => value + 1)}>Retry</button></div>;
  if (!state) return <p role="status" className="text-sm">Opening your desk…</p>;

  const at = station(state);
  const can = (action: SandboxAction) => state.available.includes(action) && !busy;
  const btn = "coarse-target rounded-lg border px-4 py-2 text-sm disabled:opacity-40";
  const accent = { borderColor: "var(--cursor)", color: "var(--cursor)" } as const;
  const ownerWorking = state.actionStatus === "assigned" || state.actionStatus === "acknowledged";

  return <section className="desk" aria-label="Your desk">
    <ol className="desk-track" aria-label="Where the case is">
      {STATIONS.map(([role, what], index) => <li key={what} data-state={index + 1 < at ? "done" : index + 1 === at ? "active" : "todo"}>
        <span className="mono">{role}</span><span>{what}</span>
      </li>)}
    </ol>
    <div className="desk-grid">
      <div className="space-y-4">
        <div className="desk-brief">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Brief · {state.briefStatus}</p>
          <ul>{state.claims.map((claim, index) => <li key={index}>{claim}</li>)}</ul>
          {state.evidenceEdited && <p className="mt-2 text-xs" style={{ color: "var(--st-tamper)" }}>The stored evidence was edited after this brief was drafted.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {state.available.includes("approve") && <>
            <button className={btn} style={accent} disabled={!can("approve")} onClick={() => void act("approve")}>Approve verification</button>
            <button className={btn} style={{ borderColor: "var(--rule)" }} disabled={!can("reject")} onClick={() => void act("reject")}>Reject</button>
          </>}
          {state.available.includes("assign") && <button className={btn} style={accent} disabled={!can("assign")} onClick={() => void act("assign")}>Assign to owner-a, due in 14 days</button>}
          {ownerWorking && <p role="status" className="text-sm">Owner-a is working on it…</p>}
          {state.available.includes("accept") && <button className={btn} style={accent} disabled={!can("accept")} onClick={() => void act("accept")}>Accept the finding</button>}
          {state.reassessed && <p role="status" className="text-sm">Case complete. It records a verification, not a proven operational effect.</p>}
          {state.briefStatus === "rejected" && <p role="status" className="text-sm">Rejected. The record is retained; a new brief needs its own review.</p>}
        </div>
        {auto && <p className="text-xs" style={{ color: "var(--text-faint)" }}>Auto-playing. Press Pause above to take the controls.</p>}
        <div className="desk-attacks">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Now try to cheat it</p>
          <div className="flex flex-wrap gap-2">
            {ATTACKS.map(([action, label]) => <button key={action} className={btn} style={{ borderColor: "var(--rule)" }} disabled={!can(action)} onClick={() => void act(action)}>{label}</button>)}
            <button className={btn} style={{ borderColor: "var(--st-verified)", color: "var(--st-verified)" }} disabled={!can("verify")} onClick={() => void act("verify")}>Verify the audit chain</button>
          </div>
        </div>
        <button className="text-xs underline" onClick={() => setGeneration((value) => value + 1)}>Start the desk over</button>
        {error && <p role="alert" className="text-sm">{error}</p>}
      </div>
      <ol ref={log} className="lab-steps desk-log" aria-live="polite" aria-label="What the system recorded">
        {state.steps.map((step, index) => <li key={index} style={{ animationDelay: "0ms" } as CSSProperties}>
          <span>{step.label}</span><StatePill state={step.outcome} /><small>{step.detail}</small>
        </li>)}
      </ol>
    </div>
  </section>;
}
