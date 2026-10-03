"use client";

import { useEffect, useState } from "react";
import { api, isAbortError, recoveryMessage, type DefenseSession } from "../lib/api";
import { workspaceFocus } from "../lib/workspace";
import DefenseCases from "./DefenseCases";

const card = { borderColor: "var(--rule)", background: "var(--panel)" };
export default function DefenseWorkspace({ initialSession }: { initialSession: DefenseSession }) {
  const [session, setSession] = useState(initialSession);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    api.defenseSession(ctl.signal).then((value) => { if (!ctl.signal.aborted) setSession(value); })
      .catch((e) => { if (!ctl.signal.aborted && !isAbortError(e)) setSession({ ...initialSession, authenticated: false, roles: [], error: recoveryMessage(e) }); });
    return () => ctl.abort();
  }, [initialSession, retry]);
  const focus = workspaceFocus(session);
  return <div className="space-y-6">
    <section className="rounded-xl border p-5 sm:p-7" style={card} aria-label="Workspace next action">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>{session.authenticated ? "Your team workspace" : "Explore the sample workspace"}</p>
      <h2 className="mt-3 text-2xl font-semibold">{session.authenticated ? focus.title : "From a disruption to a responsible next step."}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed">{session.authenticated ? focus.description : "Explore an illustrative gallium investigation, inspect its evidence, and see how a verification moves from analyst to reviewer to owner. Sample data is synthetic; private buyer onboarding is a separate agreement."}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {(!session.authenticated || session.roles.some((role) => role === "analyst" || role === "reviewer")) && <a className="coarse-target rounded-lg border px-4 py-3 text-sm font-medium" style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }} href="/defense?mode=investigate&scenario=gallium-chain">{session.authenticated ? "Start a separate investigation" : "Explore the gallium sample"}</a>}
        {!session.authenticated && session.configured && <a className="coarse-target rounded-lg border px-4 py-3 text-sm" style={card} href="/api/auth/login?returnTo=%2Fdefense">Sign in to your work</a>}
        <a className="coarse-target rounded-lg border px-4 py-3 text-sm" style={card} href="/pilot">Scope a private pilot</a>
        {session.authenticated && <a className="coarse-target px-3 py-3 text-sm underline" href="/api/auth/logout">Sign out</a>}
      </div>
      {session.error && <p role="alert" className="mt-3 text-sm">{session.error}</p>}
      {!session.authenticated && !session.configured && !session.error && <p className="mt-3 text-sm">Team sign-in is not configured on this deployment. Sample analysis is available; saving and reviewing cases requires SSO.</p>}
      <button className="mt-3 text-sm underline" onClick={() => setRetry((value) => value + 1)}>Refresh workspace connection</button>
    </section>
    {session.authenticated ? <DefenseCases key={`${session.subject}-${focus.filter}`} session={session} initialFilter={focus.filter} /> : <section className="grid gap-4 md:grid-cols-3" aria-label="Team workflow">
      {[ ["Analyst", "Investigate", "Trace captured dependencies, identify gaps, and prepare a brief."], ["Reviewer", "Decide and assign", "Inspect citations, approve or reject verification, and name an owner."], ["Owner", "Verify and report", "Acknowledge the task and return findings with a recorded outcome."] ].map(([role, title, text]) => <article key={role} className="rounded-lg border p-5" style={card}><p className="text-xs uppercase tracking-wide" style={{ color: "var(--cursor)" }}>{role}</p><h3 className="mt-3 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed">{text}</p></article>)}
    </section>}
    <p className="text-sm leading-relaxed">Current scope: public/synthetic evidence and local-demo authorization. No live disruption monitoring, customer tenancy, or independently verified operational effect is claimed.</p>
  </div>;
}
