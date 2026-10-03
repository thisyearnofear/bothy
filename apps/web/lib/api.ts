import type {
  Assessment,
  AuditEntry,
  LiveWeatherResponse,
  RouteInfo,
  RiskSnapshot,
  ScenarioId,
  ScenarioInfo,
  ToolCall,
  GraphScenario,
  GraphRows,
  GraphRun,
  GraphWitness,
} from "../../../packages/shared/src/types";

export type { GraphScenario, GraphRows, GraphRun, GraphWitness };

export interface GraphBenchRow {
  id: string;
  ms: number;
  count: number;
}

export interface GraphDiffBody {
  graph: string;
  beforeCommit?: string;
  afterCommit?: string;
  cypher: string;
}

export interface GraphDiff {
  beforeCount: number;
  afterCount: number;
  addedSample: Record<string, unknown>[];
  removedSample: Record<string, unknown>[];
}

export interface PilotInterestBody {
  name: string;
  org: string;
  email: string;
}

export const isAbortError = (error: unknown) =>
  typeof error === "object" && error !== null && "name" in error && (error as { name: string }).name === "AbortError";

// Single source of truth for the agent API (proxied via Next rewrites -> /api).
const get = <T,>(path: string, signal?: AbortSignal): Promise<T> =>
  fetch(path, { signal }).then((r) => {
    if (!r.ok) return apiError(r, path);
    return r.json() as Promise<T>;
  });

const post = <T,>(path: string, body: unknown, signal?: AbortSignal): Promise<T> =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }).then((r) => {
    if (!r.ok) return apiError(r, path);
    return r.json() as Promise<T>;
  });

async function apiError(response: Response, path: string): Promise<never> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  throw new Error(typeof body?.error === "string" ? body.error : `${response.status} ${path}`);
}

