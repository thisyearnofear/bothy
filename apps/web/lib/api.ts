import type {
  Assessment,
  AuditEntry,
  LiveWeatherResponse,
  RouteInfo,
  RiskSnapshot,
  ScenarioId,
  ScenarioInfo,
  ToolCall,
} from "../../../packages/shared/src/types";

export const isAbortError = (error: unknown) =>
  typeof error === "object" && error !== null && "name" in error && (error as { name: string }).name === "AbortError";

// Single source of truth for the agent API (proxied via Next rewrites -> /api).
const get = <T,>(path: string, signal?: AbortSignal): Promise<T> =>
  fetch(path, { signal }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json() as Promise<T>;
  });

const post = <T,>(path: string, body: unknown, signal?: AbortSignal): Promise<T> =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json() as Promise<T>;
  });

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
  ingestRoad: (
    body: { routeId: string; roadKind: string; headline: string; source?: string; detail?: string; actor?: string },
    signal?: AbortSignal
  ) =>
    post<{ event: unknown; at: string; routeId: string }>("/api/scenario/live/signals/road", body, signal),
  audit: (id: ScenarioId, signal?: AbortSignal) => get<AuditEntry[]>(`/api/scenario/${id}/audit`, signal),
  llm: (signal?: AbortSignal) => get<{ providers: { id: string; label: string; model: string }[] }>("/api/llm", signal),
};
