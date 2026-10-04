"use client";

import { useEffect, useState } from "react";
import { api, isAbortError, recoveryMessage, type DefenseSession } from "../lib/api";
import { workspaceFocus } from "../lib/workspace";
import DefenseCases from "./DefenseCases";

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
  const btn = "coarse-target rounded-lg border px-4 py-3 text-sm";
  const accent = { borderColor: "var(--cursor)", color: "var(--cursor)" };
  const paths = [
    { n: "01", title: "Try the guided team exercise", text: "Four roles, one verification.", href: "/defense?mode=onboarding" },
    ...((!session.authenticated || session.roles.some((role) => role === "analyst" || role === "reviewer"))
      ? [{ n: "02", title: session.authenticated ? "Start a separate investigation" : "Explore the gallium sample", text: "Trace one captured chain.", href: "/defense?mode=investigate&scenario=gallium-chain" }]
      : []),
    { n: "03", title: "Stress-test the controls", text: "Try to skip or fake a decision.", href: "/defense/lab" },
    { n: "04", title: "Scope a private pilot", text: "Two weeks, one question.", href: "/pilot" },
  ];
  return <div className="space-y-14">
    <section aria-label="Workspace next action">
      <p className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--cursor)" }}>{session.authenticated ? "Your team workspace" : "Explore the sample workspace"}</p>
      <h2 className="mt-3 max-w-3xl text-[clamp(1.5rem,3.2vw,2.25rem)] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-strong)" }}>{session.authenticated ? focus.title : "What could be exposed, and who will check?"}</h2>
      <p className="mt-4 max-w-2xl text-base leading-relaxed">{session.authenticated ? focus.description : "If gallium supply is delayed, which modeled dependencies justify checking inventory, alternatives and timing? Follow one verification from analyst to reviewer to owner. Sample data is synthetic."}</p>
      {!session.authenticated && <p className="mt-6"><a className="coarse-target inline-block rounded-lg border px-5 py-3 text-sm font-medium" style={accent} href="/defense/stories">Read the stories →</a> <a className="coarse-target ml-3 inline-block px-3 py-3 text-sm underline underline-offset-4" href="/defense/demo">Watch the two-minute demo</a></p>}
      {session.authenticated ? <div className="mt-6 flex flex-wrap items-center gap-3">
        {paths.map((path) => <a key={path.n} className={`${btn} font-medium`} style={accent} href={path.href}>{path.title}</a>)}
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
      {!session.authenticated && !session.configured && !session.error && <p className="mt-5 text-xs" style={{ color: "var(--text-faint)" }}>Team sign-in is not configured on this deployment. Sample analysis is available; saving and reviewing cases requires SSO.</p>}
      <button className="mt-2 text-xs underline" style={{ color: "var(--text-faint)" }} onClick={() => setRetry((value) => value + 1)}>Refresh workspace connection</button>
    </section>
    {session.authenticated ? <DefenseCases key={`${session.subject}-${focus.filter}`} session={session} initialFilter={focus.filter} /> : <section aria-label="Team workflow">
      <ol className="role-flow">
        {[ ["Analyst", "Investigate", "Trace captured dependencies, identify gaps, and prepare a brief."], ["Reviewer", "Decide and assign", "Inspect citations, approve or reject verification, and name an owner."], ["Owner", "Verify and report", "Acknowledge the task and return findings with a recorded outcome."] ].map(([role, title, text], index) => <li key={role}>
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>{String(index + 1).padStart(2, "0")} · {role}</p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>{title}</h3>
          <p className="mt-2 text-sm leading-relaxed">{text}</p>
        </li>)}
      </ol>
    </section>}
    <p className="max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>Current scope: public/synthetic evidence and local-demo authorization. No live disruption monitoring, customer tenancy, or independently verified operational effect is claimed.</p>
  </div>;
}
