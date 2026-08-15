"use client";

import { useId } from "react";

export type Series = { id: string; color: string; points: [number, number][] }; // [tMs, score0..1]
export type Beat = { t: number; label: string; delta: number };

export default function Timeline({
  startMs,
  endMs,
  horizonMs,
  t,
  onSeek,
  onPrevStep,
  onNextStep,
  series,
  snaps,
  revealMs,
  revealText,
}: {
  startMs: number;
  endMs: number;
  horizonMs: number;
  t: number;
  onSeek: (ms: number) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  series: Series[];
  snaps: Beat[];
  revealMs?: number;
  revealText?: string;
}) {
  const uid = useId();
  const W = 640;
  const H = 150;
  const x = (ms: number) => ((ms - startMs) / (endMs - startMs)) * W;
  const y = (s: number) => H - 8 - s * (H - 24);
  const past = endMs > horizonMs;
  const revealed = revealMs != null && t >= revealMs;
  const pct = ((t - startMs) / (endMs - startMs)) * 100;

  return (
    <div className="rounded-lg border p-3" style={{ background: "var(--panel)", borderColor: "var(--rule)" }}>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Risk over time">
          <defs>
            <pattern id={`${uid}-hatch`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--rule)" strokeWidth="2" />
            </pattern>
          </defs>
          {/* beyond-horizon hatched band — the agent's view ends here */}
          {past && <rect x={x(horizonMs)} y="0" width={W - x(horizonMs)} height={H} fill={`url(#${uid}-hatch)`} opacity="0.5" />}
          {past && x(horizonMs) < W && (
            <text x={x(horizonMs) + 6} y={12} fontSize="11" fill="var(--text-faint)">
              beyond agent&apos;s view
            </text>
          )}
          {/* series */}
          {series.map((sr) => (
            <polyline
              key={sr.id}
              points={sr.points.map(([tx, s]) => `${x(tx)},${y(s)}`).join(" ")}
              fill="none"
              stroke={sr.color}
              strokeWidth="1.5"
              strokeOpacity="0.8"
              style={{ transition: "stroke 240ms var(--ease-base)" }}
            />
          ))}
          {/* signal pins — only the turning points, annotated with their delta */}
          {snaps.map((s, i) => {
            const landed = s.t <= t;
            return (
              <g key={i} className={landed ? "pin-in" : ""} opacity={landed ? 1 : 0.25}>
                <line x1={x(s.t)} y1={8} x2={x(s.t)} y2={H - 8} stroke="var(--rule)" strokeWidth="1" strokeDasharray="2 3" />
                <circle cx={x(s.t)} cy={12} r="3" fill="var(--cursor)" />
                {landed && (
                  <text x={Math.min(x(s.t) + 5, W - 110)} y={26} fontSize="10.5" fill="var(--text-body)" className="mono">
                    {s.label} {s.delta >= 0 ? "+" : ""}
                    {s.delta.toFixed(2)}
                  </text>
                )}
              </g>
            );
          })}
          {/* outcome reveal — ghosted until the cursor crosses it, then beacon */}
          {revealMs != null && (
            <g className={revealed ? "beacon" : ""} opacity={revealed ? 1 : 0.35}>
              <circle cx={x(revealMs)} cy={12} r="4" fill={revealed ? "oklch(64% 0.21 25)" : "none"} stroke="oklch(64% 0.21 25)" strokeWidth="1.5" />
              {revealed && (
                <text x={Math.min(x(revealMs) + 7, W - 150)} y={15} fontSize="11" fill="oklch(64% 0.21 25)" className="mono">
                  {revealText}
                </text>
              )}
            </g>
          )}
          {/* cursor — the pointer is the cursor, 1:1 */}
          <line x1={x(t)} y1={8} x2={x(t)} y2={H - 8} stroke="var(--cursor)" strokeWidth="1.5" />
        </svg>

        <div className="mt-2 flex items-center gap-2">
          <button onClick={onPrevStep} aria-label="Previous signal" className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
            ‹ prev
          </button>
          {/* time bubble tracks the thumb */}
          <div className="relative flex-1">
            <input
              type="range"
              min={startMs}
              max={endMs}
              step={1}
              value={t}
              onChange={(e) => onSeek(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  onPrevStep();
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  onNextStep();
                }
              }}
              aria-label="Time"
              id={uid}
              className="w-full"
              style={{ accentColor: "var(--cursor)" }}
            />
            <span
              className="mono pointer-events-none absolute -top-6 -translate-x-1/2 rounded border px-1.5 py-0.5 text-xs"
              style={{ left: `${pct}%`, borderColor: "var(--rule)", background: "var(--panel)", color: "var(--text-strong)" }}
            >
              {fmt(t)}
            </span>
          </div>
          <button onClick={onNextStep} aria-label="Next signal" className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
            next ›
          </button>
        </div>
      </div>
    </div>
  );
}

const fmt = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
