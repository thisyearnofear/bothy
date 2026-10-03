"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, ApiAuthError, api, isAbortError, recoveryMessage, type DefenseBrief, type DefenseSession, type GraphRun } from "../lib/api";
import { briefStage } from "../lib/briefStage";
import { validateCitation } from "../lib/citation";

const card = { borderColor: "var(--rule)", background: "var(--panel)" };
const control = "coarse-target rounded-lg border px-3 py-2 text-sm disabled:opacity-50";

const SIGN_IN_ERRORS: Record<string, string> = {
  sso_not_configured: "SSO is not configured on this deployment, so sign-in is disabled.",
  callback_rejected: "The identity provider did not return an authorization code.",
  transaction_missing: "The sign-in transaction expired or was already used. Start again.",
  state_mismatch: "The sign-in response did not match the request. Start again.",
  sign_in_failed: "Sign-in failed. Check the SSO configuration and try again.",
  token_endpoint_unreachable: "The SSO token endpoint is unreachable.",
};

export default function DefenseBriefPanel({ run, session }: { run: GraphRun | null; session: DefenseSession }) {
  const [brief, setBrief] = useState<DefenseBrief | null>(null);
  const [evidence, setEvidence] = useState<GraphRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [selected, setSelected] = useState<{ row: number; column: string } | null>(null);
  const target = useRef<HTMLDivElement>(null);
  const [reopen, setReopen] = useState(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [outcome, setOutcome] = useState("");
  const alive = useRef(true);
  const authenticated = session.authenticated && !sessionExpired;
  const reviewer = authenticated && !conflicted && session.roles.includes("reviewer");
  const assignedOwner = authenticated && !conflicted && session.roles.includes("action-owner") && brief?.action?.owner === session.subject;

  useEffect(() => {
    if (selected && evidence) {
      target.current?.focus();
      target.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
    }
  }, [selected, evidence]);

  const signInError = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("authError");
  const signInNotice = signInError ? SIGN_IN_ERRORS[signInError] ?? "Sign-in did not complete. Start again." : null;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("brief");
    if (!id) return;
    if (!authenticated) {
      setError(sessionExpired ? recoveryMessage(new ApiAuthError("expired")) : "Saved briefs require a verified SSO session to reopen. The record has not been deleted.");
      return;
    }
    const ctl = new AbortController();
    setError("");
    api.defenseBrief(id, ctl.signal).then((saved) => {
      if (!ctl.signal.aborted) { setBrief(saved); setEvidence(null); setSelected(null); setConflicted(false); }
    }).catch((e) => {
      if (!ctl.signal.aborted && !isAbortError(e)) {
        setError(recoveryMessage(e));
        if (e instanceof ApiAuthError) setSessionExpired(true);
      }
    });
    return () => ctl.abort();
  }, [authenticated, reopen, sessionExpired]);

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
    } catch (e) {
      if (alive.current) {
        if (e instanceof ApiAuthError) setSessionExpired(true);
        if (e instanceof ApiError && e.status === 409) setConflicted(true);
        setError(recoveryMessage(e));
      }
    }
    finally { if (alive.current) setBusy(false); }
  };

  return (
    <section className="rounded-lg border p-4 sm:p-5" style={card} aria-label="Programme verification brief">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p role="status" className="text-sm font-medium" style={{ color: "var(--cursor)" }}>{busy ? "Saving…" : briefStage(brief, Boolean(run))}</p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: "var(--text-strong)" }}>{brief?.title ?? "Prepare a cited verification brief"}</h2>
        </div>
        <button className={control} style={card} disabled={busy || !run || Boolean(brief)}
          onClick={() => { if (run) void update(() => api.draftDefenseBrief(run.runId)); }}>{busy ? "Saving…" : "Draft cited brief"}</button>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {session.error ?? (authenticated
          ? <p>Verified subject: <span className="mono break-all">{session.subject}</span>. Assigned roles: {session.roles.join(", ")}.</p>
          : session.configured
            ? <p>Sign in with an approved SSO account to review, decide, and own actions. Public/synthetic drafts remain available without it.</p>
            : <p>OIDC is not configured. Public/synthetic drafts are available, but review, simulation, and action updates are disabled.</p>)}
        {!authenticated && session.configured && (
          <a className={control} style={{ ...card, display: "inline-block", textDecoration: "none" }}
            href={`/api/auth/login?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/defense" : window.location.pathname + window.location.search)}`}>
            Sign in to review
          </a>
        )}
        {authenticated && (
          <a className={control} style={{ ...card, display: "inline-block", textDecoration: "none" }} href="/api/auth/logout">
            Sign out
          </a>
        )}
        {signInNotice && <p role="alert">{signInNotice}</p>}
      </div>
      {!brief && <p className="mt-2 text-sm">{run ? "The analysis is ready. Draft a brief from the captured evidence for reviewer verification." : "Analyze exposure first to enable drafting."} Briefs are deterministic and make no production-loss prediction.</p>}
      {brief?.status === "rejected" && <p className="mt-3 text-sm">This brief was rejected. Check the review note, then rerun the exposure question to prepare a new brief. The rejected record is retained.</p>}
      {brief && !busy && <p className="mt-2 text-sm" role="status">Saved case. Bookmark this page to reopen it with an authorized session.</p>}
      {error && <div className="mt-3 space-y-2 text-sm">
        <p role="alert">{error}</p>
        {authenticated && <button className={control} style={card} disabled={busy} onClick={() => setReopen((value) => value + 1)}>Reload saved case</button>}
      </div>}
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
              <div className="mt-2 flex flex-wrap gap-2">
                {claim.citations.map((citation, citationIndex) => <button key={citationIndex} className={control} style={card}
                  disabled={busy || !authenticated} onClick={async () => {
                    setBusy(true); setError("");
                    try {
                      const captured = await api.defenseEvidence(brief.id);
                      const match = validateCitation(brief, captured, citation);
                      if (alive.current) { setEvidence(captured); setSelected({ row: match.row, column: match.column }); }
                    } catch (e) {
                      if (alive.current) {
                        setEvidence(null); setSelected(null);
                        if (e instanceof ApiAuthError) setSessionExpired(true);
                        setError(e instanceof Error && !("status" in e) ? e.message : recoveryMessage(e));
                      }
                    } finally { if (alive.current) setBusy(false); }
                  }}>Inspect row {citation.row + 1}, {citation.column}</button>)}
              </div>
            </li>)}
          </ol>
          {!brief.claims.length && <p className="text-sm">No rows were captured. This is not evidence of no exposure.</p>}
          <div>
            <h3 className="text-sm font-semibold">Known gaps</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{brief.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
          </div>
          <p className="text-sm leading-relaxed"><strong>Next verification:</strong> {brief.recommendedAction}</p>
          {!authenticated && <p className="text-sm">Sign in with case access to inspect citations and full evidence.</p>}
          {evidence && selected && <div ref={target} tabIndex={-1} className="rounded-lg border p-4" style={{ borderColor: "var(--cursor)" }} aria-label={`Captured evidence row ${selected.row + 1}, ${selected.column}`}>
            <p role="status" className="text-sm font-semibold">Selected captured row {selected.row + 1}: {selected.column}</p>
            <dl className="mt-3 space-y-2">{evidence.columns.map((column) => <div key={column} className="break-words text-sm">
              <dt className="font-semibold">{column}{column === selected.column ? " (cited)" : ""}</dt>
              <dd>{String(evidence.rows[selected.row][column] ?? "Not recorded")}</dd>
            </div>)}</dl>
            <p className="mt-3 text-sm">This is the stored capture, not a new graph query.</p>
          </div>}
          {evidence && <details className="text-sm"><summary className="cursor-pointer">Full captured evidence and provenance</summary><pre className="mono mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs" tabIndex={0} aria-label="Full brief evidence">{JSON.stringify(evidence, null, 2)}</pre></details>}
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
              {!reviewer && <p className="text-sm">{conflicted ? "Reload the saved case to re-enable review controls." : "Review controls require a signed-in account with the reviewer role."}</p>}
              <p className="text-xs">Approval authorizes the verification step, not an operational intervention or automatic email.</p>
            </div>
          )}
          {brief.review && <p className="break-words text-sm">Reviewed by {brief.review.subject} at {new Date(brief.review.at).toLocaleString()}: {brief.review.note || "No note recorded."}</p>}
          {brief.status === "approved" && !brief.action && <div className="space-y-3">
            {!reviewer && <p className="text-sm">A signed-in reviewer must assign this verification action.</p>}
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
            {!assignedOwner && brief.action.status !== "completed" && <p className="text-sm">Only the assigned owner, signed in with the action-owner role, can acknowledge this action or record its outcome.</p>}
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
