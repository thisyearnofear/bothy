"use client";

import { byWeight, citationClause, KIND_LABEL, routeShortName, sourceShort } from "../lib/derive";
import type { EvidenceCitation } from "../../../packages/shared/src/types";

export type RiskRow = {
  routeId: string;
  name: string;
  score: number;
  label: string;
  color: string;
};

export default function RiskList({
  rows,
  selectedId,
  onSelect,
  onHover,
  fresh,
  compact,
  citations,
}: {
  rows: RiskRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  fresh: string;
  compact?: boolean;
  citations?: EvidenceCitation[];
}) {
  return (
    <>
      <ul className="space-y-2">
      {rows.map((r, i) => {
        // LOW routes stay visible — the "not-a-wolf" credibility line, not filler.
        const selected = r.routeId === selectedId;
        return (
          <li key={r.routeId}>
            <button
              onClick={() => onSelect(r.routeId)}
              onMouseEnter={() => onHover?.(r.routeId)}
              onMouseLeave={() => onHover?.(null)}
              onFocus={() => onHover?.(r.routeId)}
              onBlur={() => onHover?.(null)}
              aria-pressed={selected}
              className="w-full rounded-lg border px-3 py-2 text-left transition-colors"
              style={{
                borderColor: selected ? "var(--text-faint)" : "var(--rule)",
                background: selected ? "var(--panel)" : "transparent",
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="min-w-0 text-sm font-medium"
                  style={{ color: "var(--text-strong)" }}
                  title={r.name}
                >
                  <span className="mono mr-2 text-xs" style={{ color: "var(--text-faint)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {compact ? routeShortName(r.name) : r.name}
                </span>
                <span className="mono tnum text-sm" style={{ color: r.color }}>
                  {r.score.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="rounded px-1.5 py-0.5 font-semibold"
                  style={{ background: `color-mix(in oklch, ${r.color} 16%, transparent)`, color: r.color }}
                >
                  {r.label}
                </span>
                {!compact && <span style={{ color: "var(--text-faint)" }}>at {fresh}</span>}
              </div>
              {/* the seismograph tick: the bar eases to the new score as the day scrubs */}
              <span
                aria-hidden="true"
                className="mt-1.5 block h-[3px] rounded-full"
                style={{
                  width: `${Math.max(3, r.score * 100)}%`,
                  background: r.color,
                  transition: "width 240ms var(--ease-base), background 240ms var(--ease-base)",
                }}
              />
            </button>
          </li>
        );
      })}
      </ul>
      <RankWhy rows={rows} selectedId={selectedId} citations={citations ?? []} at={fresh} compact={compact} />
    </>
  );
}

function RankWhy({
  rows,
  selectedId,
  citations,
  at,
  compact,
}: {
  rows: RiskRow[];
  selectedId: string | null;
  citations: EvidenceCitation[];
  at: string;
  compact?: boolean;
}) {
  const rank = rows.findIndex((r) => r.routeId === selectedId);
  if (rank < 0) return null;
  const selected = rows[rank];
  const leader = rows[0];
  const runner = rank === 0 ? rows[1] : undefined;
  const drivers = byWeight(citations)
    .slice(0, compact ? 1 : 2)
    .filter((c) => c.text);
  const gap = runner ? selected.score - runner.score : 0;

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
        Why this rank
      </p>
      <p className="mt-1 text-sm leading-snug" style={{ color: "var(--text-strong)" }}>
        <span className="mono">{String(rank + 1).padStart(2, "0")}</span>
        {" at "}
        <span className="mono">{at}</span>
      </p>
      {drivers.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {drivers.map((c) => (
            <li key={`${c.eventId}-${c.text}`} className="flex items-baseline justify-between gap-2 text-xs">
              <span style={{ color: "var(--text-body)" }}>
                <span className="mono uppercase tracking-wider" style={{ color: "var(--cursor)" }}>
                  {KIND_LABEL[c.kind]}
                </span>
                {" · "}
                {sourceShort(c.source, compact ? 16 : 22)}
                {!compact && (
                  <span className="mt-0.5 block" style={{ color: "var(--text-faint)" }}>
                    {citationClause(c.text, 36)}
                  </span>
                )}
              </span>
              <span className="mono tnum shrink-0" style={{ color: "var(--cursor)" }}>
                {c.contribution >= 0 ? "+" : ""}
                {c.contribution.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm leading-snug" style={{ color: "var(--text-body)" }}>
          no reports on this corridor yet
        </p>
      )}
      {rank === 0 && runner && (
        <p className="mono mt-1 text-xs" style={{ color: "var(--text-faint)" }} title={runner.name}>
          {gap < 0.005
            ? `level with ${compact ? routeShortName(runner.name, 16) : runner.name}`
            : `${gap.toFixed(2)} ahead of ${compact ? routeShortName(runner.name, 16) : runner.name}`}
        </p>
      )}
      {rank > 0 && leader && (
        <p className="mono mt-1 text-xs" style={{ color: "var(--text-faint)" }} title={leader.name}>
          {compact ? routeShortName(leader.name, 16) : leader.name} leads at {leader.score.toFixed(2)}
        </p>
      )}
    </div>
  );
}
