import type { RiskLabel } from "./types";

export function riskLabel(score: number): RiskLabel {
  if (score < 0.25) return "LOW";
  if (score < 0.5) return "MODERATE";
  if (score < 0.75) return "ELEVATED";
  return "HIGH";
}

export function riskColor(label: RiskLabel): string {
  switch (label) {
    case "LOW":
      return "#34d399";
    case "MODERATE":
      return "#fbbf24";
    case "ELEVATED":
      return "#fb923c";
    case "HIGH":
      return "#f87171";
  }
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${fmtTime(iso)}`;
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Tiny deterministic bag-of-words "embedding" for incident narratives.
 * Stand-in for a real embedding model in the demo — the retrieval shape
 * (geo + date + hazard filter, then semantic rank) is identical to the
 * pgvector production path.
 */
export function pseudoEmbed(text: string, dim = 64): number[] {
  const v = new Array(dim).fill(0);
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) {
      h ^= word.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[Math.abs(h) % dim] += 1;
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i] * b[i];
  return dot; // both vectors are normalised
}

export function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}
