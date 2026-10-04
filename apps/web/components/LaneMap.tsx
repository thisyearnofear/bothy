"use client";

import type { Beat } from "../lib/stories";

const W = 820;
const H = 440;
const pt = (lon: number, lat: number): [number, number] => [((lon + 30) / 165) * W, ((58 - lat) / 100) * H];
const path = (points: [number, number][]) => points.map(([lon, lat], i) => `${i ? "L" : "M"}${pt(lon, lat).map((n) => n.toFixed(1)).join(" ")}`).join(" ");

const SUEZ: [number, number][] = [[103.8, 1.3], [80, 4], [60, 12], [43.3, 12.6], [38, 20], [32.5, 30], [20, 34], [5, 37], [-6, 36], [-9, 43], [4.4, 51.9]];
const CAPE: [number, number][] = [[103.8, 1.3], [80, -8], [55, -25], [18.5, -34.4], [8, -20], [5, -5], [-12, 12], [-15, 25], [-9, 43], [4.4, 51.9]];
const PORTS: [string, number, number, "l" | "r"][] = [["Shanghai", 121.5, 31.2, "l"], ["Singapore", 103.8, 1.3, "l"], ["Bab-el-Mandeb", 43.3, 12.6, "r"], ["Suez", 32.5, 30, "r"], ["Rotterdam", 4.4, 51.9, "r"], ["Cape of Good Hope", 18.5, -34.4, "r"]];

type State = NonNullable<Beat["map"]>;

const COPY: Record<State, string> = {
  open: "Suez route open",
  avoiding: "Carriers avoiding the Red Sea",
  paused: "Largest carrier pauses the route",
  diverted: "Traffic diverted around the Cape",
};

// Schematic only: ports are placed by longitude and latitude, coastlines are omitted.
export default function LaneMap({ state, counts }: { state: State; counts?: { label: string; value: string }[] }) {
  const suezColor = state === "open" ? "var(--st-allowed)" : state === "avoiding" ? "var(--st-tamper)" : "var(--st-blocked)";
  const suezDash = state === "open" ? undefined : state === "avoiding" ? "7 6" : "3 7";
  const capeActive = state === "diverted";
  const [bx, by] = pt(43.3, 12.6);
  return <figure className="lane-map" aria-label={`Shipping lanes between Asia and Europe. ${COPY[state]}.`}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      <title>{COPY[state]}</title>
      {[-20, 0, 20, 40, 60, 80, 100, 120].map((lon) => <line key={lon} x1={pt(lon, 0)[0]} x2={pt(lon, 0)[0]} y1="0" y2={H} className="lane-grid" />)}
      {[-30, -10, 10, 30, 50].map((lat) => <line key={lat} y1={pt(0, lat)[1]} y2={pt(0, lat)[1]} x1="0" x2={W} className="lane-grid" />)}
      <path d={path(CAPE)} fill="none" strokeWidth={capeActive ? 3 : 1.5} stroke={capeActive ? "var(--cursor)" : "var(--rule)"} strokeDasharray={capeActive ? undefined : "4 8"} strokeLinejoin="round" style={{ transition: "stroke 600ms, stroke-width 600ms" }} />
      <path d={path(SUEZ)} fill="none" strokeWidth={state === "open" ? 3 : 2} stroke={suezColor} strokeDasharray={suezDash} strokeLinejoin="round" opacity={state === "diverted" ? 0.45 : 1} style={{ transition: "stroke 600ms, opacity 600ms" }} />
      {(state === "paused" || state === "diverted") && <g transform={`translate(${bx} ${by})`} aria-hidden>
        <circle r="13" fill="var(--page)" stroke="var(--st-blocked)" strokeWidth="2" />
        <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="var(--st-blocked)" strokeWidth="2.5" strokeLinecap="round" />
      </g>}
      {(state === "open" || state === "avoiding") && [0, 1, 2].map((i) => <circle key={`s${i}`} r="4" fill="var(--text-strong)" className="lane-dot"><animateMotion dur="9s" begin={`${i * 3}s`} repeatCount="indefinite" path={path(SUEZ)} /></circle>)}
      {capeActive && [0, 1, 2, 3].map((i) => <circle key={`c${i}`} r="4" fill="var(--cursor)" className="lane-dot"><animateMotion dur="14s" begin={`${i * 3.5}s`} repeatCount="indefinite" path={path(CAPE)} /></circle>)}
      {PORTS.map(([name, lon, lat, side]) => { const [x, y] = pt(lon, lat); return <g key={name}>
        <circle cx={x} cy={y} r="4.5" fill="var(--page)" stroke="var(--text-faint)" strokeWidth="1.5" />
        <text x={side === "r" ? x + 10 : x - 10} y={y + 4} textAnchor={side === "r" ? "start" : "end"} className="lane-label">{name}</text>
      </g>; })}
    </svg>
    <figcaption>
      <span className="pill" data-state={state === "open" ? "allowed" : state === "avoiding" ? "tamper-detected" : state === "paused" ? "blocked" : "verified"}>{COPY[state]}</span>
      {counts && counts.length > 0 && <ul className="lane-counts" aria-label="Modeled shipments by status">{counts.map((c) => <li key={c.label}><b>{c.value}</b> <span className="mono">{c.label}</span></li>)}</ul>}
      <span className="lane-note">Schematic, not to scale. Shipment counts are from synthetic data.</span>
    </figcaption>
  </figure>;
}
