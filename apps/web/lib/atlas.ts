import type { Beat } from "./stories";
import type { DefenseBrief, DefenseSession, GraphRun } from "./api";

export const CHAIN_SCENARIO = "gallium-chain";
export const EXPOSURE_SCENARIO = "gallium-exposure";

export const CHAIN_STAGES = [
  ["Platform", "p.name"],
  ["System", "s.name"],
  ["Subsystem", "ss.name"],
  ["Assembly", "a.name"],
  ["Subassembly", "sa.name"],
  ["Component", "c.name"],
  ["Material", "m.name"],
  ["Primary material", "g.name"],
] as const;
export type ChainStageLabel = (typeof CHAIN_STAGES)[number][0];

export const BOUNDED_FINAL_LABEL = "1–4 edges · intermediate materials not returned";
export const CONTAINS_LABEL = "CONTAINS";

export const isChainRun = (run: GraphRun | null) => run?.scenarioId === CHAIN_SCENARIO;
export const isExposureRun = (run: GraphRun | null) => run?.scenarioId === EXPOSURE_SCENARIO;

export function cellText(row: Record<string, unknown>, column: string): string | null {
  const value = row[column];
  return typeof value === "string" && value.trim() ? value : null;
}

export interface ChainEdge {
  fromStage: string;
  toStage: string;
  label: string;
  bounded: boolean;
}

export function chainEdges(row: Record<string, unknown>): ChainEdge[] {
  const edges: ChainEdge[] = [];
  for (let i = 0; i < CHAIN_STAGES.length - 1; i++) {
    const [fromLabel, fromColumn] = CHAIN_STAGES[i];
    const [toLabel, toColumn] = CHAIN_STAGES[i + 1];
    if (!cellText(row, fromColumn) || !cellText(row, toColumn)) continue;
    const last = i === CHAIN_STAGES.length - 2;
    edges.push({
      fromStage: fromLabel,
      toStage: toLabel,
      label: last ? BOUNDED_FINAL_LABEL : CONTAINS_LABEL,
      bounded: last,
    });
  }
  return edges;
}

export const chainNodeId = (runId: string, row: number, column: string) => `${runId}#r${row}#${column}`;

export function exposureNames(run: GraphRun): string[] {
  return run.rows
    .map((row) => cellText(row, "p.name"))
    .filter((name): name is string => Boolean(name));
}

export function cellDisplay(row: Record<string, unknown>, column: string): string {
  const value = row[column];
  if (value === null || value === undefined) return "Not recorded";
  if (typeof value === "string" && !value.trim()) return "Not recorded";
  return String(value);
}

export function representativeColumn(run: GraphRun, row: Record<string, unknown>): string {
  if (run.columns.includes("p.name") && cellText(row, "p.name")) return "p.name";
  return run.columns.find((column) => {
    const value = row[column];
    return value !== null && value !== undefined && String(value).trim() !== "";
  }) ?? run.columns[0] ?? "p.name";
}

export const COVERAGE_COLUMNS = [
  "Dependency evidence",
  "Programme mapping",
  "Inventory",
  "Alternatives",
  "Delivery timing",
  "Owner finding",
] as const;
export type CoverageColumn = (typeof COVERAGE_COLUMNS)[number];

export type CoverageCellKind = "captured" | "unknown" | "responsibility";

export interface CoverageCell {
  column: CoverageColumn;
  label: string;
  kind: CoverageCellKind;
  inspectColumn: string | null;
}

