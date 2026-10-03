"use client";

import { useEffect, useRef, useState } from "react";
import { api, isAbortError, type DefenseBrief, type DefenseSession, type GraphRun } from "../lib/api";

const card = { borderColor: "var(--rule)", background: "var(--panel)" };
const control = "coarse-target rounded-lg border px-3 py-2 text-sm disabled:opacity-50";

export default function DefenseBriefPanel({ run, session }: { run: GraphRun | null; session: DefenseSession }) {
  const [brief, setBrief] = useState<DefenseBrief | null>(null);
  const [evidence, setEvidence] = useState<GraphRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [outcome, setOutcome] = useState("");
  const alive = useRef(true);
  const reviewer = session.authenticated && session.roles.includes("reviewer");
  const assignedOwner = session.authenticated && session.roles.includes("action-owner") && brief?.action?.owner === session.subject;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("brief");
    if (!id) return;
    if (!session.authenticated) {
      setError("Saved briefs require a verified SSO session to reopen. The record has not been deleted.");
      return;
    }
    const ctl = new AbortController();
    api.defenseBrief(id, ctl.signal).then((saved) => { if (!ctl.signal.aborted) setBrief(saved); })
      .catch((e) => { if (!isAbortError(e)) setError(e instanceof Error ? e.message : String(e)); });
    return () => ctl.abort();
  }, [session.authenticated]);

  const update = async (operation: () => Promise<DefenseBrief>) => {
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      if (!alive.current) return;
      setBrief(result);
      const url = new URL(window.location.href);
      url.searchParams.set("brief", result.id);
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (alive.current) setBusy(false); }
  };

  return (
    <section className="rounded-lg border p-4 sm:p-5" style={card} aria-label="Programme verification brief">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Evidence → review → owned action</p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: "var(--text-strong)" }}>{brief?.title ?? "Prepare a cited verification brief"}</h2>
        </div>
        <button className={control} style={card} disabled={busy || !run || Boolean(brief)}
          onClick={() => { if (run) void update(() => api.draftDefenseBrief(run.runId)); }}>Draft cited brief</button>
      </div>
      <p className="mt-3 text-sm leading-relaxed">
        {session.error ?? (session.authenticated ? `Verified subject: ${session.subject}. Assigned roles: ${session.roles.join(", ")}.`
          : session.configured ? "OIDC verification is configured. A trusted SSO sign-in/session bridge must supply an API access token; this browser is not signed in."
          : "OIDC is not configured. Public/synthetic drafts are available, but review, simulation, and action updates are disabled.")}
      </p>
      {!brief && <p className="mt-2 text-sm" style={{ color: "var(--text-faint)" }}>Analyze exposure first. The deterministic brief quotes captured rows; it makes no production-loss prediction and runs no cloud model.</p>}
      {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
      {brief && (
        <div className="mt-5 space-y-5 border-t pt-5" style={{ borderColor: "var(--rule)" }}>
          <p className="mono break-all text-xs" style={{ color: "var(--text-faint)" }}>
            {brief.status.toUpperCase()} · {brief.resultCount} captured query rows · {brief.generator.version}<br />
            graph {brief.graphCommit} · query {brief.queryHash}<br />
            evidence {brief.evidenceHash}
          </p>
          <ol className="space-y-3">
            {brief.claims.map((claim, index) => <li key={index} className="border-l pl-3" style={{ borderColor: "var(--cursor)" }}>
              <p className="break-words text-sm">{claim.text}</p>
              <p className="mono mt-1 break-all text-xs" style={{ color: "var(--text-faint)" }}>
                {claim.citations.map((citation) => `run ${citation.runId}, row ${citation.row + 1}, ${citation.column}`).join(" · ")}
              </p>
            </li>)}
          </ol>
          {!brief.claims.length && <p className="text-sm">No rows were captured. This is not evidence of no exposure.</p>}
          <div>
            <h3 className="text-sm font-semibold">Known gaps</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{brief.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
          </div>
          <p className="text-sm leading-relaxed"><strong>Next verification:</strong> {brief.recommendedAction}</p>
          <button className={control} style={card} disabled={busy || !session.authenticated} onClick={async () => {
            setBusy(true); setError("");
            try { setEvidence(await api.defenseEvidence(brief.id)); }
            catch (e) { setError(e instanceof Error ? e.message : String(e)); }
            finally { setBusy(false); }
          }}>Inspect full captured evidence (SSO required)</button>
          {evidence && <pre className="mono max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs" tabIndex={0} aria-label="Full brief evidence">{JSON.stringify(evidence, null, 2)}</pre>}
          {brief.status === "pending" && (
            <div className="space-y-3">
              <label className="block text-sm">Review note
                <textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} disabled={busy || !reviewer}
                  className="mt-2 block w-full rounded-lg border p-3" style={card} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={control} style={card} disabled={busy || !reviewer} onClick={() => void update(() => api.reviewDefenseBrief(brief.id, "approved", note))}>Approve verification brief</button>
                <button className={control} style={card} disabled={busy || !reviewer} onClick={() => void update(() => api.reviewDefenseBrief(brief.id, "rejected", note))}>Reject brief</button>
              </div>
              <p className="text-xs">Approval authorizes the verification step, not an operational intervention or automatic email. Only a verified reviewer can decide.</p>
            </div>
          )}
          {brief.review && <p className="break-words text-sm">Reviewed by {brief.review.subject} at {new Date(brief.review.at).toLocaleString()}: {brief.review.note || "No note recorded."}</p>}
          {brief.status === "approved" && !brief.action && <div className="space-y-3">
            <label className="block text-sm">Assigned owner (configured OIDC subject)
              <input value={owner} maxLength={200} onChange={(e) => setOwner(e.target.value)} disabled={busy || !reviewer} className="mt-2 block w-full rounded-lg border p-3" style={card} />
            </label>
            <label className="block text-sm">Verification due
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} disabled={busy || !reviewer} className="mt-2 block max-w-full rounded-lg border p-3" style={card} />
            </label>
            <button className={control} style={card} disabled={busy || !reviewer || !owner.trim() || !dueAt}
              onClick={() => void update(() => api.assignDefenseAction(brief.id, owner.trim(), new Date(dueAt).toISOString()))}>Assign verification action</button>
          </div>}
          {brief.action && <div className="space-y-3">
            <p className="break-words text-sm">Action: {brief.action.status}. Owner {brief.action.owner}; due {new Date(brief.action.dueAt).toLocaleString()}.</p>
            {brief.action.status === "assigned" && <button className={control} style={card} disabled={busy || !assignedOwner}
              onClick={() => void update(() => api.acknowledgeDefenseAction(brief.id))}>Acknowledge assignment</button>}
            {brief.action.status === "acknowledged" && <>
              <label className="block text-sm">Observed verification outcome
                <textarea value={outcome} maxLength={2000} onChange={(e) => setOutcome(e.target.value)} disabled={busy || !assignedOwner} className="mt-2 block w-full rounded-lg border p-3" style={card} />
              </label>
              <button className={control} style={card} disabled={busy || !assignedOwner || !outcome.trim()} onClick={() => void update(() => api.recordDefenseOutcome(brief.id, outcome))}>Record outcome</button>
            </>}
            {brief.action.outcome && <p className="break-words text-sm">Owner-recorded outcome: {brief.action.outcome}. This is not independently verified operational effectiveness.</p>}
          </div>}
        </div>
      )}
    </section>
  );
}
