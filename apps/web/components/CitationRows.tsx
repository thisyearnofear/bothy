"use client";

import type { EvidenceCitation } from "../../../packages/shared/src/types";
import { byWeight, KIND_LABEL, kindMix, sourceShort } from "../lib/derive";

/** Weighted report stack — kind, source, and how much each citation moved the score. */
export default function CitationRows({
  citations,
  cap,
  compact,
  showMix,
}: {
  citations: EvidenceCitation[];
  cap?: number;
  compact?: boolean;
  showMix?: boolean;
}) {
  const ranked = byWeight(citations);
  const visible = cap != null ? ranked.slice(0, cap) : ranked;
  const peak = Math.max(...ranked.map((c) => Math.abs(c.contribution)), 0.01);
  const mix = kindMix(citations);

  return (
    <div>
      {showMix && mix.length > 0 && (
        <KindMix mix={mix} compact={compact} />
      )}
      <ol className="space-y-1.5">
        {visible.map((c, i) => {
          const width = Math.max(8, (Math.abs(c.contribution) / peak) * 100);
          return (
            <li
              key={`${c.eventId}-${c.text}-${i}`}
              className="rounded border px-2 py-1.5"
              style={{ borderColor: "var(--rule)", background: "color-mix(in oklch, var(--panel) 60%, transparent)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="mono text-xs uppercase tracking-wider" style={{ color: "var(--cursor)" }}>
                    {KIND_LABEL[c.kind]}
                  </span>
                  {c.source && (
                    <span className="mono ml-1.5 text-xs" style={{ color: "var(--text-body)" }}>
                      {compact ? sourceShort(c.source, 22) : c.source}
                    </span>
                  )}
                  <span className={`block leading-snug ${compact ? "text-xs" : "text-sm"}`} style={{ color: "var(--text-body)" }}>
                    {c.text}
                  </span>
                </span>
                <span
                  className="mono tnum shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: `color-mix(in oklch, ${c.contribution >= 0 ? "var(--cursor)" : "var(--rule)"} 16%, transparent)`,
                    color: c.contribution >= 0 ? "var(--cursor)" : "var(--text-faint)",
                  }}
                >
                  {c.contribution >= 0 ? "+" : ""}
                  {c.contribution.toFixed(2)}
                </span>
              </div>
              <span
                aria-hidden="true"
                className="mt-1.5 block h-[3px] rounded-full"
                style={{
                  width: `${width}%`,
                  background: c.contribution >= 0 ? "var(--cursor)" : "var(--text-faint)",
                  opacity: 0.7,
                }}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function KindMix({
  mix,
  compact,
}: {
  mix: { kind: keyof typeof KIND_LABEL; share: number }[];
  compact?: boolean;
}) {
  return (
    <div className="mb-2" aria-label={mix.map((m) => `${KIND_LABEL[m.kind]} ${Math.round(m.share * 100)} percent`).join(", ")}>
      <div className="flex h-1.5 overflow-hidden rounded-full" style={{ background: "var(--rule)" }} aria-hidden="true">
        {mix.map((m, i) => (
          <span
            key={m.kind}
            style={{
              width: `${Math.max(2, m.share * 100)}%`,
              background: "var(--cursor)",
              opacity: 1 - i * 0.22,
            }}
          />
        ))}
      </div>
      <p className={`mono mt-1 ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--text-faint)" }}>
        {mix.map((m) => `${KIND_LABEL[m.kind]} ${Math.round(m.share * 100)}%`).join(" · ")}
      </p>
    </div>
  );
}
