import { cosine, fmtDateTime, pseudoEmbed } from "../../../../packages/shared/src/lib";
import type {
  EvidenceCitation,
  IncidentRecord,
  RouteInfo,
  ScenarioId,
  SignalEvent,
  ToolCall,
} from "../../../../packages/shared/src/types";
import type { AssessmentRow } from "../repo";

export interface AgentCtx {
  scenario: ScenarioId;
  now: string;
  llm: boolean;
  route: RouteInfo;
  routes: RouteInfo[];
  events: SignalEvent[];
  incidents: IncidentRecord[];
  trace: ToolCall[];
  render: (route: RouteInfo, at: string) => { score: number; label: string; citations: EvidenceCitation[] };
  persist: (a: AssessmentRow) => Promise<AssessmentRow>;
  audit: (scenario: string, actor: string, action: string, detail: string) => Promise<void>;
  loadLiveWeatherSnapshot: () => Promise<import("../../../../packages/shared/src/types").LiveWeatherResponse | null>;
}

export interface CreateReviewArgs {
  route_id: string;
  causal_chain: string[];
  confidence: number;
  draft: string;
  responsible_actor: string;
  priority: "routine" | "urgent" | "immediate";
}

export interface ToolSet {
  get_live_weather_snapshot: () => Promise<string>;
  get_weather_warning: (a?: { area?: string }) => Promise<string>;
  get_road_disruptions: (a?: { route_id?: string }) => Promise<string>;
  search_incidents: (a?: { route_id?: string; hazard?: string; query?: string; limit?: number }) => Promise<string>;
  get_route_characteristics: (a?: { route_id?: string }) => Promise<string>;
  get_traffic_speed: (a?: { route_id?: string }) => Promise<string>;
  draft_public_warning: (a?: { route_id?: string }) => Promise<string>;
  create_human_review: (a: CreateReviewArgs) => Promise<string>;
}

function pickRoute(ctx: AgentCtx, route_id?: string): RouteInfo {
  return (route_id && ctx.routes.find((r) => r.id === route_id)) || ctx.route;
}