export function coverageCell(run: GraphRun, row: Record<string, unknown>, column: CoverageColumn): CoverageCell {
  if (column === "Owner finding") {
    return { column, label: "Not attributed to this row", kind: "responsibility", inspectColumn: null };
  }
  if (column !== "Dependency evidence") {
    return { column, label: "Not established", kind: "unknown", inspectColumn: null };
  }
  if (isExposureRun(run)) {
    return cellText(row, "p.name")
      ? { column, label: "Captured", kind: "captured", inspectColumn: "p.name" }
      : { column, label: "Not recorded", kind: "unknown", inspectColumn: null };
  }
  if (isChainRun(run)) {
    return cellText(row, "p.name") && cellText(row, "c.name") && cellText(row, "g.name")
      ? { column, label: "Captured", kind: "captured", inspectColumn: representativeColumn(run, row) }
      : { column, label: "Not recorded", kind: "unknown", inspectColumn: null };
  }
  const hasAny = run.columns.some((key) => {
    const value = row[key];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
  return hasAny
    ? { column, label: "Captured row", kind: "captured", inspectColumn: representativeColumn(run, row) }
    : { column, label: "Not recorded", kind: "unknown", inspectColumn: null };
}

export function coverageRows(run: GraphRun): Record<string, unknown>[] {
  return run.rows.slice(0, 10);
}

export function ownerSummary(brief: DefenseBrief | null): string | null {
  if (!brief?.action) return null;
  if (brief.action.status === "completed" && brief.action.outcome) {
    return `Finding recorded — owner-recorded outcome: ${brief.action.outcome}`;
  }
  if (brief.action.status === "completed") return "Finding recorded";
  return `Action ${brief.action.status} · owner ${brief.action.owner}`;
}

export interface RailStation {
  id: "question" | "capture" | "brief" | "review" | "followup";
  label: string;
  target: string;
  state: string;
  done: boolean;
}

export function railStations(input: {
  run: GraphRun | null;
  busy: boolean;
  brief: DefenseBrief | null;
  session: DefenseSession;
}): RailStation[] {
  const { run, busy, brief, session } = input;
  const locked = !session.authenticated;
  const lockNote = session.configured ? "Locked — sign in" : "Locked — SSO not configured";
  return [
    { id: "question", label: "Question", target: "investigation-question", state: "Catalogue question", done: true },
    {
      id: "capture", label: "Capture", target: "investigation-canvas",
      state: busy ? "Working" : run ? "Captured" : "Waiting",
      done: Boolean(run),
    },
    {
      id: "brief", label: "Cited brief", target: "investigation-brief",
      state: locked ? lockNote : brief?.claims.length ? "Drafted — deterministic" : "Not drafted",
      done: Boolean(brief?.claims.length),
    },
    {
      id: "review", label: "Human review", target: "investigation-brief",
      state: locked ? lockNote : brief ? `Brief ${brief.status}` : "No brief",
      done: brief?.status === "approved",
    },
    {
      id: "followup", label: "Owned follow-up", target: "investigation-brief",
      state: locked
        ? lockNote
        : brief?.reassessment
          ? `Reassessment: ${brief.reassessment.decision}`
          : brief?.action ? `Action ${brief.action.status}` : "Not assigned",
      done: brief?.action?.status === "completed",
    },
  ];
}

export function storySlugForScenario(scenarioId: string | undefined): "gallium" | "red-sea" | null {
  if (!scenarioId) return null;
  if (scenarioId.startsWith("gallium")) return "gallium";
  if (scenarioId.startsWith("red-sea")) return "red-sea";
  return null;
}

export function beatLabel(beat: Beat, index: number, total: number): string {
  const head = beat.act ? "Current task" : beat.label;
  return `${index + 1} of ${total} · ${head} · ${beat.heading}`;
}

export interface GeoContext {
  id: string;
  label: string;
  lngLat: [number, number];
}

export const GALLIUM_CONTEXT: GeoContext[] = [
  { id: "context-china", label: "China", lngLat: [104, 35] },
  { id: "context-us", label: "United States", lngLat: [-98, 39] },
];

export const RED_SEA_SUEZ: [number, number][] = [[103.8, 1.3], [80, 4], [60, 12], [43.3, 12.6], [38, 20], [32.5, 30], [20, 34], [5, 37], [-6, 36], [-9, 43], [4.4, 51.9]];
export const RED_SEA_CAPE: [number, number][] = [[103.8, 1.3], [80, -8], [55, -25], [18.5, -34.4], [8, -20], [5, -5], [-12, 12], [-15, 25], [-9, 43], [4.4, 51.9]];
export const RED_SEA_POINTS: GeoContext[] = [
  { id: "port-shanghai", label: "Shanghai", lngLat: [121.5, 31.2] },
  { id: "port-singapore", label: "Singapore", lngLat: [103.8, 1.3] },
  { id: "port-bab-el-mandeb", label: "Bab-el-Mandeb", lngLat: [43.3, 12.6] },
  { id: "port-suez", label: "Suez", lngLat: [32.5, 30] },
  { id: "port-rotterdam", label: "Rotterdam", lngLat: [4.4, 51.9] },
  { id: "port-cape", label: "Cape of Good Hope", lngLat: [18.5, -34.4] },
];

export function geoContextNote(context: GeoContext): string {
  if (context.id === "context-china") {
    return "Export-policy origin in the authored gallium timeline. Country-level context only; no production site or supplier location is captured.";
  }
  if (context.id === "context-us") {
    return "Destination of the US-specific restriction in the authored timeline. Country-level context only; this point does not establish a platform or supplier location.";
  }
  return "Named geographic reference for the illustrative corridor. Not a ship position or captured supplier site.";
}

export function geoContextsForScenario(scenarioId: string | undefined): GeoContext[] {
  const slug = storySlugForScenario(scenarioId);
  if (slug === "gallium") return GALLIUM_CONTEXT;
  if (slug === "red-sea") return RED_SEA_POINTS;
  return [];
}

export function diffSummary(diff: { beforeCount: number; afterCount: number; addedSample: unknown[]; removedSample: unknown[] }) {
  return {
    counts: `${diff.beforeCount} → ${diff.afterCount} query rows`,
    added: `${diff.addedSample.length} returned difference sample${diff.addedSample.length === 1 ? "" : "s"} added`,
    removed: `${diff.removedSample.length} returned difference sample${diff.removedSample.length === 1 ? "" : "s"} removed`,
    note: "Returned difference samples are truncated by the API; an empty sample does not prove the full result set is identical.",
  };
}
