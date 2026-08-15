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
}

/**
 * Hand-rolled agent loop — detect → retrieve → reason → recommend → act.
 * No LangGraph; just a state machine over a small, auditable toolset. The
 * "brain" (deterministic scripted / Anthropic tool-calling) is swappable;
 * every phase and every tool call is written to the audit trail.
 */
export async function runAssessment(input: RunInput): Promise<AssessmentRow> {
  const routes = await listRoutes(input.scenario);
  const events = await listEvents(input.scenario);
  const incidents = await listIncidents(input.scenario);

  // -- detect: pick the requested route, else the highest-current-risk route --
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
  trace.push({
    tool: "pipeline:start",
    args: { scenario: input.scenario, route: route.id, at: input.at },
    at: new Date().toISOString(),
    ok: true,
    summary: `loop started for ${route.id}`,
  });

  // -- brain: reason + recommend (swappable)
  let llmUsed = false;
  if (input.engine === "llm") {
    const ok = await llmDraft(ctx, tools);
    if (ok) {
      llmUsed = true;
      return finalize(await finish(ctx, tools, ok, true), trace);
    }
    trace.push({
      tool: "engine:fallback",
      args: {},
      at: new Date().toISOString(),
      ok: true,
      summary: "LLM unavailable — falling back to scripted brain (deterministic demo).",
    });
  }
  const draft = await scriptedDraft(ctx, tools);
  return finalize(await finish(ctx, tools, draft, llmUsed), trace);
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