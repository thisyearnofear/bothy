"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api, isAbortError, type LabResult, type LabScenario } from "../lib/api";
import StatePill from "./StatePill";

const STEP_MS = 420;

export default function StressLab() {
  const [scenarios, setScenarios] = useState<LabScenario[]>([]);
  const [results, setResults] = useState<Record<string, LabResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const ctl = new AbortController();
    api.labScenarios(ctl.signal).then((value) => { if (!ctl.signal.aborted) { setScenarios(value.scenarios); setError(""); } })
      .catch((e) => { if (!ctl.signal.aborted && !isAbortError(e)) setError("The lab could not reach the analysis service."); });
    return () => { alive.current = false; ctl.abort(); };
  }, [retry]);

  const run = async (id: string) => {
    setError("");
    setRunning(id);
    try {
      const result = await api.runLab(id);
      if (!alive.current) return;
      setResults((previous) => ({ ...previous, [id]: result }));
      await new Promise((resolve) => setTimeout(resolve, (result.steps.length + 1) * STEP_MS));
    } catch { if (alive.current) setError("A scenario could not be run. Try again."); }
    finally { if (alive.current) setRunning(null); }
  };

  const runAll = async () => { for (const scenario of scenarios) { if (!alive.current) return; await run(scenario.id); } };

  return <section aria-label="Stress-test lab" className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <p className="max-w-2xl text-sm leading-relaxed">Each button runs the real approval, ownership and audit rules against a throwaway database, then shows what they accepted and refused. Nothing here touches saved cases.</p>
      <button className="coarse-target rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-50" style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
        disabled={Boolean(running) || !scenarios.length} onClick={() => void runAll()}>{running ? "Running…" : "Run all six"}</button>
    </div>
    {error && <div role="alert" className="text-sm"><p>{error}</p><button className="mt-2 underline" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    <ul className="lab-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {scenarios.map((scenario) => {
        const result = results[scenario.id];
        return <li key={scenario.id} className="lab-card">
          <span className="mono lab-num" aria-hidden>{scenario.number}</span>
          <h3>{scenario.title}</h3>
          <p className="text-sm">{scenario.description}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="coarse-target rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--rule)" }}
              disabled={Boolean(running)} onClick={() => void run(scenario.id)}>{running === scenario.id ? "Running…" : result ? "Run again" : "Run"}</button>
            <span className="mono text-xs" style={{ color: "var(--text-faint)" }}>{scenario.expect}</span>
          </div>
          {result && <>
            <ol key={result.steps.map((s) => s.detail).join("|") + (running === scenario.id)} className="lab-steps" aria-live="polite">
              {result.steps.map((step, index) => <li key={index} style={{ animationDelay: `${index * STEP_MS}ms` } as CSSProperties}>
                <span>{step.label}</span><StatePill state={step.outcome} />
                <small>{step.detail}</small>
              </li>)}
            </ol>
            <p className="lab-verdict lab-steps" style={{ animation: "lab-in 360ms var(--ease-expo) both", animationDelay: `${result.steps.length * STEP_MS}ms`, display: "block" } as CSSProperties}>{result.verdict}</p>
          </>}
        </li>;
      })}
    </ul>
  </section>;
}
