"use client";

import { useState } from "react";

export interface ProviderHealth {
  id: string;
  label: string;
  model: string;
  outcome: string;
  status?: number;
  detail: string;
  latencyMs?: number;
}

export interface ChainHealth {
  at: string;
  providers: ProviderHealth[];
  firstOkIndex: number | null;
  fallbackEngaged: boolean;
  scriptedAvailable: boolean;
}

const OUTCOME_TONE: Record<string, { color: string; label: string }> = {
  ok: { color: "oklch(72% 0.16 155)", label: "ok" },
  "rate-limited": { color: "oklch(80% 0.14 85)", label: "429" },
  timeout: { color: "oklch(80% 0.14 85)", label: "timeout" },
  "http-error": { color: "oklch(64% 0.21 25)", label: "http" },
  "network-error": { color: "oklch(64% 0.21 25)", label: "down" },
};

/** Roadmap §1: live-LLM reliability surface. Probes the provider chain and
 *  rehearses the scripted fallback so a degraded demo is a boring failure. */
export default function ReliabilityPanel({
  health,
  rehearsing,
  onProbe,
  onRehearse,
}: {
  health: ChainHealth | null;
  rehearsing: boolean;
  onProbe: () => void;
  onRehearse: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!health) return null;
  const ok = health.firstOkIndex != null;
  const okProvider = ok ? health.providers[health.firstOkIndex as number] : null;
  const summary = ok && okProvider
    ? `live LLM ok · ${okProvider.id} responded`
    : "all providers down · scripted brain is the failsafe";

  return (
    <section
      className="mb-4 rounded-lg border px-4 py-3"
      style={{ borderColor: ok ? "var(--rule)" : "oklch(64% 0.21 25)", background: "var(--panel)" }}
      aria-label="LLM reliability"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Reliability · roadmap §1
          </p>
          <p className="mt-1 text-sm" style={{ color: ok ? "var(--text-body)" : "oklch(80% 0.08 25)" }}>
            {summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onProbe}
            className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96]"
            style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
          >
            Probe chain
          </button>
          <button
            type="button"
            onClick={onRehearse}
            disabled={rehearsing}
            className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96] disabled:opacity-50"
            style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
          >
            {rehearsing ? "Rehearsing…" : "Rehearse fallback"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mono text-xs underline"
            style={{ color: "var(--cursor)" }}
          >
            {open ? "hide" : "detail"}
          </button>
        </div>
      </div>

      {open && (
        <ul className="mt-3 space-y-1.5">
          {health.providers.map((p) => {
            const tone = OUTCOME_TONE[p.outcome] ?? OUTCOME_TONE["network-error"];
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded border px-2 py-1.5 text-xs"
                style={{ borderColor: "var(--rule)", background: "color-mix(in oklch, var(--panel) 60%, transparent)" }}
              >
                <span className="min-w-0">
                  <span className="mono uppercase tracking-wider" style={{ color: tone.color }}>
                    {tone.label}
                  </span>
                  {" · "}
                  <span style={{ color: "var(--text-strong)" }}>{p.label}</span>
                  <span className="mono ml-1.5" style={{ color: "var(--text-faint)" }}>
                    {p.model}
                  </span>
                </span>
                <span className="mono shrink-0" style={{ color: "var(--text-faint)" }}>
                  {p.latencyMs != null ? `${p.latencyMs}ms` : "—"} · {p.detail.slice(0, 80)}
                </span>
              </li>
            );
          })}
          <li className="mono text-xs" style={{ color: "var(--text-faint)" }}>
            scripted brain: {health.scriptedAvailable ? "always available (no key)" : "unavailable"} · fallback {health.fallbackEngaged ? "engaged" : "idle"}
          </li>
        </ul>
      )}
    </section>
  );
}
