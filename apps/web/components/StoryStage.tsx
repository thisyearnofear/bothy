"use client";

import { useEffect, useState } from "react";
import { api, type GraphRun } from "../lib/api";
import { clockDays, type Story } from "../lib/stories";
import LaneMap from "./LaneMap";
import ReviewerDesk from "./ReviewerDesk";
import RunTrace from "./RunTrace";

const BEAT_MS = 8000;

const AFTER_ACTION = [
  ["Who decided this was worth checking?", "A named reviewer, with a note and a timestamp."],
  ["On what evidence?", "The stored rows the brief cites, bound to a hash. A silent edit is refused."],
  ["Who was told to verify, and by when?", "One assigned owner with a due date. No one else can acknowledge it."],
  ["Did anyone alter the record afterwards?", "The audit chain names the first entry that no longer matches."],
] as const;

export default function StoryStage({ story, autoplay = false }: { story: Story; autoplay?: boolean }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [now, setNow] = useState<number | null>(null);
  const [run, setRun] = useState<GraphRun | null>(null);
  const [runError, setRunError] = useState(false);
  const [retry, setRetry] = useState(0);
  const beat = story.beats[index];
  const last = story.beats.length - 1;
  const days = now === null ? null : clockDays(beat, now);

  useEffect(() => { setNow(Date.now()); }, []);

  useEffect(() => {
    let alive = true;
    setRunError(false);
    api.runScenario(story.scenarioId).then((value) => { if (alive) setRun(value); }).catch(() => { if (alive) setRunError(true); });
    return () => { alive = false; };
  }, [story.scenarioId, retry]);

  useEffect(() => {
    if (!playing || index >= last) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setIndex(index + 1), BEAT_MS);
    return () => clearTimeout(timer);
  }, [playing, index, last]);

  const go = (next: number) => { setIndex(Math.max(0, Math.min(last, next))); setPlaying(false); };
  const play = () => { if (index >= last) setIndex(0); setPlaying(true); };
  const counts = story.scenarioId === "red-sea-d01" && run
    ? run.rows.map((row) => ({ label: String(row["s.status"] ?? ""), value: String(row["count(s)"] ?? "") })) : undefined;
  const btn = "btn";

  return <div className="space-y-12">
    <div className="scrub" role="group" aria-label="Story timeline">
      <div className="scrub-thumbrow" aria-hidden="true"><span className="scrub-thumb" style={{ left: `calc(${(index / last) * 100}% + ${0.55 - (index / last) * 1.1}rem)`, transform: `translateX(-${(index / last) * 100}%)` }}>{beat.label}</span></div>
      <input type="range" min={0} max={last} step={1} value={index} onChange={(e) => go(Number(e.target.value))}
        aria-label="Date in the story" aria-valuetext={beat.label} style={{ "--p": `${(index / last) * 100}%` } as React.CSSProperties} />
      <ol className="scrub-ticks">
        {story.beats.map((item, i) => <li key={item.label} data-state={i === index ? "active" : i < index ? "done" : "todo"}>
          <button onClick={() => go(i)} aria-current={i === index ? "step" : undefined}>{item.label}</button>
        </li>)}
      </ol>
      <div className="scrub-controls">
        <button className={`${btn} btn-primary`} onClick={() => (playing ? setPlaying(false) : play())}>{playing ? "Pause" : "Play story"}</button>
        <button className={btn} disabled={index === 0} onClick={() => { setIndex(0); setPlaying(false); }}>Back to start</button>
        <span className="hint" aria-hidden="true">Step {index + 1} of {story.beats.length} · drag the date or use ← → keys</span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{`Step ${index + 1} of ${story.beats.length}: ${beat.label}`}</p>
    </div>

    <div key={index} className="beat enter">
      <div>
        <p className="mono story-date">{beat.label}{beat.act ? " · your desk" : ""}</p>
        <p className="beat-narration">{beat.narration}</p>
        {beat.event && <p className="beat-event">{beat.event.text} <a className="underline underline-offset-4" href={beat.event.source.url} rel="noreferrer noopener" target="_blank">{beat.event.source.name}</a></p>}
      </div>
      {beat.clock && days !== null && <div className="story-clock" role="status">
        <span className="story-days">{Math.abs(days)}</span>
        <span><b>{days < 0 ? "days since" : "days"}</b><br />{beat.clock.label}</span>
      </div>}
    </div>

    {beat.map && <LaneMap state={beat.map} counts={beat.act ? counts : undefined} />}

    {beat.act && <div className="space-y-12">
      <section className="space-y-4" aria-label="The question">
        <p className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--cursor)" }}>The question on your desk</p>
        <blockquote className="story-question">{story.question}</blockquote>
      </section>
      <section className="space-y-4" aria-label="What the record shows">
        <p className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--cursor)" }}>What Bothy puts in front of you</p>
        <p className="max-w-2xl text-sm">{story.recordNote} A live query against the demo graph.</p>
        {run ? <RunTrace run={run} busy={false} /> : runError
          ? <div role="alert" className="text-sm"><p>The analysis service is not reachable right now.</p><button className="mt-2 underline" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
          : <p role="status" className="text-sm">Querying the graph…</p>}
      </section>
      {run && <section className="space-y-4" aria-label="Your desk">
        <p className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--cursor)" }}>You are the reviewer</p>
        <p className="max-w-2xl text-sm">Each click runs the real approval, ownership and audit rules in a private sandbox that holds only this session.</p>
        <ReviewerDesk runId={run.runId} auto={autoplay && playing} />
      </section>}
      <section className="space-y-4" aria-label="After-action questions">
        <p className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--cursor)" }}>The questions an after-action review asks</p>
        <dl className="story-qa">{AFTER_ACTION.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}</dl>
      </section>
    </div>}

    {!beat.act && <p className="text-sm" style={{ color: "var(--text-faint)" }}>Drag the date to {story.beats[last].label.toLowerCase() === "today" ? "today" : story.beats[last].label} to open your desk.</p>}

    <aside className="story-caveat" aria-label="What this does not show">
      <p><strong>What this does not show.</strong> Bothy did not exist during these events. This is the record it would produce, not evidence it would have changed an outcome. {story.caveat}</p>
    </aside>
  </div>;
}
