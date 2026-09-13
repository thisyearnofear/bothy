import { Agent, tool, BeforeToolCallEvent } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { z } from "zod";
import type { AgentCtx, ToolSet, CreateReviewArgs } from "./tools";
import type { ScriptDraft } from "./scripted";
import { getProviders, type ProviderDef } from "./providers";

/**
 * Bothy on Strands Agents SDK - Agents for Humans hackathon (Good Neighbor track).
 * Risk engine (engine/risk.ts) + Postgres ledger untouched; Strands owns the loop.
 */

export const STRANDS_SYSTEM_PROMPT = `You are Bothy, a community-resilience agent for UK upland roads and flood-prone valleys.
Strict 5-phase pipeline: detect -> retrieve -> reason -> recommend -> act.
Use ONLY the provided tools. No browsing, no autonomous publishing.
Cite evidence from the tools; never invent IDs. If evidence is thin, lower confidence.
You MUST finish by calling create_human_review with causal_chain[], confidence (0..1),
draft warning text, responsible_actor, and priority (routine|urgent|immediate).
The draft is decision support for a duty officer - never a dispatched alert.`;

const RouteIdSchema = z.object({ route_id: z.string().optional() });
const SearchSchema = z.object({
  route_id: z.string().optional(),
  hazard: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().optional(),
});
const AreaSchema = z.object({ area: z.string().optional() });
const ReviewSchema = z.object({
  route_id: z.string(),
  causal_chain: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  draft: z.string(),
  responsible_actor: z.string(),
  priority: z.enum(["routine", "urgent", "immediate"]),
});

/** Wrap Bothy's auditable ToolSet as Strands zod tools. */
export function toStrandsTools(tools: ToolSet) {
  return [
    tool({
      name: "get_weather_warning",
      description: "Active Met Office weather warnings (cited source + timestamp).",
      inputSchema: AreaSchema,
      callback: async (input) => tools.get_weather_warning(input ?? {}),
    }),
    tool({
      name: "get_road_disruptions",
      description: "Road closures / disruptions / gritting status for a route.",
      inputSchema: RouteIdSchema,
      callback: async (input) => tools.get_road_disruptions(input ?? {}),
    }),
    tool({
      name: "search_incidents",
      description: "Search historical incidents by route / hazard / semantic query.",
      inputSchema: SearchSchema,
      callback: async (input) => tools.search_incidents(input ?? {}),
    }),
    tool({
      name: "get_route_characteristics",
      description: "Route geometry, gradient, exposure, ploughing, hazards.",
      inputSchema: RouteIdSchema,
      callback: async (input) => tools.get_route_characteristics(input ?? {}),
    }),
    tool({
      name: "get_traffic_speed",
      description: "Traffic-speed drop observations (lead-time beat before closures).",
      inputSchema: RouteIdSchema,
      callback: async (input) => tools.get_traffic_speed(input ?? {}),
    }),
    tool({
      name: "get_live_weather_snapshot",
      description: "Frozen operator-persisted Open-Meteo context. Non-evidentiary.",
      callback: async () => tools.get_live_weather_snapshot(),
    }),
    tool({
      name: "draft_public_warning",
      description: "Template draft from the deterministic risk-engine score.",
      inputSchema: RouteIdSchema,
      callback: async (input) => tools.draft_public_warning(input ?? {}),
    }),
    tool({
      name: "create_human_review",
      description: "FINAL step: persist assessment to human-approval queue.",
      inputSchema: ReviewSchema,
      callback: async (input) => tools.create_human_review(input as unknown as CreateReviewArgs),
    }),
  ];
}

/** Build a Strands OpenAIModel from a Bothy provider def (chat completions). */
export function modelForProvider(def: ProviderDef) {
  return new OpenAIModel({
    api: "chat",
    modelId: def.model,
    apiKey: def.apiKey || "not-needed",
    clientConfig: { baseURL: def.baseUrl },
  });
}

/** Provenance guard: Strands-native expression of Bothy's core invariant. */
export function provenanceGuard() {
  return (event: InstanceType<typeof BeforeToolCallEvent>) => {
    const use = event.toolUse as unknown as { name?: string; input?: unknown };
    if (use?.name !== "create_human_review") return;
    const text = JSON.stringify(use?.input ?? {});
    const cited = /Met Office|Environment Agency|National Highways|DfT|20\d\d/i.test(text);
    const sourced = /source|Sources:/i.test(text);
    if (!cited && !sourced) {
      event.cancel = "Add timestamped cited sources before create_human_review.";
    }
  };
}

/** Run the Strands agent loop against Bothy tools. Returns draft or null. */
export async function strandsDraft(ctx: AgentCtx, tools: ToolSet): Promise<{ draft: ScriptDraft; providerId: string } | null> {
  const defs = getProviders();
  if (!defs.length) return null;
  const strandsTools = toStrandsTools(tools);
  for (const def of defs) {
    ctx.trace.push({
      tool: `strands:${def.id}`, args: { model: def.model },
      at: new Date().toISOString(), ok: true,
      summary: `Strands agent trying ${def.label}`,
    });
    try {
      const agent = new Agent({
        model: modelForProvider(def),
        systemPrompt: STRANDS_SYSTEM_PROMPT,
        tools: strandsTools,
      });
      agent.addHook(BeforeToolCallEvent, provenanceGuard());
      const prompt =
        `Assess route ${ctx.route.id} (${ctx.route.name}) at ${new Date(ctx.now).toISOString()} ` +
        `in scenario ${ctx.scenario}. Gather signals with the read tools, reason to a ` +
        `confidence-weighted decision, and finish by calling create_human_review.`;
      await agent.invoke(prompt);
      const reviewCall = [...ctx.trace].reverse().find((t) => t.tool === "create_human_review");
      const args = (reviewCall?.args ?? {}) as Record<string, unknown>;
      if (reviewCall && args.causal_chain) {
        return {
          providerId: def.id,
          draft: {
            causal_chain: Array.isArray(args.causal_chain) ? (args.causal_chain as unknown[]).map(String) : [],
            confidence: Number(args.confidence ?? 0.6),
            draft: String(args.draft ?? ""),
            responsible_actor: String(args.responsible_actor ?? ctx.route.actor),
            priority: (args.priority as ScriptDraft["priority"]) ?? "routine",
          },
        };
      }
      ctx.trace.push({
        tool: `strands:${def.id}`, args: { note: "no create_human_review call" },
        at: new Date().toISOString(), ok: false,
        summary: "Strands turn completed without human-review exit; trying next provider.",
      });
    } catch (e) {
      ctx.trace.push({
        tool: `strands:${def.id}`, args: { error: String((e as Error)?.message ?? e) },
        at: new Date().toISOString(), ok: false,
        summary: `Strands failed: ${String((e as Error)?.message ?? e)} -> falling through`,
      });
    }
  }
  return null;
}
