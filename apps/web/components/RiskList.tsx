"use client";

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
}: {
  rows: RiskRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  fresh: string;
  compact?: boolean;
}) {
  return (
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
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                  <span className="mono mr-2 text-xs" style={{ color: "var(--text-faint)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {r.name}
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
  );
}
