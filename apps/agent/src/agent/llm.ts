import type { AgentCtx, ToolSet } from "./tools";
import type { ScriptDraft } from "./scripted";
import {
  chat,
  getProviders,
  RateLimiter,
  type ChatMsg,
  type LlmTool,
  type ProviderDef,
} from "./providers";

const MAX_TURNS = 8;

const SYSTEM_PROMPT = `You are Bothy, a risk-intelligence agent for winter access on UK upland roads.

Strict 5-phase pipeline: detect -> retrieve -> reason -> recommend -> act.
Use ONLY the provided tools. No browsing, no autonomous publishing.
Cite evidence from the tools; never invent IDs. If evidence is thin, lower confidence.
You MUST finish by calling create_human_review with causal_chain[], confidence (0..1),
draft warning text, responsible_actor, and priority (routine|urgent|immediate).`;

const TOOLS: LlmTool[] = [
  { name: "get_weather_warning", description: "Active Met Office weather warnings.", parameters: { type: "object", properties: { area: { type: "string" } } } },
  { name: "get_road_disruptions", description: "Road closures / disruptions / plough status for a route.", parameters: { type: "object", properties: { route_id: { type: "string" } } } },
  { name: "search_incidents", description: "Search historical incidents by route / hazard / semantic query.", parameters: { type: "object", properties: { route_id: { type: "string" }, hazard: { type: "string" }, query: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_route_characteristics", description: "Route geometry, gradient, exposure, ploughing, hazards.", parameters: { type: "object", properties: { route_id: { type: "string" } } } },
  { name: "get_traffic_speed", description: "Traffic-speed / congestion drop observations for a route (roadmap §3: a new timeline beat that precedes closure reports).", parameters: { type: "object", properties: { route_id: { type: "string" } } } },
  { name: "draft_public_warning", description: "Generate a draft public warning for a route.", parameters: { type: "object", properties: { route_id: { type: "string" } } } },
  {
    name: "create_human_review",
    description: "Final step: persist an assessment to the human-approval queue.",
    parameters: {
      type: "object",
      properties: {
        route_id: { type: "string" },
        causal_chain: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
        draft: { type: "string" },
        responsible_actor: { type: "string" },
        priority: { type: "string", enum: ["routine", "urgent", "immediate"] },
      },
      required: ["route_id", "causal_chain", "confidence", "draft", "responsible_actor", "priority"],
    },
  },
];

function draftFrom(review: Record<string, unknown>, ctx: AgentCtx): ScriptDraft {
  return {
    causal_chain: Array.isArray(review.causal_chain) ? review.causal_chain.map(String) : [],
    confidence: Number(review.confidence ?? 0),
    draft: String(review.draft ?? ""),
    responsible_actor: String(review.responsible_actor ?? ctx.route.actor),
    priority: (review.priority as ScriptDraft["priority"]) ?? "routine",
  };
}

export async function llmDraft(ctx: AgentCtx, tools: ToolSet): Promise<ScriptDraft | null> {
  const defs = getProviders();
  if (!defs.length) return null;

  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Assess route ${ctx.route.id} (${ctx.route.name}) at ${new Date(ctx.now).toISOString()} ` +
        `in scenario ${ctx.scenario}. Gather current signals, reason to a confidence-weighted ` +
        `decision, and finish by calling create_human_review.`,
    },
  ];

  for (const def of defs) {
    ctx.trace.push({
      tool: `provider:${def.id}`,
      args: { model: def.model },
      at: new Date().toISOString(),
      ok: true,
      summary: `trying ${def.label}`,
    });
    try {
      const draft = await runForProvider(def, messages, ctx, tools);
      if (draft) return draft;
    } catch (e) {
      ctx.trace.push({
        tool: `provider:${def.id}`,
        args: { error: String((e as Error)?.message ?? e) },
        at: new Date().toISOString(),
        ok: false,
        summary: `failed: ${String((e as Error)?.message ?? e)} -> falling through`,
      });
      continue;
    }
  }
  return null; // all providers failed -> caller falls back to scripted
}

async function runForProvider(def: ProviderDef, messages: ChatMsg[], ctx: AgentCtx, tools: ToolSet): Promise<ScriptDraft | null> {
  const rl = new RateLimiter(def.burst, def.reqPerMin);
  const msgs = [...messages];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await chat(def, rl, { messages: msgs, tools: TOOLS, maxTokens: 1500 });

    const content = res.reasoning ? `[reasoning] ${res.reasoning}\n\n${res.content ?? ""}` : (res.content ?? "");
    msgs.push({
      role: "assistant",
      content,
      tool_calls: res.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    });

    if (!res.toolCalls.length) break;

    let reviewArgs: Record<string, unknown> | null = null;
    const toolMsgs: ChatMsg[] = [];
    for (const tc of res.toolCalls) {
      const fn = (tools as any)[tc.name];
      const out = typeof fn === "function" ? String(await fn(tc.args ?? {})) : `unknown tool ${tc.name}`;
      toolMsgs.push({ role: "tool", tool_call_id: tc.id, content: out });
      if (tc.name === "create_human_review") reviewArgs = tc.args;
    }
    msgs.push(...toolMsgs);
    if (reviewArgs) return draftFrom(reviewArgs, ctx);
  }
  return null;
}