export const api = {
  health: (signal?: AbortSignal) => get<{ ok: boolean }>("/api/health", signal),
  scenarios: (signal?: AbortSignal) => get<ScenarioInfo[]>("/api/scenarios", signal),
  scenario: (id: ScenarioId, signal?: AbortSignal) =>
    get<{ scenario: ScenarioInfo; routes: RouteInfo[] }>(`/api/scenario/${id}`, signal),
  timeline: (id: ScenarioId, routeId: string, signal?: AbortSignal) =>
    get<RiskSnapshot[]>(`/api/scenario/${id}/route/${routeId}/timeline`, signal),
  liveWeather: (signal?: AbortSignal) => get<LiveWeatherResponse>("/api/scenario/live/live-weather", signal),
  refreshLiveWeather: (signal?: AbortSignal) => post<LiveWeatherResponse>("/api/scenario/live/live-weather/refresh", {}, signal),
  risk: (id: ScenarioId, at?: string, signal?: AbortSignal) =>
    get<{ at: string; routes: RouteInfo[] }>(`/api/scenario/${id}/risk${at ? `?at=${encodeURIComponent(at)}` : ""}`, signal),
  assessments: (id: ScenarioId, signal?: AbortSignal) =>
    get<Assessment[]>(`/api/scenario/${id}/assessments`, signal),
  assess: (id: ScenarioId, opts: { routeId?: string; engine?: "llm" | "scripted"; force?: boolean } = {}, signal?: AbortSignal) =>
    post<Assessment>(`/api/scenario/${id}/assess`, { ...opts }, signal),
  // Live assessment trace over a one-shot POST stream. Unlike EventSource GET,
  // the command is not silently retried by the browser after a disconnect.
  assessStream: async (
    id: ScenarioId,
    opts: { routeId?: string; engine?: "llm" | "scripted" },
    onTrace: (t: ToolCall) => void,
    signal?: AbortSignal
  ): Promise<Assessment> => {
    const response = await fetch(`/api/scenario/${id}/assess/stream`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(opts),
      signal,
    });
    if (!response.ok || !response.body) throw new Error(`${response.status} streamed assessment failed`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = block.match(/^event: (.+)$/m)?.[1];
          const raw = block.match(/^data: (.+)$/m)?.[1];
          if (!event || !raw) continue;
          const data = JSON.parse(raw) as ToolCall | Assessment | { message: string };
          if (event === "trace") {
            if (!signal?.aborted) onTrace(data as ToolCall);
          }
          if (event === "assessment") return data as Assessment;
          if (event === "error") throw new Error((data as { message: string }).message);
        }
        if (done) break;
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        /* already closed or aborted */
      }
    }
    throw new Error("stream ended before an assessment was returned");
  },
  decide: (
    assessmentId: string,
    decision: "approved" | "rejected",
    opts?: { note?: string; actor?: string },
    signal?: AbortSignal
  ) => post<Assessment>(`/api/assessments/${assessmentId}/decision`, { decision, ...opts }, signal),
  assessment: (id: string, signal?: AbortSignal) =>
    get<Assessment & { notifications?: { id: number; route_id: string; label: string; status: string; target: string }[] }>(`/api/assessments/${id}`, signal),
  subscribe: (body: { routeId: string; email: string; scenario?: string }, signal?: AbortSignal) =>
    post<{ id: number; routeId: string; routeName: string; count: number }>(`/api/subscriptions`, body, signal),
  subscriptionCount: (signal?: AbortSignal) =>
    get<{ subscriptions: unknown[]; count: number }>(`/api/subscriptions`, signal),
  ingestRoad: (
    body: { routeId: string; roadKind: string; headline: string; source?: string; detail?: string; actor?: string },
    signal?: AbortSignal
  ) =>
    post<{ event: unknown; at: string; routeId: string }>("/api/scenario/live/signals/road", body, signal),
  audit: (id: ScenarioId, signal?: AbortSignal) => get<AuditEntry[]>(`/api/scenario/${id}/audit`, signal),
  // ---- Watch-room defense track (TuringDB graph, proxied /api -> agent :8787) ----
  graphHealth: (signal?: AbortSignal) =>
    get<{ ok: boolean; graphs?: string[]; error?: string }>(`/api/graph/health`, signal),
  graphScenarios: (signal?: AbortSignal) =>
    get<{ scenarios: GraphScenario[] }>(`/api/graph/scenarios`, signal).then((data) => data.scenarios),
  runScenario: (id: string, opts: { commit?: string } = {}, signal?: AbortSignal) =>
    post<GraphRun>(`/api/graph/scenario/${encodeURIComponent(id)}/run`, opts, signal),
  graphQuery: (
    body: { graph: string; cypher: string; commit?: string },
    signal?: AbortSignal
  ) => post<GraphRows>(`/api/graph/query`, body, signal),
  graphHistory: (graph: string, signal?: AbortSignal) =>
    get<GraphRows>(`/api/graph/history?graph=${encodeURIComponent(graph)}`, signal),
  graphBench: (signal?: AbortSignal) =>
    get<{ results: GraphBenchRow[]; totalMs: number }>(`/api/graph/bench`, signal).then((data) => data.results),
  graphDiff: (body: GraphDiffBody, signal?: AbortSignal) =>
    post<GraphDiff>(`/api/graph/diff`, body, signal),
  graphSimulate: (
    body: { graph: string; writes: string[]; readCypher: string; keep?: boolean },
    signal?: AbortSignal
  ) =>
    post<{ ok: boolean; beforeCount: number; afterCount: number; error?: string }>(
      `/api/graph/simulate`,
      body,
      signal
    ),
  graphWitness: (body: { runId: string }, signal?: AbortSignal) =>
    post<GraphWitness>(`/api/graph/witness`, body, signal),
  witness: (hash: string, signal?: AbortSignal) =>
    get<GraphWitness & { links?: { page: string; rerun: string } }>(`/api/graph/witness/${encodeURIComponent(hash)}`, signal),
  // ---- Local log-only digest loop (SQLite record, Postgres mirror best-effort)
  loopSubscribe: (body: { email: string; routeId: string; scenario?: string }, signal?: AbortSignal) =>
    post<{ ok: boolean; count: number; total: number }>(`/api/loop/subscribe`, body, signal),
  loopNotify: (body: { routeId: string; label?: string; summary?: string; caseHref?: string }, signal?: AbortSignal) =>
    post<{ ok: boolean; queued: number }>(`/api/loop/notify`, body, signal),
  loopDigest: (signal?: AbortSignal) =>
    get<{ digests: { id: string; to: string; subject: string; body: string; caseHref: string; at: string }[]; subs: number }>(`/api/loop/digest`, signal),
  pilotInterest: (body: PilotInterestBody, signal?: AbortSignal) =>
    post<{ ok: boolean; count: number; degraded: boolean }>(`/api/pilot-interest`, body, signal),
  pilotCount: (signal?: AbortSignal) =>
    get<{ count: number }>(`/api/pilot-interest/count`, signal),
  llm: (signal?: AbortSignal) => get<{ providers: { id: string; label: string; model: string }[] } & { scripted: boolean; now: string }>("/api/llm", signal),
  llmHealth: (signal?: AbortSignal) =>
    get<{
      at: string;
      providers: { id: string; label: string; model: string; outcome: string; status?: number; detail: string; latencyMs?: number }[];
      firstOkIndex: number | null;
      fallbackEngaged: boolean;
      scriptedAvailable: boolean;
    }>("/api/llm/health", signal),
  rehearseFallback: (id: ScenarioId, opts: { routeId?: string } = {}, signal?: AbortSignal) =>
    post<Assessment>(`/api/scenario/${id}/assess`, { ...opts, engine: "llm", rehearseFallback: true, force: true }, signal),
};
