"use client";

import Link from "next/link";
import { CASES, type CaseId } from "../lib/cases";

export default function CaseList({ onOpen }: { onOpen?: () => void }) {
  return (
    <ul className="mx-auto mt-10 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-2">
      {CASES.map((c) => (
        <li key={c.id}>
          <Link
            href={c.href}
            prefetch
            transitionTypes={["nav-forward"]}
            onClick={onOpen}
            className="group block rounded-lg border p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
            style={{ borderColor: "var(--rule)", background: "color-mix(in oklch, var(--panel) 78%, transparent)" }}
          >
            <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>
              {c.kind}
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>
              {c.name}
            </h3>
            <p className="mono mt-1 text-xs" style={{ color: "var(--text-body)" }}>
              {c.place}
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
              {c.blurb}
            </p>
            <p className="mono mt-3 text-xs uppercase tracking-wider opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ color: "var(--cursor)" }}>
              Enter →
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CaseSwitch({
  current,
  compact,
  onSwitch,
}: {
  current: CaseId | null;
  compact?: boolean;
  onSwitch: (id: CaseId) => void;
}) {
  return (
    <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--rule)" }} aria-label="Cases">
      {CASES.map((c) => {
        const on = current === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSwitch(c.id)}
            aria-pressed={on}
            title={c.name}
            className="rounded-md px-3 py-1.5 text-sm transition-colors"
            style={on ? { background: "var(--rule)", color: "var(--text-strong)" } : { color: "var(--text-body)" }}
          >
            <span className="hidden sm:inline">{c.name}</span>
            <span className="sm:hidden">{c.short}</span>
          </button>
        );
      })}
    </div>
  );
}
