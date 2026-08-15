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
  inevitableMs,
  revealMs,
  revealText,
  playing,
  onTogglePlay,
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
  inevitableMs?: number;
  revealMs?: number;
  revealText?: string;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const uid = useId();
  const W = 640;
  const H = 150;
  const x = (ms: number) => ((ms - startMs) / (endMs - startMs)) * W;
  const y = (s: number) => H - 8 - s * (H - 24);
  const past = endMs > horizonMs;
  const revealed = revealMs != null && t >= revealMs;
  const span = endMs - startMs || 1;
  const pct = ((t - startMs) / span) * 100;
  const latest = [...snaps].filter((s) => s.t <= t).sort((a, b) => a.t - b.t).at(-1);
  const tags = layoutTags([
    ...(past ? [{ key: "horizon", ms: horizonMs, label: "beyond agent's view", tone: "mute" as const }] : []),
    ...(latest
      ? [{ key: `beat-${latest.t}`, ms: latest.t, label: `${latest.label} ${latest.delta >= 0 ? "+" : ""}${latest.delta.toFixed(2)}`, tone: "signal" as const }]
      : []),
    ...(inevitableMs != null && t >= inevitableMs
      ? [{ key: "inevitable", ms: inevitableMs, label: "inevitable", tone: "alert" as const }]
      : []),
    ...(revealed && revealText
      ? [{ key: "outcome", ms: revealMs ?? endMs, label: revealText, tone: "alert" as const }]
      : []),
  ], startMs, span);

  return (
    <div className="rounded-lg border p-3" style={{ background: "var(--panel)", borderColor: "var(--rule)" }}>
      <div className="relative">
        {/* tags sit in their own track so they don't fight the risk curves */}
        <div className="relative mb-1 h-[52px]">
          {tags.map((tag) => (
            <span
              key={tag.key}
              className="mono pointer-events-none absolute max-w-[min(240px,70%)] truncate rounded border px-1.5 py-0.5 text-[11px] leading-tight"
              style={{
                left: `clamp(8px, ${tag.pct}%, calc(100% - 8px))`,
                top: tag.row * 24,
                transform: "translateX(-8px)",
                background: "var(--panel)",
                borderColor: tag.tone === "alert" ? "oklch(64% 0.21 25)" : "var(--rule)",
                color: tag.tone === "alert" ? "oklch(80% 0.08 25)" : "var(--text-strong)",
              }}
            >
              {tag.label}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Risk over time">
          <defs>
            <pattern id={`${uid}-hatch`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--rule)" strokeWidth="2" />
            </pattern>
          </defs>
          {past && <rect x={x(horizonMs)} y="0" width={W - x(horizonMs)} height={H} fill={`url(#${uid}-hatch)`} opacity="0.5" />}
          {series.map((sr) => (
            <polyline
              key={sr.id}
              points={sr.points.map(([tx, s]) => `${x(tx)},${y(s)}`).join(" ")}
              fill="none"
              strokeWidth="1.5"
              strokeOpacity="0.8"
              style={{ stroke: sr.color, transition: "stroke 240ms var(--ease-base)" }}
            />
          ))}
          {snaps.map((s, i) => {
            const landed = s.t <= t;
            return (
              <g key={i} className={landed ? "pin-in" : ""} opacity={landed ? 1 : 0.25}>
                <line x1={x(s.t)} y1={8} x2={x(s.t)} y2={H - 8} stroke="var(--rule)" strokeWidth="1" strokeDasharray="2 3" />
                <circle cx={x(s.t)} cy={12} r="3" fill="var(--cursor)" />
              </g>
            );
          })}
          {inevitableMs != null && (
            <g className={t >= inevitableMs ? "pin-in" : ""} opacity={t >= inevitableMs ? 1 : 0.35}>
              <line x1={x(inevitableMs)} y1={8} x2={x(inevitableMs)} y2={H - 8} strokeWidth="1" style={{ stroke: "oklch(64% 0.21 25)" }} />
              <rect
                x={Math.min(x(inevitableMs) - 3, W - 6)}
                y={H - 22}
                width="6"
                height="6"
                transform={`rotate(45 ${Math.min(x(inevitableMs), W)} ${H - 19})`}
                style={{ fill: "oklch(64% 0.21 25)" }}
              />
            </g>
          )}
          {revealMs != null && (
            <g className={revealed ? "beacon" : ""} opacity={revealed ? 1 : 0.35}>
              <circle cx={x(revealMs)} cy={12} r="4" strokeWidth="1.5" style={{ fill: revealed ? "oklch(64% 0.21 25)" : "none", stroke: "oklch(64% 0.21 25)" }} />
            </g>
          )}
          <line x1={x(t)} y1={8} x2={x(t)} y2={H - 8} stroke="var(--cursor)" strokeWidth="1.5" />
        </svg>

        {/* transport — video-player grammar: step between beats, play the day */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onPrevStep}
              aria-label="Previous signal"
              className="rounded border px-2 py-1 text-xs transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
            >
              ‹
            </button>
            <button
              onClick={onTogglePlay}
              aria-label={playing ? "Pause replay" : "Replay the day"}
              aria-pressed={playing}
              className="rounded border px-2.5 py-1 text-xs transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
            >
              {playing ? "❙❙" : "▶"}
            </button>
            <button
              onClick={onNextStep}
              aria-label="Next signal"
              className="rounded border px-2 py-1 text-xs transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
            >
              ›
            </button>
          </div>
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
              style={{
                left: `clamp(18px, ${pct}%, calc(100% - 18px))`,
                borderColor: "var(--rule)",
                background: "var(--panel)",
                color: "var(--text-strong)",
              }}
            >
              {fmt(t)}
            </span>
          </div>
        </div>
        {/* axis + affordance hint — the scrubber explains itself once, quietly */}
        <div className="mono mt-1.5 flex items-center justify-between text-xs" style={{ color: "var(--text-body)" }}>
          <span>{fmt(startMs)}</span>
          <span aria-hidden="true">drag to rewind · ← → jumps between signals</span>
          <span>{fmt(endMs)}</span>
        </div>
      </div>
    </div>
  );
}

const fmt = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

type TagTone = "mute" | "signal" | "alert";
type Tag = { key: string; ms: number; label: string; tone: TagTone };

function layoutTags(tags: Tag[], startMs: number, span: number) {
  const placed: Array<Tag & { pct: number; row: number }> = [];
  for (const tag of [...tags].sort((a, b) => a.ms - b.ms)) {
    const pct = ((tag.ms - startMs) / span) * 100;
    let row = 0;
    while (placed.some((p) => p.row === row && Math.abs(p.pct - pct) < 26)) row += 1;
    placed.push({ ...tag, pct, row: Math.min(row, 1) });
  }
  return placed;
}
