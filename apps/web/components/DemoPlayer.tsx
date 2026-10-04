"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api, type GraphRun, type LabResult } from "../lib/api";
import RunTrace from "./RunTrace";
import StatePill from "./StatePill";

const STEP_MS = 420;
const DWELL_MS = 11000;
const LAB_IDS = ["happy-path", "self-approval", "tampered-evidence", "tampered-audit"] as const;

const SCENES = [
  { n: "01", title: "Ask one question", caption: "A gallium supply delay. Which modeled dependencies justify a check? The graph answers from a pinned version, and shows how." },
  { n: "02", title: "Hand it across four roles", caption: "Analyst drafts. Reviewer approves and assigns. Owner acknowledges and reports. Reviewer accepts. Every step is a recorded decision." },
  { n: "03", title: "Try to cheat it", caption: "The person who wrote the brief tries to approve it. Someone edits the evidence after the fact. Both are refused." },
  { n: "04", title: "Prove nothing was rewritten", caption: "Each audit entry commits to the one before it, so rewriting history shows up at the exact entry." },
] as const;

function Steps({ result }: { result?: LabResult }) {
  if (!result) return <p role="status" className="text-sm">Loading…</p>;
  return <>
    <ol className="lab-steps" aria-live="polite">
      {result.steps.map((step, index) => <li key={index} style={{ animationDelay: `${index * STEP_MS}ms` } as CSSProperties}>
        <span>{step.label}</span><StatePill state={step.outcome} /><small>{step.detail}</small>
      </li>)}
    </ol>
    <p className="lab-verdict mt-4" style={{ animation: "lab-in 360ms var(--ease-expo) both", animationDelay: `${result.steps.length * STEP_MS}ms` } as CSSProperties}>{result.verdict}</p>
  </>;
}

export default function DemoPlayer() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState<GraphRun | null>(null);
  const [runError, setRunError] = useState(false);
  const [labs, setLabs] = useState<Record<string, LabResult>>({});
  const [loadKey, setLoadKey] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setRunError(false);
    api.runScenario("gallium-chain").then((value) => { if (alive.current) setRun(value); }).catch(() => { if (alive.current) setRunError(true); });
    for (const id of LAB_IDS) api.runLab(id).then((value) => { if (alive.current) setLabs((previous) => ({ ...previous, [id]: value })); }).catch(() => undefined);
    return () => { alive.current = false; };
  }, [loadKey]);

  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => {
      if (scene < SCENES.length - 1) setScene(scene + 1); else setPlaying(false);
    }, DWELL_MS);
    return () => clearTimeout(timer);
  }, [scene, playing]);

  const restart = () => { setScene(0); setPlaying(true); setRun(null); setLabs({}); setLoadKey((value) => value + 1); };
  const btn = "coarse-target rounded-lg border px-3 py-2 text-sm";
  const current = SCENES[scene];

  return <section aria-label="Guided demo" className="space-y-8">
    <ol className="demo-track" aria-label="Demo steps">
      {SCENES.map((item, index) => <li key={item.n} data-state={index < scene ? "done" : index === scene ? "active" : "todo"}>
        <button onClick={() => { setScene(index); setPlaying(false); }} aria-current={index === scene ? "step" : undefined}>
          <span className="mono">{item.n}</span> {item.title}
        </button>
        <span className="demo-bar" aria-hidden><i key={`${scene}-${playing}`} style={{ animationDuration: `${DWELL_MS}ms`, animationPlayState: playing && index === scene ? "running" : "paused" }} /></span>
      </li>)}
    </ol>
    <div>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: "var(--text-strong)" }}>{current.title}</h2>
      <p className="mt-3 max-w-3xl text-base leading-relaxed" role="status">{current.caption}</p>
    </div>
    <div key={scene} className="enter min-h-[18rem]">
      {scene === 0 && (run ? <RunTrace run={run} busy={false} /> : runError
        ? <p role="alert" className="text-sm">The analysis service is not reachable, so the live trace cannot be shown. The other steps still work.</p>
        : <p role="status" className="text-sm">Querying the graph…</p>)}
      {scene === 1 && <Steps result={labs["happy-path"]} />}
      {scene === 2 && <div className="grid gap-8 md:grid-cols-2">
        <div><p className="mono lab-num mb-2">Self-approval</p><Steps result={labs["self-approval"]} /></div>
        <div><p className="mono lab-num mb-2">Edited evidence</p><Steps result={labs["tampered-evidence"]} /></div>
      </div>}
      {scene === 3 && <Steps result={labs["tampered-audit"]} />}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button className={btn} style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }} onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button>
      <button className={btn} style={{ borderColor: "var(--rule)" }} disabled={scene === 0} onClick={() => { setScene(scene - 1); setPlaying(false); }}>Back</button>
      <button className={btn} style={{ borderColor: "var(--rule)" }} disabled={scene === SCENES.length - 1} onClick={() => { setScene(scene + 1); setPlaying(false); }}>Next</button>
      <button className={btn} style={{ borderColor: "var(--rule)" }} onClick={restart}>Restart</button>
      <a className="text-sm underline underline-offset-4" href="/defense/lab">Open the full lab</a>
      <a className="text-sm underline underline-offset-4" href="/defense?mode=investigate&scenario=gallium-chain">Run it yourself</a>
    </div>
  </section>;
}
