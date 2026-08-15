// Shared domain types for Bothy. Imported (relatively) by both apps.

export type Hazard = "snow" | "ice" | "wind" | "flood" | "rockfall";
export type RiskLabel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
export type ScenarioId = "live" | "backtest";
export type EventKind = "warning" | "forecast" | "road" | "incident";

export interface RouteInfo {
  id: string;
  name: string;
  region: string;
  coords: [number, number][]; // [lng, lat]
  lengthKm: number;
  maxGradientPct: number;
  maxElevationM: number;
  exposure: number; // 0..1 — snow-laden, shelter, gradient, remoteness
  ploughed: boolean;
  hazards: Hazard[];
  actor: string; // default responsible actor
  lat: number;
  lng: number;
}

export interface SignalEvent {
  id: string;
  scenario: ScenarioId;
  kind: EventKind;
  routeId: string | null;
  at: string; // ISO
  source: string;
  headline: string;
  detail: string;
  payload: Record<string, unknown>;
}

// A warning is "active" between validFrom/validTo in payload.
export type WeatherWarning = SignalEvent & {
  kind: "warning";
  payload: { level: "yellow" | "amber" | "red"; hazards: Hazard[]; validFrom: string; validTo: string };
};
export type RoadEvent = SignalEvent & {
  kind: "road";
  payload: { roadKind: "closure" | "disruption" | "plough-complete" | "report" };
};
export type Incident = SignalEvent & {
  kind: "incident";
  payload: { severity: "minor" | "serious" | "critical" };
};

export interface IncidentRecord {
  id: string;
  scenario: ScenarioId;
  at: string;
  routeId: string;
  lat: number;
  lng: number;
  hazard: Hazard;
  severity: "minor" | "serious" | "critical";
  narrative: string;
  source: string;
}

export interface EvidenceCitation {
  eventId: string;
  kind: EventKind;
  at: string;
  source: string;
  text: string;
  contribution: number; // signed score contribution
}

export interface RiskSnapshot {
  routeId: string;
  at: string;
  score: number;
  label: RiskLabel;
  citations: EvidenceCitation[];
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  at: string;
  ok: boolean;
  summary: string;
}

export type AssessmentStatus = "pending" | "approved" | "rejected";

export interface Assessment {
  id: string;
  scenario: ScenarioId;
  routeId: string;
  at: string;
  score: number;
  label: RiskLabel;
  confidence: number;
  causalChain: string[];
  evidence: EvidenceCitation[];
  draft: string;
  responsibleActor: string;
  priority: "routine" | "urgent" | "immediate";
  status: AssessmentStatus;
  decisionNote?: string | null;
  decidedAt?: string | null;
  engine: "llm" | "scripted";
  toolTrace: ToolCall[];
  phases: string[];
}

export interface AuditEntry {
  id: string;
  at: string;
  scenario: ScenarioId;
  actor: string;
  action: string;
  detail: string;
}

export interface ScenarioInfo {
  id: ScenarioId;
  title: string;
  subtitle: string;
  start: string;
  now: string; // agent horizon — agent can only see events at/before this
  fullEnd: string; // full timeline extent (backtest includes real outcomes)
  outcome?: { at: string; text: string }; // real outcome, hidden from agent
}
