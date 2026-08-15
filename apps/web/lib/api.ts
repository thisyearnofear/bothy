import type {
  Assessment,
  AuditEntry,
  RouteInfo,
  RiskSnapshot,
  ScenarioId,
  ScenarioInfo,
} from "../../../packages/shared/src/types";

// Single source of truth for the agent API (proxied via Next rewrites -> /api).
const get = <T,>(path: string): Promise<T> =>
  fetch(path).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json() as Promise<T>;
  });

const post = <T,>(path: string, body: unknown): Promise<T> =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json() as Promise<T>;
  });

export const api = {
  health: () => get<{ ok: boolean }>("/api/health"),
  scenarios: () => get<ScenarioInfo[]>("/api/scenarios"),
  scenario: (id: ScenarioId) => get<{ scenario: ScenarioInfo; routes: RouteInfo[] }>(`/api/scenario/${id}`),
  timeline: (id: ScenarioId, routeId: string) =>
    get<RiskSnapshot[]>(`/api/scenario/${id}/route/${routeId}/timeline`),
  risk: (id: ScenarioId, at?: string) => get<{ at: string; routes: RouteInfo[] }>(`/api/scenario/${id}/risk${at ? `?at=${encodeURIComponent(at)}` : ""}`),
  assess: (id: ScenarioId, opts: { routeId?: string; engine?: "llm" | "scripted"; force?: boolean } = {}) =>
    post<Assessment>(`/api/scenario/${id}/assess`, { ...opts }),
  decide: (assessmentId: string, decision: "approved" | "rejected", note?: string) =>
    post<Assessment>(`/api/assessments/${assessmentId}/decision`, { decision, note }),
  audit: (id: ScenarioId) => get<AuditEntry[]>(`/api/scenario/${id}/audit`),
  llm: () => get<{ providers: { id: string; label: string; model: string }[] }>("/api/llm"),
};
