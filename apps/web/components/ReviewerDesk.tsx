"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { api, type SandboxAction, type SandboxState } from "../lib/api";
import StatePill from "./StatePill";
import SandboxClaim from "./SandboxClaim";
import Inspector from "./Inspector";
import { guidedDeskAction, guidedDeskComplete } from "../lib/guidedDesk";

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

export default function ReviewerDesk({ runId, auto, guided = false, onPause, onComplete }: {
  runId?: string; auto: boolean; guided?: boolean; onPause?: () => void; onComplete?: () => void;
}) {
  const [state, setState] = useState<SandboxState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [full, setFull] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const viewHeading = useRef<HTMLHeadingElement>(null);
  const changedView = useRef(false);
  const notified = useRef(false);
  const planIndex = useRef(0);
  const alive = useRef(true);
  const sid = state?.sid;
  const log = useRef<HTMLOListElement>(null);
  const logged = state?.steps.length ?? 0;
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [logged]);
  useEffect(() => {
    if (changedView.current) { viewHeading.current?.focus(); changedView.current = false; }
  }, [full]);

  useEffect(() => {
    let current = true;
    alive.current = true;
    notified.current = false;
    planIndex.current = 0;
    setState(null); setError("");
    api.createSandbox(runId).then((value) => { if (current) setState(value); })
      .catch(() => { if (current) setError("The desk could not start. Check the analysis service and retry."); });
    return () => { current = false; alive.current = false; };
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
    if (guided) return;
    if (!state || busy) return;
    const next: SandboxAction | null = state.actionStatus === "assigned" ? "acknowledge" : state.actionStatus === "acknowledged" ? "complete" : null;
    if (!next) return;
    const timer = setTimeout(() => void act(next), 1100);
    return () => clearTimeout(timer);
  }, [state, busy, act, guided]);

  useEffect(() => {
    if (guided) {
      if (!auto || !state || busy || error) return;
      const next = guidedDeskAction(state);
      if (!next || !state.available.includes(next)) return;
      const timer = setTimeout(() => void act(next), 5000);
      return () => clearTimeout(timer);
    }
    if (!auto || !state || busy || planIndex.current >= PLAN.length) return;
    if (state.actionStatus === "assigned" || state.actionStatus === "acknowledged") return;
    const timer = setTimeout(() => { const action = PLAN[planIndex.current++]; void act(action); }, 1800);
    return () => clearTimeout(timer);
  }, [auto, state, busy, act, guided, error]);

  useEffect(() => {
    if (!guided || !state || busy || !guidedDeskComplete(state) || notified.current) return;
    notified.current = true;
    onComplete?.();
  }, [guided, state, busy, onComplete]);

  if (error && !state) return <div role="alert" className="text-sm"><p>{error}</p><button className="mt-2 underline" onClick={() => setGeneration((value) => value + 1)}>Retry</button></div>;
  if (!state) return <p role="status" className="text-sm">Opening your desk…</p>;

  const at = station(state);
  const can = (action: SandboxAction) => state.available.includes(action) && !busy;
  const btn = "btn";
  const ownerWorking = state.actionStatus === "assigned" || state.actionStatus === "acknowledged";

  const why = (action: SandboxAction) => (can(action) ? undefined : busy ? "Working…" : "The rules do not allow this at the current step.");
  const manualAct = (action: SandboxAction) => { onPause?.(); void act(action); };
  const controls = <div className="flex flex-wrap items-center gap-3">
    {state.available.includes("approve") && <><button className={`${btn} btn-primary`} title={why("approve")} disabled={!can("approve")} onClick={() => manualAct("approve")}>Approve verification</button><button className={btn} title={why("reject")} disabled={!can("reject")} onClick={() => manualAct("reject")}>Reject</button></>}
    {state.available.includes("assign") && <button className={`${btn} btn-primary`} title={why("assign")} disabled={!can("assign")} onClick={() => manualAct("assign")}>Assign to synthetic owner-a</button>}
    {ownerWorking && (guided ? <><button className={btn} disabled={!can("acknowledge")} onClick={() => manualAct("acknowledge")}>Owner acknowledges</button><button className={btn} disabled={!can("complete")} onClick={() => manualAct("complete")}>Owner reports finding</button></> : <p role="status" className="text-sm">Owner-a is working on it…</p>)}
    {state.available.includes("accept") && <button className={`${btn} btn-primary`} title={why("accept")} disabled={!can("accept")} onClick={() => manualAct("accept")}>Accept the finding</button>}
    {guided && state.reassessed && !guidedDeskComplete(state) && <button className={btn} disabled={!can("verify")} onClick={() => manualAct("verify")}>Verify the audit chain</button>}
    {state.reassessed && <p className="hint">Finding accepted. Verification, not proven operational effect.</p>}
    {state.briefStatus === "rejected" && <p role="status" className="text-sm">Rejected. The record is retained; a new brief needs its own review.</p>}
  </div>;
  const attacks = <div className="desk-attacks">
    <p className="eyebrow">Now try to cheat it</p>
    <p className="hint">Role violations are refused; storage-edit attacks test detection. Disabled controls are not valid at this step.</p>
    <div className="flex flex-wrap gap-2">{ATTACKS.map(([action, label]) => <button key={action} className={btn} title={why(action)} disabled={!can(action)} onClick={() => manualAct(action)}>{label}</button>)}<button className={`${btn} btn-quiet`} title={why("verify")} disabled={!can("verify")} onClick={() => manualAct("verify")}>Verify the audit chain</button></div>
  </div>;
  const claims = <ul className="readable-claims">{state.claims.map((claim, index) => <SandboxClaim key={index} claim={claim} index={index} onInspect={onPause} />)}</ul>;
  const claimPreview = <><ul className="readable-claims">{state.claims.slice(0, 1).map((claim, index) => <SandboxClaim key={index} claim={claim} index={index} onInspect={onPause} />)}</ul>{state.claims.length > 1 && <Inspector label={`Read all ${state.claims.length} sandbox findings`} title="Sandbox brief findings" onOpen={onPause}><ol className="reference-list">{state.claims.map((claim, index) => <li key={index}><p className="mono">{claim}</p></li>)}</ol></Inspector>}</>;
  const currentStep = state.steps.at(-1);
  const phase = state.reassessed ? 4 : state.actionStatus === "completed" ? 3 : ownerWorking ? 2 : state.briefStatus === "approved" ? 1 : 0;

  if (guided && !full) return <section className="handoff-stage frame" aria-label="Guided reviewer handoff">
    <ol className="handoff-rail" aria-label="Demonstration chapters">{["Cited brief", "Reviewer decision", "Owner task", "Returned finding", "Audit receipt"].map((label, index) => <li key={label} aria-current={index === phase ? "step" : undefined} data-state={index === phase ? "active" : index < phase ? "done" : "todo"}><span className="docref">0{index + 1}</span><span>{label}</span></li>)}</ol>
    <div className="handoff-scene" key={phase}>
      <div><p className="eyebrow">{state.briefStatus === "rejected" ? "Sandbox brief / rejected" : phase === 0 ? "Sandbox brief / pending review" : phase === 1 ? "Reviewer / verification approved" : phase === 2 ? "Owner-a / synthetic assignment" : phase === 3 ? "Returned finding / needs review" : "Verification record / inspect integrity"}</p>
        <h3 ref={viewHeading} tabIndex={-1}>{state.briefStatus === "rejected" ? "The reviewer rejected the brief." : ["A cited dependency, not a stoppage.", "Authorize the check. Not an intervention.", "One owner. A recorded due date.", "A finding returns to the reviewer.", "The evidence stays with the decision."][phase]}</h3>
        {phase === 0 ? claimPreview : phase === 1 ? <div className="handoff-document"><span className="docref">Reviewer decision</span><strong>Approved for verification</strong><p>Owner assignment is the next separate action.</p></div> : phase === 2 ? <div className="handoff-document"><span className="docref">Assigned actor</span><strong>owner-a</strong><p>{state.actionStatus === "acknowledged" ? "Acknowledged. The synthetic owner can now report." : "Assignment recorded. Awaiting acknowledgement."}</p><span className="hint">Fixed test due date, not the public policy deadline.</span></div> : phase === 3 ? <div className="handoff-document"><span className="docref">Synthetic owner finding</span><p>Inventory, alternates and timing checked against the cited path.</p><span className="hint">A scripted sandbox finding, not a real inventory result.</span></div> : <div className="handoff-document"><span className="docref">Retained sequence</span><strong>{state.steps.length} recorded attempts</strong><p>Acceptance and audit verification are separate recorded actions.</p><span className="hint">Hash linkage is not an authenticated signature.</span></div>}
        {state.evidenceEdited && <p role="status" className="hint">The sandbox evidence was edited after drafting. Further checks may refuse it.</p>}
      </div>
      <aside className="handoff-receipt" aria-label="Latest action receipt"><p className="docref">Actual sandbox response</p>{currentStep && <><StatePill state={currentStep.outcome} /><h4>{currentStep.label}</h4><p>{currentStep.detail}</p></>}<p className="hint">Fixed synthetic actors · disposable store · no saved cases changed</p></aside>
    </div>
    {controls}
    <div className="handoff-tools"><p className="hint" role="status">{busy ? "Waiting for the sandbox response…" : guidedDeskComplete(state) ? "Walkthrough complete · explore the record or challenge the rules" : auto ? "Demonstration running · Pause freezes scheduled actions" : "Paused · use the controls or resume above"}</p><button className="btn" onClick={() => { onPause?.(); changedView.current = true; setFull(true); }}>Open the full console</button><button className="btn btn-quiet" aria-expanded={challenge} aria-controls={`challenge-${sid}`} onClick={() => { onPause?.(); setChallenge((value) => !value); }}>Challenge the rules</button><Inspector label="Inspect the action record" title="Sandbox action record" onOpen={onPause}><ol className="reference-list">{state.steps.map((step, index) => <li key={index}><StatePill state={step.outcome} /><p>{step.label}</p><p className="hint">{step.detail}</p></li>)}</ol></Inspector></div>
    <div id={`challenge-${sid}`} hidden={!challenge}>{attacks}</div>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-quiet" disabled={busy} onClick={() => { onPause?.(); setGeneration((value) => value + 1); }}>Start the desk over</button>
  </section>;

  return <section className="desk" aria-label="Your desk">
    {guided && <><h3 ref={viewHeading} tabIndex={-1}>Full reviewer console</h3><button className="btn btn-quiet" onClick={() => { changedView.current = true; setFull(false); }}>Return to the guided stage</button></>}
    <p className="hint">Step {Math.min(at, 5)} of 5 · left: the brief and your controls · right: what the system recorded, one line per attempt.</p>
    <ol className="desk-track" aria-label="Where the case is">
      {STATIONS.map(([role, what], index) => <li key={what} data-state={index + 1 < at ? "done" : index + 1 === at ? "active" : "todo"}>
        <span className="mono">{role}</span><span>{what}</span>
      </li>)}
    </ol>
    <div className="desk-grid">
      <div className="space-y-4">
        <div className="desk-brief">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Brief · {state.briefStatus}</p>
          {claims}
          {state.evidenceEdited && <p className="mt-2 text-xs" style={{ color: "var(--st-tamper)" }}>The stored evidence was edited after this brief was drafted.</p>}
        </div>
        {controls}
        {auto && <p className="text-xs" style={{ color: "var(--text-faint)" }}>Auto-playing. Press Pause above to take the controls.</p>}
        {attacks}
        <button className="btn btn-quiet" disabled={busy} onClick={() => { onPause?.(); setGeneration((value) => value + 1); }}>Start the desk over</button>
        {error && <p role="alert" className="text-sm">{error}</p>}
      </div>
      <ol ref={log} className="lab-steps desk-log" role="log" aria-label="What the system recorded">
        {state.steps.map((step, index) => <li key={index} style={{ animationDelay: "0ms" } as CSSProperties}>
          <span>{step.label}</span><StatePill state={step.outcome} /><small>{step.detail}</small>
        </li>)}
      </ol>
    </div>
  </section>;
}
