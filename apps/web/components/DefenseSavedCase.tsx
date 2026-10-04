"use client";

import { useEffect, useState } from "react";
import { api, isAbortError, recoveryMessage, type DefenseSession, type GraphRun } from "../lib/api";
import DefenseBriefPanel from "./DefenseBriefPanel";
import DefenseCases from "./DefenseCases";
import GalliumExplanation from "./GalliumExplanation";
import { exposureSummary } from "../lib/exposureSummary";

export default function DefenseSavedCase({ id, initialSession }: { id: string; initialSession: DefenseSession }) {
  const [session, setSession] = useState(initialSession);
  const [run, setRun] = useState<GraphRun | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [revising, setRevising] = useState(false);
  const [revision, setRevision] = useState<{ id: string } | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    api.defenseSession(ctl.signal).then((value) => { if (!ctl.signal.aborted) setSession(value); })
      .catch((e) => { if (!ctl.signal.aborted && !isAbortError(e)) { setSession({ configured: initialSession.configured, authenticated: false, roles: [], error: recoveryMessage(e) }); } });
    return () => ctl.abort();
  }, [initialSession.configured, retry]);
  useEffect(() => {
    setRun(null); setError("");
    if (!session.authenticated) return;
    let alive = true;
    api.defenseEvidence(id).then((captured) => { if (alive) setRun(captured); })
      .catch((e) => { if (alive) setError(recoveryMessage(e)); });
    return () => { alive = false; };
  }, [id, session.authenticated, session.subject, retry]);
  const summary = run ? exposureSummary(run) : null;
  return <div className="space-y-5">
    <nav className="flex flex-wrap gap-4 text-sm" aria-label="Defence case navigation">
      <a href="/defense" className="underline">Back to workspace</a>
      <a href="/defense?mode=investigate&scenario=gallium-chain" className="underline">Start a separate investigation</a>
      <a href="#saved-cases" className="underline">Saved cases and work</a>
    </nav>
    <DefenseBriefPanel key={id} run={null} session={session} savedCase />
    <details className="rounded-lg border p-4 sm:p-5" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
      <summary className="cursor-pointer text-sm font-semibold">Stored evidence &amp; linked revision</summary>
      <div className="record-status mt-3"><span>Stored capture</span><span>Prior decision unchanged</span><span>New revision needs new approval</span></div>
      {summary && <><h2 className="mt-3 text-xl font-semibold">{summary.heading}</h2><p className="mt-2 text-sm">{summary.explanation}</p><p className="mt-2 text-sm">Captured {new Date(run!.capturedAt).toLocaleString()}.</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{summary.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></>}
      {session.authenticated && session.roles.some((role) => role === "analyst" || role === "reviewer") && <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
        <p className="hint">Recapture → separate pending brief. No inherited approval; prior action unchanged.</p>
        <button className="coarse-target rounded border px-3 py-2 text-sm" disabled={!run || revising || Boolean(revision)} onClick={async () => {
          if (!run) return;
          setRevising(true); setError("");
          try {
            const captured = await api.runScenario(run.scenarioId);
            const child = await api.reviseDefenseBrief(id, captured.runId);
            setRevision({ id: child.id });
          } catch (e) { setError(recoveryMessage(e)); }
          finally { setRevising(false); }
        }}>{revising ? "Capturing and creating revision…" : "Recapture and create linked revision"}</button>
        {revision && <p role="status" className="text-sm">Revision saved. <a className="underline" href={`/defense?brief=${encodeURIComponent(revision.id)}`}>Open new pending revision</a>. The prior case is unchanged.</p>}
      </div>}
      {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
      <button className="coarse-target mt-3 rounded border px-3 py-2 text-sm" onClick={() => setRetry((value) => value + 1)}>Refresh saved evidence and session</button>
    </details>
    {run?.scenarioId === "gallium-chain" && <GalliumExplanation key={run.runId} run={run} />}
    <div id="saved-cases"><DefenseCases session={session} /></div>
  </div>;
}
