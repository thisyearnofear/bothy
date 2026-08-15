import type { AgentCtx, ToolSet } from "./tools";
import type { ScriptDraft } from "./scripted";

const MODEL = process.env.BOTHY_MODEL ?? "claude-sonnet-4-5";
const MAX_TURNS = 8;

const SYSTEM_PROMPT = `You are Bothy, a risk-intelligence agent for winter access on UK upland roads.

Strict 5-phase pipeline: detect → retrieve → reason → recommend → act.
Use ONLY the provided tools. No browsing, no autonomous publishing.
Cite evidence from the tools; never invent IDs. If evidence is thin, lower confidence.
You MUST finish by calling create_human_review with causal_chain[], confidence (0..1),
draft warning text, responsible_actor, and priority (routine|urgent|immediate).`;

const TOOL_DEFS = [
  { name: "get_weather_warning", description: "Active Met Office weather warnings.", input_schema: { type: "object", properties: { area: { type: "string" } } } },
  { name: "get_road_disruptions", description: "Road closures / disruptions / plough status for a route.", input_schema: { type: "object", properties: { route_id: { type: "string" } } } },
  { name: "search_incidents", description: "Search historical incidents by route / hazard / semantic query.", input_schema: { type: "object", properties: { route_id: { type: "string" }, hazard: { type: "string" }, query: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_route_characteristics", description: "Route geometry, gradient, exposure, ploughing, hazards.", input_schema: { type: "object", properties: { route_id: { type: "string" } } } },
  { name: "draft_public_warning", description: "Generate a draft public warning for a route.", input_schema: { type: "object", properties: { route_id: { type: "string" } } } },
  {
    name: "create_human_review",
    description: "Final step: persist an assessment to the human-approval queue.",
    input_schema: {
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

type Msg = { role: string; content: unknown };

export async function llmDraft(ctx: AgentCtx, tools: ToolSet): Promise<ScriptDraft | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: key });

  const messages: Msg[] = [
    {
      role: "user",
      content:
        `Assess route ${ctx.route.id} (${ctx.route.name}) at ${new Date(ctx.now).toISOString()} ` +
        `in scenario ${ctx.scenario}. Gather current signals, reason to a confidence-weighted ` +
        `decision, and finish by calling create_human_review.`,
    },
  ];

  for (let i = 0; i < MAX_TURNS; i++) {
    const res = await (client.messages.create as any)({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFS,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    const toolUses = res.content.filter((b: any) => b.type === "tool_use");
    if (res.stop_reason === "end_turn" && !toolUses.length) break;

    const toolResults: unknown[] = [];
    let review: any = null;
    for (const tu of toolUses) {
      const fn = (tools as any)[tu.name];
      const output = typeof fn === "function" ? String(await fn(tu.input)) : "unknown tool";
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: output });
      if (tu.name === "create_human_review") review = tu.input;
    }
    messages.push({ role: "user", content: toolResults });
    if (review) {
      return {
        causal_chain: review.causal_chain ?? [],
        confidence: Number(review.confidence ?? 0),
        draft: String(review.draft ?? ""),
        responsible_actor: String(review.responsible_actor ?? ctx.route.actor),
        priority: review.priority ?? "routine",
      };
    }
  }
  return null; // loop exhausted → caller falls back to scripted
}