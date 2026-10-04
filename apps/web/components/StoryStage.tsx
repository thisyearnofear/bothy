"use client";

import { useEffect, useState } from "react";
import { api, type GraphRun } from "../lib/api";
import { clockDays, type Story } from "../lib/stories";
import { BEAT_MS, playbackSeconds } from "../lib/storyPlayback";
import { useStoryPlayback } from "../lib/useStoryPlayback";
import LaneMap from "./LaneMap";
import ReviewerDesk from "./ReviewerDesk";
import RunTrace from "./RunTrace";
import Inspector from "./Inspector";
import LensTabs from "./LensTabs";
import StoryVisual from "./StoryVisual";

const AFTER_ACTION = [
  ["Who decided this was worth checking?", "A named reviewer, with a note and a timestamp."],
  ["On what evidence?", "The stored rows the brief cites, bound to a hash. A silent edit is refused."],
  ["Who was told to verify, and by when?", "One assigned owner with a due date. No one else can acknowledge it."],
  ["Did anyone alter the record afterwards?", "The audit chain names the first entry that no longer matches."],
] as const;

export default function StoryStage({ story, autoplay = false }: { story: Story; autoplay?: boolean }) {
  const last = story.beats.length - 1;
  const { index, playing, remaining, finished, go, pause, play, reset, complete } = useStoryPlayback(last, autoplay);
  const [now, setNow] = useState<number | null>(null);
  const [run, setRun] = useState<GraphRun | null>(null);
  const [runError, setRunError] = useState(false);
  const [retry, setRetry] = useState(0);
  const beat = story.beats[index];
  const guidedFinal = Boolean(autoplay && beat.act);
  const days = now === null ? null : clockDays(beat, now);

  useEffect(() => {
    setNow(Date.now());
  }, [autoplay]);

  useEffect(() => {
    let alive = true;
    setRunError(false);
    api.runScenario(story.scenarioId).then((value) => { if (alive) setRun(value); }).catch(() => { if (alive) setRunError(true); });
    return () => { alive = false; };
  }, [story.scenarioId, retry]);

  const counts = story.scenarioId === "red-sea-d01" && run
    ? run.rows.map((row) => ({ label: String(row["s.status"] ?? ""), value: String(row["count(s)"] ?? "") })) : undefined;
  const btn = "btn";

  return <div className={`story-stage space-y-8 ${autoplay ? "guided-story" : ""}`}>
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
        <button className={`${btn} btn-primary`} onClick={() => (playing ? pause() : play())}>{playing ? "Pause" : finished ? "Replay story" : "Play story"}</button>
        <button className={btn} disabled={index === 0 && !playing && remaining === BEAT_MS} onClick={reset}>Back to start</button>
        {index < last ? <div className="beat-countdown" aria-label="Time until the next story beat">
          <svg viewBox="0 0 36 36" aria-hidden="true"><circle className="countdown-track" cx="18" cy="18" r="15" /><circle className="countdown-ink" cx="18" cy="18" r="15" pathLength="1" strokeDasharray={`${remaining / BEAT_MS} 1`} /><text x="18" y="22">{playbackSeconds(remaining)}</text></svg>
          <span><strong>{playing ? "Next" : "Paused"}: {story.beats[index + 1].heading}</strong><small>{playing ? "Advances" : "Resumes"} in {playbackSeconds(remaining)}s</small></span>
        </div> : <p className="playback-state">{finished ? "Walkthrough complete · explore or replay" : autoplay ? !run ? runError ? "Analysis unavailable · retry below" : "Waiting for graph capture" : playing ? "Reviewer demonstration running" : "Reviewer demonstration paused" : "Final beat · explore your desk"}</p>}
        <span className="hint" aria-hidden="true">Step {index + 1} of {story.beats.length} · drag the date or use ← → keys</span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{`Step ${index + 1} of ${story.beats.length}: ${beat.label}`}</p>
    </div>

    <div key={index} className={`story-slide ${guidedFinal ? "final-slide" : beat.map ? "map-slide" : ""}`}>
      <div className={guidedFinal ? "final-briefing" : undefined}>
        <div>
        <p className="docref">File BTH-{story.slug.toUpperCase().slice(0, 8)}-{String(index + 1).padStart(2, "0")} · {beat.label}{beat.act ? " · tasking" : ""}</p>
        <h2 className="slide-heading">{beat.heading}</h2>
        <p className="beat-narration">{guidedFinal ? story.question : autoplay ? beat.briefing ?? beat.narration : beat.narration}</p>
        {beat.event && <div className="source-note mt-4"><span className="docref">Public source</span><a href={beat.event.source.url} rel="noreferrer noopener" target="_blank">{beat.event.source.name} ↗</a><Inspector label="Inspect source note" title={`${beat.label} / source note`} onOpen={pause}><p>{beat.event.text}</p><a className="btn mt-4" href={beat.event.source.url} rel="noreferrer noopener" target="_blank">Read the source ↗</a></Inspector></div>}
        </div>
        {guidedFinal && days !== null && <div className="final-policy-clock"><strong>{Math.abs(days)}</strong><span>{days < 0 ? "days since" : "days remaining"}<br />27 Nov 2026</span><small>US-specific suspension schedule, not a universal procurement deadline.</small></div>}
      </div>
      {guidedFinal ? <section aria-label="Reviewer demonstration"><div className="record-status"><span>Synthetic actors · disposable sandbox</span><span>Real decision rules</span><span>No saved cases changed</span></div><p className="hint my-3">Sandbox claims can fall back to fixture evidence. This is not a multi-user sign-in rehearsal.</p>{run ? <ReviewerDesk runId={run.runId} auto={playing} guided onPause={pause} onComplete={complete} /> : runError ? <div role="alert"><p>The analysis service is unavailable.</p><button className="btn" onClick={() => setRetry((value) => value + 1)}>Retry analysis</button></div> : <p role="status">Querying the demo graph…</p>}</section> : story.slug === "gallium" ? <StoryVisual beat={beat} index={index} days={days} run={run} /> : beat.map ? <LaneMap state={beat.map} counts={beat.act ? counts : undefined} /> : beat.clock && days !== null && <div className="story-clock" role="status">
        <span className="story-days">{Math.abs(days)}</span>
        <span><b>{days < 0 ? "days since" : "days"}</b><br />{beat.clock.label}</span>
      </div>}
    </div>

    {guidedFinal && run && <div className="capture-ribbon"><span className="docref">{run.rows.length} captured rows / {run.graphCommit ? `pinned ${run.graphCommit.slice(0, 8)}` : "not pinned"}</span><Inspector label="Inspect the captured dependency" title="Captured graph evidence" onOpen={pause}><p>{story.recordNote}</p><RunTrace run={run} busy={false} /></Inspector><Inspector label="Read the inspection guide" title="Four ways to read the record" onOpen={pause}><LensTabs label="After-action lenses" items={AFTER_ACTION.map(([q, a], index) => ({ id: String(index), label: ["Decision", "Evidence", "Owner", "Integrity"][index], content: <div className="review-lens"><h3>{q}</h3><p>{a}</p><p className="hint">A guide to inspection, not independent validation of an outcome.</p></div> }))} /></Inspector></div>}
    {beat.act && !autoplay && <div className="space-y-12">
      <section className="space-y-4" aria-label="The question">
        <p className="eyebrow">Tasking</p>
        <blockquote className="story-question">{story.question}</blockquote>
      </section>
      <section className="space-y-4" aria-label="What the record shows">
        <p className="eyebrow">Evidence on file</p>
        <p className="max-w-2xl text-sm">{story.recordNote} A live query against the demo graph.</p>
        {run ? <RunTrace run={run} busy={false} /> : runError
          ? <div role="alert" className="text-sm"><p>The analysis service is not reachable right now.</p><button className="mt-2 underline" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
          : <p role="status" className="text-sm">Querying the graph…</p>}
      </section>
      {run && <section className="space-y-4" aria-label="Your desk">
        <p className="eyebrow">Reviewer console</p>
        <div className="record-status"><span>Session sandbox · synthetic actors</span><span>Real decision rules</span><span>No saved cases changed</span></div>
        <p className="hint">Sandbox claims can fall back to fixture evidence. This is not a multi-user sign-in rehearsal.</p>
        <ReviewerDesk runId={run.runId} auto={false} onPause={pause} />
      </section>}
      <section aria-label="After-action questions">
        <p className="eyebrow mb-4">Four ways to read the record</p>
        <LensTabs label="After-action lenses" items={AFTER_ACTION.map(([q, a], index) => ({
          id: String(index), label: ["Decision", "Evidence", "Owner", "Integrity"][index],
          content: <div className="review-lens"><h3>{q}</h3><p>{a}</p><span className="hint">A guide to inspection, not independent validation of an outcome.</span></div>,
        }))} />
      </section>
    </div>}

    {!beat.act && <p className="text-sm" style={{ color: "var(--text-faint)" }}>Drag the date to {story.beats[last].label.toLowerCase() === "today" ? "today" : story.beats[last].label} to open your desk.</p>}

    <aside className="story-caveat" aria-label="What this does not show">
      <p><strong>Historical replay. Synthetic exposure.</strong> Bothy did not exist during these events; no changed outcome is claimed.</p>
      <p className="hint mt-3">{story.caveat}</p>
    </aside>
  </div>;
}