export function makeTools(ctx: AgentCtx): ToolSet {
  const track = (tool: string, args: Record<string, unknown>, summary: string) =>
    ctx.trace.push({ tool, args, at: new Date().toISOString(), ok: true, summary });

  return {
    async get_live_weather_snapshot() {
      const snapshot = await ctx.loadLiveWeatherSnapshot();
      if (!snapshot) {
        const body = "No persisted Open-Meteo snapshot is available. This is non-evidentiary context; score unchanged.";
        track("get_live_weather_snapshot", {}, body);
        return body;
      }
      const route = snapshot.routes.find((item) => item.routeId === ctx.route.id);
      const detail = route
        ? `${route.condition}${route.temperatureC != null ? `, ${route.temperatureC.toFixed(1)}°C` : ""}${route.windGustKph != null ? `, gusts ${Math.round(route.windGustKph)} km/h` : ""}`
        : "no route-level observation";
      const body = `${snapshot.provider} snapshot ${snapshot.snapshotId ?? "unknown"}, ingested ${snapshot.ingestedAt ?? "unknown"}: ${ctx.route.name}: ${detail}. Non-evidentiary context; score unchanged.`;
      track("get_live_weather_snapshot", {}, body);
      return body;
    },

    async get_weather_warning({ area } = {}) {
      const active = ctx.events.filter((e) => {
        if (e.kind !== "warning" || e.at > ctx.now) return false;
        const p = e.payload as { validFrom: string; validTo: string };
        return ctx.now >= p.validFrom && ctx.now <= p.validTo;
      });
      const body = active.length
        ? active
            .map((e) => {
              const p = e.payload as { level: string; hazards: string[] };
              return `[${e.id}] ${p.level.toUpperCase()} (${p.hazards.join(", ")}) — ${e.headline}. ${e.detail}`;
            })
            .join("\n")
        : "No active Met Office warnings.";
      track("get_weather_warning", { area }, body);
      return body;
    },

    async get_road_disruptions({ route_id } = {}) {
      const rows = ctx.events.filter(
        (e) => e.kind === "road" && e.at <= ctx.now && (!route_id || e.routeId === route_id)
      );
      const body = rows.length
        ? rows.map((e) => `[${e.id}] ${fmtDateTime(e.at)} ${e.headline} — ${e.detail}`).join("\n")
        : "No road disruptions on record.";
      track("get_road_disruptions", { route_id }, body);
      return body;
    },

    async search_incidents({ route_id, hazard, query, limit = 3 } = {}) {
      const qv = query ? pseudoEmbed(query) : null;
      const pool = ctx.incidents.filter((i) => {
        if (i.at > ctx.now) return false;
        if (route_id && i.routeId !== route_id) return false;
        if (hazard && i.hazard !== hazard) return false;
        return true;
      });
      const scored = pool
        .map((i) => ({ i, sim: cosine(qv ?? pseudoEmbed(i.narrative), pseudoEmbed(i.narrative)) }))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, limit);
      const body = scored.length
        ? scored
            .map((x) => `[${x.i.id}] ${fmtDateTime(x.i.at)} on ${x.i.routeId} (${x.i.hazard}, ${x.i.severity}): ${x.i.narrative}`)
            .join("\n")
        : "No similar historical incidents found.";
      track("search_incidents", { route_id, hazard, query, limit }, body);
      return body;
    },

    async get_route_characteristics({ route_id } = {}) {
      const route = pickRoute(ctx, route_id);
      const body = `${route.name} (${route.id}) — ${route.lengthKm}km, max gradient ${route.maxGradientPct}%, max elevation ${route.maxElevationM}m, exposure ${route.exposure.toFixed(2)}, ploughed=${route.ploughed}. Hazards: ${route.hazards.join(", ")}. Actor: ${route.actor}.`;
      track("get_route_characteristics", { route_id }, body);
      return body;
    },

    // Roadmap §3: traffic-speed signal — the first new timeline beat. A speed
    // collapse on a pass precedes the closure report, sharpening the lead-time
    // story. Read-only, report-shaped, same ledger as every other signal.
    async get_traffic_speed({ route_id } = {}) {
      const route = pickRoute(ctx, route_id);
      const traffic = ctx.events.filter((e) => {
        if (e.kind !== "traffic" || e.at > ctx.now) return false;
        return !route_id || e.routeId === route_id;
      });
      const body = traffic.length
        ? traffic
            .map((e) => {
              const p = e.payload as { speedKph?: number; dropPct?: number; normalKph?: number };
              const normal = p.normalKph != null ? ` (normal ${p.normalKph} km/h)` : "";
              return `[${e.id}] ${fmtDateTime(e.at)} on ${e.routeId ?? "network"}: speeds ${p.speedKph ?? "?"} km/h, down ${Math.round((p.dropPct ?? 0) * 100)}%${normal}. Source: ${e.source}.`;
            })
            .join("\n")
        : `No traffic-speed observations for ${route.name}.`;
      track("get_traffic_speed", { route_id }, body);
      return body;
    },

    async draft_public_warning({ route_id } = {}) {
      const route = pickRoute(ctx, route_id);
      const r = ctx.render(route, ctx.now);
      const plow = route.ploughed
        ? "This route is being treated by the gritting fleet."
        : "This route is NOT scheduled for ploughing today.";
      const body = `[DRAFT — ${route.name}]\nDo not travel on ${route.name} until conditions improve. Risk ${r.label} (score ${r.score.toFixed(2)}). ${plow} Issued ${fmtDateTime(ctx.now)}. Sources: Met Office DataHub, Cumbria CC road feed, MR incident log.`;
      track("draft_public_warning", { route_id }, body);
      return body;
    },

    async create_human_review({ route_id, causal_chain, confidence, draft, responsible_actor, priority }) {
      const route = pickRoute(ctx, route_id);
      const r = ctx.render(route, ctx.now);
      const id = `a-${ctx.scenario}-${route.id}-${Date.now()}`;
      const assessment: AssessmentRow = {
        id,
        scenario: ctx.scenario,
        routeId: route.id,
        at: ctx.now,
        score: r.score,
        label: r.label,
        confidence,
        causalChain: causal_chain,
        evidence: r.citations,
        draft,
        responsibleActor: responsible_actor,
        priority,
        status: "pending",
        decisionNote: null,
        decidedAt: null,
        engine: ctx.llm ? "llm" : "scripted",
        toolTrace: ctx.trace,
        phases: [],
      };
      await ctx.persist(assessment);
      ctx.trace.push({
        tool: "create_human_review",
        args: { route_id, confidence, priority },
        at: new Date().toISOString(),
        ok: true,
        summary: `Created ${id}: ${r.label} ${r.score.toFixed(2)} -> ${responsible_actor}.`,
      });
      await ctx.audit(
        ctx.scenario,
        "bothy-agent",
        "create_human_review",
        `${route.name} -> review queue (${priority}, ${r.label})`
      );
      return `Created human review [${id}]: ${route.name}, score ${r.score.toFixed(2)} (${r.label}), priority ${priority}. Awaiting duty officer.`;
    },
  };
}
