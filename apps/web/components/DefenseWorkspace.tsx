"use client";

import { useEffect, useState } from "react";
import { api, isAbortError, recoveryMessage, type DefenseSession } from "../lib/api";
import { workspaceFocus } from "../lib/workspace";
import DefenseCases from "./DefenseCases";
import WorkflowStrip from "./WorkflowStrip";

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
  const btn = "btn btn-primary";
  const paths = [
    { n: "01", title: "Rehearse", text: "Four steps · synthetic exercise", href: "/defense?mode=onboarding" },
    ...((!session.authenticated || session.roles.some((role) => role === "analyst" || role === "reviewer"))
      ? [{ n: "02", title: "Investigate", text: "Gallium · trace a captured chain", href: "/defense?mode=investigate&scenario=gallium-chain" }]
      : []),
    { n: "03", title: "Challenge", text: "Lab · test the decision rules", href: "/defense/lab" },
    { n: "04", title: "Scope a pilot", text: "Two weeks · one question", href: "/pilot" },
  ];
  return <div className="space-y-14">
    <section aria-label="Workspace next action">
      <p className="docref">{session.authenticated ? "Operations workspace · your team" : "Operations workspace · sample data"}</p>
      <h2 className="mt-3 max-w-3xl text-[clamp(1.5rem,3.2vw,2.25rem)] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-strong)" }}>{session.authenticated ? focus.title : "Choose your next move."}</h2>
      {session.authenticated ? <p className="mt-4 max-w-2xl text-base leading-relaxed">{focus.description}</p> : <div className="record-status mt-4"><span>Synthetic evidence</span><span>Exposure ≠ stoppage</span><a className="underline" href="/defense/demo">Watch the gallium demo →</a></div>}
      {session.authenticated ? <div className="mt-6 flex flex-wrap items-center gap-3">
        {paths.map((path) => <a key={path.n} className={btn} href={path.href}>{path.title}</a>)}
        <a className="coarse-target px-3 py-3 text-sm underline" href="/api/auth/logout">Sign out</a>
      </div> : <ul className="path-grid mt-8">
        {paths.map((path) => <li key={path.n}><a href={path.href} className="path-tile">
          <span className="mono path-n" aria-hidden>{path.n}</span>
          <span className="path-title">{path.title}</span>
          <span className="path-text">{path.text}</span>
          <span className="mono path-go" aria-hidden>→</span>
        </a></li>)}
      </ul>}
      {!session.authenticated && session.configured && <p className="mt-5 text-sm"><a className="underline underline-offset-4" href="/api/auth/login?returnTo=%2Fdefense">Sign in to your work</a></p>}
      {session.error && <p role="alert" className="mt-3 text-sm">{session.error}</p>}
      {!session.authenticated && !session.configured && !session.error && <p className="hint mt-5">Sample analysis available. Saving and reviewing need SSO, not configured here.</p>}
      <button className="mt-2 text-xs underline" style={{ color: "var(--text-faint)" }} onClick={() => setRetry((value) => value + 1)}>Refresh workspace connection</button>
    </section>
    {session.authenticated ? <DefenseCases key={`${session.subject}-${focus.filter}`} session={session} initialFilter={focus.filter} /> : <section aria-label="Team workflow">
      <h3 className="eyebrow mb-5">One case. Named handoffs.</h3>
      <WorkflowStrip />
    </section>}
    <details className="disclosure"><summary>Demo boundary</summary><p>Public/synthetic evidence and demo authorization only. No live disruption monitoring, customer tenancy or independently verified operational effect.</p></details>
  </div>;
}
