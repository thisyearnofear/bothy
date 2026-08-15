import { fmtDateTime } from "../../../../packages/shared/src/lib";
import type { EvidenceCitation, RouteInfo } from "../../../../packages/shared/src/types";
import type { AgentCtx, ToolSet } from "./tools";

export interface ScriptDraft {
  causal_chain: string[];
  confidence: number;
  draft: string;
  responsible_actor: string;
  priority: "routine" | "urgent" | "immediate";
}

export function labelPriority(label: string): "routine" | "urgent" | "immediate" {
  if (label === "HIGH") return "immediate";
  if (label === "ELEVATED") return "urgent";
  return "routine";
}

function buildCausalChain(ctx: AgentCtx, route: RouteInfo, citations: EvidenceCitation[]): string[] {
  const lines: string[] = [];
  const sorted = [...citations].sort((a, b) => (a.at < b.at ? -1 : 1));
  for (const c of sorted) {
    const sign = c.contribution > 0 ? "RAISES risk" : "REDUCES risk";
    lines.push(`${fmtDateTime(c.at)} · ${c.text} (${sign})`);
  }
  lines.push(
    `Combined: ${route.name} is exposed (${route.exposure.toFixed(2)}), ${route.ploughed ? "treated" : "NOT ploughed"}, gradient ${route.maxGradientPct}%.`
  );
  return lines;
}

/** Deterministic brain: run the same read tools in order, then reason from evidence. */
export async function scriptedDraft(ctx: AgentCtx, tools: ToolSet): Promise<ScriptDraft> {
  ctx.trace.push({
    tool: "pipeline:detect",
    args: { route: ctx.route.id, at: ctx.now },
    at: new Date().toISOString(),
    ok: true,
    summary: `detect: ${ctx.route.id} selected for assessment.`,
  });

  if (ctx.scenario === "live") {
    await tools.get_live_weather_snapshot();
  }
  await tools.get_weather_warning();
  await tools.get_road_disruptions({ route_id: ctx.route.id });
  await tools.search_incidents({ route_id: ctx.route.id, limit: 3 });
  await tools.get_route_characteristics({ route_id: ctx.route.id });

  const r = ctx.render(ctx.route, ctx.now);
  const sources = new Set(r.citations.map((c) => c.source)).size;
  const hasWarning = r.citations.some((c) => c.kind === "warning");
  const confidence = Math.min(0.92, Math.max(0.5, 0.55 + sources * 0.06 + (hasWarning ? 0.05 : 0)));

  const priority = labelPriority(r.label);
  const draft =
    `[Bothy draft — for duty officer approval]\n` +
    `Winter access warning — ${ctx.route.name}\n` +
    `RISK: ${r.label} (score ${r.score.toFixed(2)}, confidence ${confidence.toFixed(2)})\n` +
    `Do not travel on ${ctx.route.name} until conditions improve. ` +
    (ctx.route.ploughed
      ? "This route is being treated by the gritting fleet."
      : "This route is NOT scheduled for ploughing today.") +
    `\nIssued ${fmtDateTime(ctx.now)}. Sources: Met Office DataHub, Cumbria CC road feed, MR incident log.`;

  return {
    causal_chain: buildCausalChain(ctx, ctx.route, r.citations),
    confidence,
    draft,
    responsible_actor: ctx.route.actor,
    priority,
  };
}