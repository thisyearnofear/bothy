"use client";

import { useEffect, useState } from "react";
import type { PipelineLine } from "../lib/derive";
import Inspector from "./Inspector";

/** detect → retrieve → reason → draft. Plays once per case, then settles to a strip. */
export default function AgentBeat({ id, lines }: { id: string; lines: PipelineLine[] }) {
  const [shown, setShown] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(lines.length);
      setSettled(true);
      return;
    }
    setShown(0);
    setSettled(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((_, i) => {
      timers.push(setTimeout(() => setShown(i + 1), 240 * (i + 1)));
    });
    timers.push(
      setTimeout(() => {
        setSettled(true);
      }, 240 * (lines.length + 2))
    );
    return () => timers.forEach(clearTimeout);
  }, [id, lines.length]);

  if (!lines.length) return null;
  const retrieve = lines.find((l) => l.phase === "retrieve");

  if (settled) {
    return (
      <div className="card p-3"><p className="docref">{lines.map((l) => l.phase).join(" → ")}</p>
        {retrieve && <p className="hint mt-2">{retrieve.text}</p>}
        <Inspector label="Inspect agent loop" title="Agent loop"><ol className="reference-list">{lines.map((line) => <li key={line.phase}><span className="eyebrow">{line.phase}</span><p>{line.text}</p></li>)}</ol></Inspector>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-live="polite">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
        Agent loop
      </p>
      <ol className="mt-2 space-y-1.5">
        {lines.slice(0, shown).map((l) => (
          <li key={l.phase} className="pin-in text-sm leading-snug" style={{ color: "var(--text-body)" }}>
            <span className="mono mr-2 text-xs uppercase tracking-wider" style={{ color: "var(--cursor)" }}>
              {l.phase}
            </span>
            {l.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
