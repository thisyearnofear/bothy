"use client";

import { useEffect, useRef, useState } from "react";
import type { GraphRun } from "../lib/api";

const STAGES = [["Platform", "p.name"], ["System", "s.name"], ["Subsystem", "ss.name"], ["Assembly", "a.name"], ["Subassembly", "sa.name"], ["Component", "c.name"], ["Material", "m.name"], ["Primary material", "g.name"]] as const;
const TICK_MS = 480;

export default function RunTrace({ run, busy }: { run: GraphRun | null; busy: boolean }) {
  const chain = run?.scenarioId === "gallium-chain" && run.rows.length > 0;
  const stages = chain ? STAGES.filter(([, column]) => typeof run.rows[0][column] === "string" && run.rows[0][column]) : [];
  const n = stages.length || 1;
  const end = 3 + n + 2;
  const [pos, setPos] = useState(0);
  const pipe = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!run) { setPos(0); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPos(end); return; }
    setPos(0);
    const timer = setInterval(() => setPos((value) => { if (value >= end) { clearInterval(timer); return value; } return value + 1; }), TICK_MS);
    return () => clearInterval(timer);
  }, [run?.runId, end]);

  const activeNode = chain && pos >= 3 && pos < 3 + n ? pos - 3 : -1;
  useEffect(() => {
    const node = activeNode >= 0 ? nodes.current[activeNode] : null;
    if (!node) { setCursor(null); return; }
    setCursor({ x: node.offsetLeft + node.offsetWidth - 34, y: node.offsetTop + node.offsetHeight / 2 - 4 });
  }, [activeNode]);

  if (!run) return busy ? <p role="status" className="text-sm">Querying the graph…</p> : null;

  const row = run.rows[0] ?? {};
  const steps: { show: boolean; done: boolean; label: string; detail: string }[] = [
    { show: pos >= 1, done: pos >= 2, label: "Connect to the graph", detail: run.graph },
    { show: pos >= 2, done: pos >= 3, label: "Pin the graph version", detail: run.graphCommit ?? "HEAD, not pinned" },
    { show: pos >= 3, done: pos >= 4, label: "Run the reviewed query", detail: `${run.count} row${run.count === 1 ? "" : "s"} · ${run.ms}ms` },
    { show: pos >= 4, done: pos >= 3 + n + 1, label: chain ? "Follow the dependency chain" : "Read the result rows", detail: chain ? `${stages.length} linked stages, first sample path` : `${Math.min(run.rows.length, 50)} captured` },
    { show: pos >= 3 + n + 1, done: pos >= end, label: "Hash the evidence", detail: `query ${run.queryHash.slice(0, 12)}` },
    { show: pos >= end, done: pos >= end, label: "Record what is not established", detail: "See the gaps below" },
  ];

  return <section className="trace rounded-lg border p-4 sm:p-5" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-label="How this analysis was produced">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Trace of the captured run</p>
      <span className="text-xs" style={{ color: "var(--text-faint)" }}>Replay of stored results, paced for reading</span>
    </div>
    <div className="trace-body">
      <ol className="trace-steps" aria-live="polite">
        {steps.filter((step) => step.show).map((step) => <li key={step.label}>
          <span className="pill" data-state={step.done ? "allowed" : "verified"} data-live={!step.done} style={{ minWidth: "5.5rem", justifyContent: "center" }}>{step.done ? "Done" : "Running"}</span>
          <span style={{ color: "var(--text-strong)" }}>{step.label}<small>{step.detail}</small></span>
        </li>)}
      </ol>
      {chain ? <div className="pipe" ref={pipe} aria-label="Dependency chain of the first captured path">
        {stages.map(([label, column], index) => {
          const state = pos - 3 > index ? "passed" : pos - 3 === index ? "active" : "inactive";
          return <div key={column} className="pipe-node" data-state={state} ref={(el) => { nodes.current[index] = el; }}>
            <i aria-hidden /><div className="min-w-0"><span>{label}</span><br /><b>{String(row[column])}</b></div>
          </div>;
        })}
        <svg className="agent-cursor" data-on={cursor ? "true" : "false"} viewBox="0 0 20 20" aria-hidden style={{ transform: cursor ? `translate(${cursor.x}px, ${cursor.y}px)` : undefined }}>
          <path d="M2 2 L2 16 L6 12 L9 18 L12 16.5 L9 11 L15 11 Z" fill="var(--cursor)" stroke="var(--page)" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </div> : null}
    </div>
  </section>;
}
