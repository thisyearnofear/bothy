import { riskColor, riskLabel } from "../../../packages/shared/src/lib";
import type { EventKind, EvidenceCitation, RiskSnapshot, RouteInfo } from "../../../packages/shared/src/types";

export const ms = (iso: string) => new Date(iso).getTime();

export interface Inflection {
  atMs: number;
  t: string;
  score: number;
  label: string;
  signal: string;
  kind: EventKind;
  source: string;
  delta: number; // score jump vs the previous snapshot — the "+0.30"
}

export const KIND_LABEL: Record<EventKind, string> = {
  warning: "warning",
  forecast: "forecast",
  road: "road",
  incident: "incident",
};

const KIND_ORDER: EventKind[] = ["warning", "forecast", "road", "incident"];

/** Heaviest citations first — the score is a weighted stack of reports. */
export function byWeight(citations: EvidenceCitation[]): EvidenceCitation[] {
  return [...citations].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

export function sourceShort(source: string, max = 28): string {
  const cut = source.split(/[,(]/)[0].trim();
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut;
}

/** Share of cited mass by report kind — how the stack is weighted, not a second score. */
export function kindMix(citations: EvidenceCitation[]): { kind: EventKind; share: number }[] {
  const abs = citations.reduce((sum, c) => sum + Math.abs(c.contribution), 0) || 1;
  const byKind = new Map<EventKind, number>();
  for (const c of citations) {
    byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + Math.abs(c.contribution));
  }
  return KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
    kind,
    share: (byKind.get(kind) ?? 0) / abs,
  }));
}

/** Nearest snapshot at or before t - re-renders risk + evidence at that instant. */
export function snapshotAt(timeline: RiskSnapshot[], tMs: number): RiskSnapshot | undefined {
  let latest: RiskSnapshot | undefined;
  for (const s of timeline) {
    if (ms(s.at) <= tMs) latest = s;
    else break; // timelines are ascending
  }
  return latest;
}

/** Where new evidence arrived (score/evidence changed) - the annotated turning points. */
export function inflections(timeline: RiskSnapshot[]): Inflection[] {
  const out: Inflection[] = [];
  const seen = new Set<string>();
  let prevKey = "";
  let prevScore = 0;
  for (const s of timeline) {
    const citeIds = s.citations.map((c) => c.eventId).join(",");
    if (prevKey && citeIds !== prevKey) {
      const prevIds = new Set(prevKey.split(",").filter(Boolean));
      const added = s.citations.filter((c) => !prevIds.has(c.eventId));
      const top = byWeight(added)[0] ?? s.citations.at(-1);
      if (top && !seen.has(top.eventId)) {
        seen.add(top.eventId);
        out.push({
          atMs: ms(s.at),
          t: s.at,
          score: s.score,
          label: s.label,
          delta: s.score - prevScore,
          signal: `${fmtAt(s.at)} · ${top.text}`,
          kind: top.kind,
          source: top.source,
        });
      }
    }
    prevKey = citeIds;
    prevScore = s.score;
  }
  return out;
}

/** First clause of a citation — ranking copy, not the full causal stack. */
export function citationClause(text: string, max = 42): string {
  const cut = text.split(/[—,(]/)[0].trim();
  return cut.length > max ? `${cut.slice(0, max - 1).trimEnd()}…` : cut;
}

function terrainClause(route: RouteInfo): string {
  const bits: string[] = [];
  if (route.exposure >= 0.7) bits.push("exposed");
  if (!route.ploughed) bits.push("un-ploughed");
  if (!bits.length) return "this corridor";
  return `${bits[0] === "exposed" ? "an" : "a"} ${bits.join(", ")} road`;
}

function citationBit(c: EvidenceCitation): string {
  const text = c.text.toLowerCase();
  if (c.kind === "warning") {
    if (text.includes("amber")) return "an amber warning";
    if (text.includes("yellow")) return "a yellow warning";
    if (text.includes("red")) return "a red warning";
    return "a weather warning";
  }
  if (c.kind === "forecast" && text.includes("snow")) return "forecast snow";
  if (c.kind === "forecast" && (text.includes("icing") || text.includes("ice"))) return "icing risk";
  if (c.kind === "road" && (text.includes("drift") || text.includes("blocked") || text.includes("closure"))) {
    return "a drifting closure";
  }
  return citationClause(c.text, 28).toLowerCase() || KIND_LABEL[c.kind];
}

/** Causal clause after "{route} is {label}" — numbers sit beside the sentence, not inside it. */
export function causalHeadline(route: RouteInfo, snap: RiskSnapshot): string {
  const pair = byWeight(snap.citations).slice(0, 2);
  const terrain = terrainClause(route);
  if (!pair.length) return `on ${terrain}.`;
  const bits = pair.map(citationBit);
  if (bits.length === 1) return `${bits[0]} meets ${terrain}.`;
  return `${bits[0]} + ${bits[1]} meet ${terrain}.`;
}

export type PipelineLine = { phase: string; text: string };

/** Four readable loop lines from the cited snapshot — not a chat, not a tool dump. */
export function pipelineLines(input: {
  routeName: string;
  actor: string;
  label: string;
  score: number;
  at: string;
  citations: EvidenceCitation[];
}): PipelineLine[] {
  const sources = [...new Set(input.citations.map((c) => sourceShort(c.source)).filter(Boolean))].slice(0, 3);
  const top = byWeight(input.citations).slice(0, 2);
  const reason =
    top
      .map(
        (c) =>
          `${KIND_LABEL[c.kind]} · ${citationClause(c.text, 22)} ${c.contribution >= 0 ? "+" : ""}${c.contribution.toFixed(2)}`
      )
      .join(" · ") || "terrain and exposure only";
  return [
    { phase: "detect", text: `${input.routeName} is ${input.label} ${input.score.toFixed(2)} at ${input.at}` },
    { phase: "retrieve", text: sources.length ? sources.join(" · ") : "no cited sources yet" },
    { phase: "reason", text: reason },
    { phase: "draft", text: `queued for ${input.actor}` },
  ];
}

/** "flagged 2h 15m before" — computed from data, never hardcoded. */
export function leadTimeLabel(fromIso: string, toIso: string): string {
  const mins = Math.round((ms(toIso) - ms(fromIso)) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Point at fraction f along a polyline — pins signals and the risk-cursor onto the route. */
export function pointAt(coords: [number, number][], f: number): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  const total =
    coords.slice(1).reduce((acc, c, i) => acc + Math.hypot(c[0] - coords[i][0], c[1] - coords[i][1]), 0) || 1;
  let want = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < coords.length; i++) {
    const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
    if (want <= d) {
      const k = d === 0 ? 0 : want / d;
      return [
        coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * k,
        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * k,
      ];
    }
    want -= d;
  }
  return coords[coords.length - 1];
}

const fmtAt = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export { riskColor, riskLabel };
