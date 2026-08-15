import type {
  Assessment,
  AuditEntry,
  RouteInfo,
  RiskSnapshot,
  ScenarioId,
  ScenarioInfo,
  ToolCall,
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
  // Live assessment trace over a one-shot POST stream. Unlike EventSource GET,
  // the command is not silently retried by the browser after a disconnect.
  assessStream: async (
    id: ScenarioId,
    opts: { routeId?: string; engine?: "llm" | "scripted" },
    onTrace: (t: ToolCall) => void
  ): Promise<Assessment> => {
    const response = await fetch(`/api/scenario/${id}/assess/stream`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(opts),
    });
    if (!response.ok || !response.body) throw new Error(`${response.status} streamed assessment failed`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
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
        if (event === "trace") onTrace(data as ToolCall);
        if (event === "assessment") return data as Assessment;
        if (event === "error") throw new Error((data as { message: string }).message);
      }
      if (done) break;
    }
    throw new Error("stream ended before an assessment was returned");
  },
  decide: (assessmentId: string, decision: "approved" | "rejected", note?: string) =>
    post<Assessment>(`/api/assessments/${assessmentId}/decision`, { decision, note }),
  audit: (id: ScenarioId) => get<AuditEntry[]>(`/api/scenario/${id}/audit`),
  llm: () => get<{ providers: { id: string; label: string; model: string }[] }>("/api/llm"),
};
