import {
  riskLabel,
  clamp01,
  minutesBetween,
} from "../../../../packages/shared/src/lib";
import type {
  EvidenceCitation,
  Hazard,
  IncidentRecord,
  RiskLabel,
  RiskSnapshot,
  RouteInfo,
  SignalEvent,
} from "../../../../packages/shared/src/types";

const LEVEL_WEIGHT: Record<string, number> = { yellow: 0.15, amber: 0.3, red: 0.45 };
const HAZARD_WEIGHT: Record<Hazard, number> = {
  snow: 1.0,
  ice: 1.0,
  wind: 0.75,
  flood: 0.8,
  rockfall: 0.8,
};
const ROAD_WEIGHT: Record<string, number> = {
  closure: 0.3,
  disruption: 0.18,
  report: 0.14,
  "plough-complete": -0.25,
};
// Roadmap §3: a traffic-speed collapse is a corroborating observation that
// arrives before the closure report. It moves the score earlier — a genuinely
// new timeline beat — but is weighted lighter than a closure so it sharpens
// the lead-time story rather than replacing the sourced report.
const TRAFFIC_WEIGHT = 0.16;

function asHazard(h: string): Hazard | undefined {
  const known: Hazard[] = ["snow", "ice", "wind", "flood", "rockfall"];
  return known.find((x) => x === h);
}

export interface ScoreResult {
  score: number;
  label: RiskLabel;
  citations: EvidenceCitation[];
}

/**
 * Deterministic, explainable risk model. Every contribution is recorded as an
 * EvidenceCitation, so the score at any timestamp is fully decomposable into
 * "which signal moved it, by how much". The agent explains and drafts; it never
 * invents the numbers.
 */
export function scoreAt(
  route: RouteInfo,
  events: SignalEvent[],
  incidents: IncidentRecord[],
  at: string
): ScoreResult {
  const ef = 0.4 + 0.6 * route.exposure;
  let score = 0.08;
  const citations: EvidenceCitation[] = [];

  const push = (
    contribution: number,
    eventId: string,
    kind: SignalEvent["kind"],
    when: string,
    source: string,
    text: string
  ) => {
    if (!contribution) return;
    score += contribution;
    citations.push({ eventId, kind, at: when, source, text, contribution });
  };

  // active weather warnings
  for (const e of events) {
    if (e.at > at || e.kind !== "warning") continue;
    const p = e.payload as { level: string; hazards: string[]; validFrom: string; validTo: string };
    if (at < p.validFrom || at > p.validTo) continue;
    const matched = p.hazards
      .map(asHazard)
      .filter((h): h is Hazard => !!h && route.hazards.includes(h));
    if (!matched.length) continue;
    const hf = Math.max(...matched.map((h) => HAZARD_WEIGHT[h]));
    push(LEVEL_WEIGHT[p.level] * ef * hf, e.id, "warning", e.at, e.source, e.headline);
  }

  // forecast (latest before at)
  let fc: SignalEvent | null = null;
  for (const e of events) if (e.kind === "forecast" && e.at <= at) fc = e;
  if (fc) {
    const p = fc.payload as { snowCm?: number; minTempC?: number; levelM?: number; trend?: string };
    const snowCm = p.snowCm ?? 0;
    const minTemp = p.minTempC ?? 0;
    if (snowCm > 0 && route.hazards.includes("snow")) {
      push((0.06 + 0.013 * Math.min(snowCm, 15)) * ef, fc.id, "forecast", fc.at, fc.source, `${snowCm}cm snow forecast`);
    }
    if (minTemp <= 0 && route.hazards.includes("ice")) {
      let c = 0.12 * ef;
      if (minTemp <= -3) c += 0.06 * ef;
      push(c, fc.id, "forecast", fc.at, fc.source, `low ${minTemp}\u00B0C — icing risk`);
    }
    // Roadmap §2: river-gauge level is the flood wedge's forecast-shaped signal.
    // A rising level above the flood threshold raises risk on flood-prone routes
    // before any closure is reported — same ledger, different wedge.
    const levelM = p.levelM;
    if (levelM != null && route.hazards.includes("flood")) {
      const over = Math.max(0, levelM - 2.0); // 2.0m = typical flood threshold
      if (over > 0) {
        const c = (0.08 + 0.05 * Math.min(over, 2)) * ef;
        const trend = p.trend ? ` (${p.trend})` : "";
        push(c, fc.id, "forecast", fc.at, fc.source, `river ${levelM.toFixed(1)}m above threshold${trend}`);
      }
    }
  }

  // Roadmap §3: traffic-speed collapse — a new timeline beat that arrives before
  // the closure report. Speeds fall on a pass before anyone files a closure.
  for (const e of events) {
    if (e.at > at || e.kind !== "traffic" || e.routeId !== route.id) continue;
    const p = e.payload as { dropPct?: number; speedKph?: number };
    const drop = p.dropPct ?? 0;
    if (drop >= 0.4) {
      // scale by how far speeds have collapsed; 40%+ drop is the trigger
      const c = TRAFFIC_WEIGHT * ef * Math.min(1, drop / 0.7);
      push(c, e.id, "traffic", e.at, e.source, `speeds fell ${Math.round(drop * 100)}% (${p.speedKph ?? "?"} km/h)`);
    }
  }

  // road events on this route
  for (const e of events) {
    if (e.at > at || e.kind !== "road" || e.routeId !== route.id) continue;
    const p = e.payload as { roadKind: string };
    const c = ROAD_WEIGHT[p.roadKind] ?? 0;
    if (c) push(c, e.id, "road", e.at, e.source, e.headline);
  }

  // recent incident on this route (within 6h)
  for (const e of events) {
    if (e.at > at || e.kind !== "incident" || e.routeId !== route.id) continue;
    if (minutesBetween(e.at, at) > 6 * 60) continue;
    push(0.12 * ef, e.id, "incident", e.at, e.source, e.detail);
  }

  // historical incident pattern (retrieval proxy)
  const hist = incidents.find((i) => i.routeId === route.id && route.hazards.includes(i.hazard) && i.at < at);
  if (hist) push(0.1, hist.id, "incident", hist.at, hist.source, "similar past incident on this route");

  const s = Math.min(clamp01(score), 0.97);
  return { score: s, label: riskLabel(s), citations };
}

/** Build a snapshot every `stepMinutes` from start to end (inclusive). */
export function buildTimeline(
  route: RouteInfo,
  events: SignalEvent[],
  incidents: IncidentRecord[],
  start: string,
  end: string,
  stepMinutes = 30
): RiskSnapshot[] {
  const out: RiskSnapshot[] = [];
  const stepMs = stepMinutes * 60000;
  let t = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  while (t <= endMs) {
    const iso = new Date(t).toISOString();
    const r = scoreAt(route, events, incidents, iso);
    out.push({ routeId: route.id, at: iso, score: r.score, label: r.label, citations: r.citations });
    t += stepMs;
  }
  return out;
}