"use client";

import { useEffect, useState } from "react";
import type { PipelineLine } from "../lib/derive";

/** detect → retrieve → reason → draft. Plays once per case, then settles to a strip. */
export default function AgentBeat({ id, lines }: { id: string; lines: PipelineLine[] }) {
  const [shown, setShown] = useState(0);
  const [settled, setSettled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(lines.length);
      setSettled(true);
      setOpen(true);
      return;
    }
    setShown(0);
    setSettled(false);
    setOpen(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((_, i) => {
      timers.push(setTimeout(() => setShown(i + 1), 240 * (i + 1)));
    });
    timers.push(
      setTimeout(() => {
        setSettled(true);
        setOpen(false);
      }, 240 * (lines.length + 2))
    );
    return () => timers.forEach(clearTimeout);
  }, [id, lines.length]);

  if (!lines.length) return null;

  if (settled && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mono w-full rounded-lg border px-3 py-2 text-left text-xs"
        style={{ borderColor: "var(--rule)", color: "var(--text-body)", background: "var(--panel)" }}
        aria-expanded={false}
      >
        {lines.map((l) => l.phase).join(" → ")}
      </button>
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
      {settled && (
        <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs underline" style={{ color: "var(--cursor)" }}>
          collapse
        </button>
      )}
    </div>
  );
}
