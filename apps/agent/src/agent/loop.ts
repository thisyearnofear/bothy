import { scoreAt } from "../engine/risk";
import { makeTools, type AgentCtx } from "./tools";
import { scriptedDraft } from "./scripted";
import { llmDraft } from "./llm";
import {
  getAssessment,
  listEvents,
  listIncidents,
  listRoutes,
  logAudit,
  saveAssessment,
} from "../repo";
import type { ScenarioId } from "../../../../packages/shared/src/types";
import type { AssessmentRow } from "../repo";

export interface RunInput {
  scenario: ScenarioId;
  routeId?: string;
  at: string;
  engine: "llm" | "scripted";
  force?: boolean; // bypass the short-term assessment cache
}

// Short-TTL cache: identical (scenario, route, at, engine) runs reuse the last
// result instead of re-hitting a rate-limited LLM provider. Key efficiency win
// for the UI (re-renders / double-clicks).
const assessCache = new Map<string, { at: number; a: AssessmentRow }>();
const ASSESS_TTL_MS = 30_000;

/**
 * Hand-rolled agent loop - detect -> retrieve -> reason -> recommend -> act.
 * No LangGraph; a state machine over a small, auditable toolset. The "brain"
 * is a provider chain (free OpenAI-compatible LLMs) with a deterministic
 * scripted fallback; every phase and tool call is audited.
 */
export async function runAssessment(input: RunInput): Promise<AssessmentRow> {
  const cacheKey = `${input.scenario}|${input.routeId ?? "auto"}|${input.at}|${input.engine}`;
  if (!input.force) {
    const hit = assessCache.get(cacheKey);
    if (hit && Date.now() - hit.at < ASSESS_TTL_MS) return hit.a;
  }

  const routes = await listRoutes(input.scenario);
  const events = await listEvents(input.scenario);
  const incidents = await listIncidents(input.scenario);

  const route = input.routeId
    ? routes.find((r) => r.id === input.routeId) ?? routes[0]
    : [...routes].sort((a, b) => scoreAt(b, events, incidents, input.at).score - scoreAt(a, events, incidents, input.at).score)[0];

  const trace: AgentCtx["trace"] = [];
  const props: Omit<AgentCtx, "route"> = {
    scenario: input.scenario,
    now: input.at,
    llm: input.engine === "llm",
    routes,
    events,
    incidents,
    trace,
    render: (r, at) => scoreAt(r, events, incidents, at),
    persist: saveAssessment,
    audit: logAudit,
  };
  const ctx: AgentCtx = { ...props, route };
  const tools = makeTools(ctx);
  trace.push({ tool: "pipeline:start", args: { scenario: input.scenario, route: route.id, at: input.at }, at: new Date().toISOString(), ok: true, summary: `loop started for ${route.id}` });

  // brain: try the LLM provider chain, else deterministic scripted
  const llmDraftRes = input.engine === "llm" ? await llmDraft(ctx, tools) : null;
  let assessment: AssessmentRow;
  if (llmDraftRes) {
    assessment = await finish(ctx, tools, llmDraftRes, true);
  } else {
    if (input.engine === "llm") {
      trace.push({ tool: "engine:fallback", args: {}, at: new Date().toISOString(), ok: true, summary: "provider chain unavailable - using scripted brain (deterministic demo)." });
    }
    const draft = await scriptedDraft(ctx, tools);
    assessment = await finish(ctx, tools, draft, false);
  }

  const out = finalize(assessment, trace);
  assessCache.set(cacheKey, { at: Date.now(), a: out });
  return out;
}

async function finish(ctx: AgentCtx, tools: ReturnType<typeof makeTools>, draft: Awaited<ReturnType<typeof scriptedDraft>>, llmUsed: boolean) {
  const result = await tools.create_human_review({
    route_id: ctx.route.id,
    causal_chain: draft.causal_chain,
    confidence: draft.confidence,
    draft: draft.draft,
    responsible_actor: draft.responsible_actor,
    priority: draft.priority,
  });
  const m = result.match(/\[([^\]]+)\]/);
  const id = m ? m[1] : `a-${ctx.scenario}-${ctx.route.id}-${Date.now()}`;
  const assessment = await getAssessment(id);
  if (!assessment) throw new Error(`assessment ${id} not persisted`);
  assessment.engine = llmUsed ? "llm" : "scripted";
  assessment.phases = ["detect", "retrieve", "reason", "recommend", "act"];
  return assessment;
}

function finalize(a: AssessmentRow, trace: unknown): AssessmentRow {
  return { ...a, toolTrace: trace };
}
