"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { api, type GraphRun, type LabResult } from "../lib/api";
import type { Story } from "../lib/stories";
import RunTrace from "./RunTrace";
import StatePill from "./StatePill";

const STEP_MS = 420;
const ROLE = /^(Analyst|Reviewer|Owner)/;

const AFTER_ACTION = [
  ["Who decided this was worth checking?", "A named reviewer, with a note and a timestamp."],
  ["On what evidence?", "The stored rows the brief cites, bound to a hash. A silent edit is refused."],
  ["Who was told to verify, and by when?", "One assigned owner with a due date. No one else can acknowledge it."],
  ["Did anyone alter the record afterwards?", "The audit chain names the first entry that no longer matches."],
] as const;

function Countdown({ date, label }: { date: string; label: string }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => { setDays(Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - Date.now()) / 86400000)); }, [date]);
  if (days === null) return <div className="story-clock" aria-hidden />;
  const past = days < 0;
  return <div className="story-clock" role="status">
    <span className="story-days">{Math.abs(days)}</span>
    <span><b>{past ? "days since" : "days until"}</b><br />{label}, {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</span>
  </div>;
}

export default function StoryView({ story }: { story: Story }) {
  const [run, setRun] = useState<GraphRun | null>(null);
  const [runError, setRunError] = useState(false);
  const [flow, setFlow] = useState<LabResult | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setRunError(false);
    api.runScenario(story.scenarioId).then((value) => { if (alive) setRun(value); }).catch(() => { if (alive) setRunError(true); });
    api.runLab("happy-path").then((value) => { if (alive) setFlow(value); }).catch(() => undefined);
    return () => { alive = false; };
  }, [story.scenarioId, retry]);

  const section = "space-y-5";
  const eyebrow = "mono text-xs uppercase tracking-[0.2em]";
  return <div className="space-y-16">
    {story.deadline && <Countdown date={story.deadline.date} label={story.deadline.label} />}

    <section className={section} aria-label="What happened">
      <p className={eyebrow} style={{ color: "var(--cursor)" }}>01 · What happened</p>
      <ol className="story-timeline">
        {story.events.map((event) => <li key={event.date}>
          <span className="mono story-date">{event.date}</span>
          <p>{event.text} <a className="underline underline-offset-4" href={event.source.url} rel="noreferrer noopener" target="_blank">{event.source.name}</a></p>
        </li>)}
      </ol>
    </section>

    <section className={section} aria-label="The question">
      <p className={eyebrow} style={{ color: "var(--cursor)" }}>02 · The question someone had to answer</p>
      <blockquote className="story-question">{story.question}</blockquote>
      <p className="max-w-2xl text-sm">{story.whoAsks}</p>
    </section>

    <section className={section} aria-label="What the record shows">
      <p className={eyebrow} style={{ color: "var(--cursor)" }}>03 · What Bothy puts in front of them</p>
      <p className="max-w-2xl text-sm">{story.recordNote} This is a live query against the demo graph.</p>
      {run ? <RunTrace run={run} busy={false} /> : runError
        ? <div role="alert" className="text-sm"><p>The analysis service is not reachable right now.</p><button className="mt-2 underline" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
        : <p role="status" className="text-sm">Querying the graph…</p>}
      {run?.scenarioId === "red-sea-d01" && run.rows.length > 0 && <ul className="story-counts" aria-label="Shipments by status">
        {run.rows.map((row, index) => <li key={index}><span className="story-days">{String(row["count(s)"] ?? "")}</span><span className="mono">{String(row["s.status"] ?? "")}</span></li>)}
      </ul>}
    </section>

    <section className={section} aria-label="Who owns the answer">
      <p className={eyebrow} style={{ color: "var(--cursor)" }}>04 · Who owns the answer</p>
      <p className="max-w-2xl text-sm">Each hand-off is a recorded decision by a different role. This run uses the real rules on a throwaway database.</p>
      {flow ? <ol className="lab-steps">
        {flow.steps.map((step, index) => <li key={index} style={{ animationDelay: `${index * STEP_MS}ms` } as CSSProperties}>
          <span>{ROLE.test(step.label) ? <><span className="mono" style={{ color: "var(--cursor)" }}>{step.label.match(ROLE)![0].toUpperCase()}</span>{step.label.replace(ROLE, "")}</> : step.label}</span>
          <StatePill state={step.outcome} /><small>{step.detail}</small>
        </li>)}
      </ol> : <p role="status" className="text-sm">Loading…</p>}
    </section>

    <section className={section} aria-label="After-action questions">
      <p className={eyebrow} style={{ color: "var(--cursor)" }}>05 · The questions an after-action review asks</p>
      <dl className="story-qa">
        {AFTER_ACTION.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}
      </dl>
      <p className="max-w-2xl text-sm"><a className="underline underline-offset-4" href="/defense/lab">Try to break these answers in the stress-test lab</a>.</p>
    </section>

    <aside className="story-caveat" aria-label="What this does not show">
      <p><strong>What this does not show.</strong> Bothy did not exist during these events. This is the record it would produce, not evidence it would have changed an outcome. {story.caveat}</p>
    </aside>
  </div>;
}
