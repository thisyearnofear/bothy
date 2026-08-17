import "./loadEnv";
import express from "express";
import cors from "cors";
import { advanceLiveHorizon, rebuildLiveSnapshots } from "./engine/liveHorizon";
import { scoreAt } from "./engine/risk";
import { liveDay } from "./engine/seedData";
import { runAssessment } from "./agent/loop";
import {
  getScenario,
  listScenarios,
  listRoutes,
  listEvents,
  listIncidents,
  listRiskSnapshots,
  listAssessments,
  listAudit,
  updateDecision,
  logAudit,
  insertSignalEvent,
  getRoute,
} from "./repo";
import type { ScenarioId } from "../../../packages/shared/src/types";
import { getLiveWeather } from "./integrations/openMeteo";
import { hasProviders, providerSummary } from "./agent/providers";

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());

const PORT = Number(process.env.PORT ?? 8787);

function agentVisibleAt(value: unknown, horizon: string) {
  if (typeof value !== "string") return horizon;
  const requested = Date.parse(value);
  const horizonMs = Date.parse(horizon);
  if (Number.isNaN(requested) || Number.isNaN(horizonMs) || requested > horizonMs) return horizon;
  return new Date(requested).toISOString();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "bothy-agent", ts: new Date().toISOString() });
});

app.get("/api/scenarios", async (_req, res) => {
  res.json(await listScenarios());
});

app.get("/api/scenario/:scenario", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  if (sc === "live") await advanceLiveHorizon();
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });
  const [scenario, routes] = await Promise.all([getScenario(sc), listRoutes(sc)]);
  res.json({ scenario, routes });
});

app.get("/api/scenario/:scenario/risk", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });
  const at = agentVisibleAt(req.query.at, meta.now);
  const [routes, events, incidents] = await Promise.all([
    listRoutes(sc),
    listEvents(sc),
    listIncidents(sc),
  ]);
  const ranked = routes
    .map((r) => ({ ...r, ...scoreAt(r, events, incidents, at) }))
    .sort((a, b) => b.score - a.score)
    .map(({ coords, hazards, ...rest }) => ({ ...rest, coords, hazards }));
  res.json({ at, routes: ranked });
});

app.get("/api/scenario/:scenario/live-weather", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  if (sc !== "live") {
    return res.status(409).json({ error: "live weather is unavailable for frozen backtest evidence" });
  }
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });
  const { getLatestLiveWeatherSnapshot } = await import("./repo");
  const snapshot = await getLatestLiveWeatherSnapshot();
  if (!snapshot) {
    return res.status(404).json({ error: "no persisted live weather snapshot; use the operator refresh action first" });
  }
  res.json(snapshot);
});

app.post("/api/scenario/:scenario/live-weather/refresh", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  if (sc !== "live") {
    return res.status(409).json({ error: "live weather refresh is unavailable for frozen backtest evidence" });
  }
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });

  const { saveLiveWeatherSnapshot } = await import("./repo");
  const fetched = await getLiveWeather(await listRoutes(sc));
  // keep-last-good: if every route fell back (network down), don't overwrite
  // the newest real observation with a failure.
  const anyAcquired = fetched.routes.some((r) => r.mode === "live" || r.mode === "cached");
  if (!anyAcquired) {
    return res.status(503).json({
      error: "provider unreachable — no route observations acquired; the last good snapshot is retained",
    });
  }
  const snapshot = await saveLiveWeatherSnapshot(fetched);
  await logAudit(
    sc,
    "operator",
    "weather_snapshot_refresh",
    `Persisted ${snapshot.routes.length} Open-Meteo route observations as ${snapshot.snapshotId} at ${snapshot.ingestedAt}`
  );
  res.status(201).json(snapshot);
});

app.get("/api/scenario/:scenario/route/:routeId/timeline", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  if (sc === "live") await advanceLiveHorizon();
  const snaps = await listRiskSnapshots(sc, req.params.routeId);
  res.json(snaps);
});

app.post("/api/scenario/:scenario/assess", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  if (sc === "live") await advanceLiveHorizon();
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });
  const at = agentVisibleAt(req.body.at, meta.now);
  const engine = req.body.engine === "scripted" ? "scripted" : hasProviders() ? "llm" : "scripted";
  const assessment = await runAssessment({
    scenario: sc,
    routeId: req.body.routeId,
    at,
    engine,
    force: Boolean(req.body.force),
  });
  res.json(assessment);
});

// Live agent trace as a POST stream: each tool call streams as it happens, then
// the final assessment. A command must never be hidden behind retryable SSE GET.
app.post("/api/scenario/:scenario/assess/stream", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  if (sc === "live") await advanceLiveHorizon();
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    const assessment = await runAssessment({
      scenario: sc,
      routeId: req.body.routeId as string | undefined,
      at: meta.now,
      engine: req.body.engine === "llm" ? "llm" : "scripted",
      onTrace: (t) => send("trace", t),
    });
    send("assessment", assessment);
  } catch (e) {
    send("error", { message: e instanceof Error ? e.message : String(e) });
  } finally {
    res.end();
  }
});

app.get("/api/llm", (_req, res) => {
  res.json({ now: new Date().toISOString(), providers: providerSummary(), scripted: true });
});

app.post("/api/assessments/:id/decision", async (req, res) => {
  const decision = req.body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "decision must be approved|rejected" });
  }
  const officer =
    typeof req.body.actor === "string" ? req.body.actor.trim().slice(0, 120) : "";
  if (!officer) {
    return res.status(400).json({ error: "actor is required — name the duty officer who signs" });
  }
  const note =
    typeof req.body.note === "string" && req.body.note.trim()
      ? req.body.note.trim().slice(0, 500)
      : undefined;
  const row = await updateDecision(req.params.id, decision, note ?? `signed by ${officer}`);
  if (!row) return res.status(404).json({ error: "assessment not found" });
  await logAudit(row.scenario, officer, `${decision}`, `assessment ${row.id} (${row.routeId})`);
  res.json(row);
});

const ROAD_KINDS = new Set(["closure", "disruption", "report", "plough-complete"]);

/** Operator road report — lands in the score. Open-Meteo stays off it. */
app.post("/api/scenario/:scenario/signals/road", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  if (sc !== "live") {
    return res.status(409).json({ error: "operator road ingest is only for the live desk" });
  }
  await advanceLiveHorizon(true);
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });

  const routeId = typeof req.body.routeId === "string" ? req.body.routeId : "";
  const roadKind = typeof req.body.roadKind === "string" ? req.body.roadKind : "";
  const headline = typeof req.body.headline === "string" ? req.body.headline.trim().slice(0, 200) : "";
  const source =
    typeof req.body.source === "string" && req.body.source.trim()
      ? req.body.source.trim().slice(0, 120)
      : "Duty officer report";
  const detail =
    typeof req.body.detail === "string" && req.body.detail.trim()
      ? req.body.detail.trim().slice(0, 500)
      : headline;
  const actor =
    typeof req.body.actor === "string" && req.body.actor.trim()
      ? req.body.actor.trim().slice(0, 120)
      : "duty-officer";

  if (!routeId || !headline || !ROAD_KINDS.has(roadKind)) {
    return res.status(400).json({
      error: "routeId, headline, and roadKind (closure|disruption|report|plough-complete) are required",
    });
  }
  const route = await getRoute(sc, routeId);
  if (!route) return res.status(404).json({ error: "unknown route" });

  const at = meta.now;
  const id = `op-road-${Date.now().toString(36)}`;
  const event = await insertSignalEvent({
    id,
    scenario: sc,
    kind: "road",
    routeId,
    at,
    source,
    headline,
    detail,
    payload: { roadKind },
  });
  const day = liveDay();
  await rebuildLiveSnapshots(day.start, meta.now);
  await logAudit(sc, actor, "ingest_road", `${route.name}: ${roadKind} — ${headline}`);
  res.status(201).json({ event, at: meta.now, routeId });
});

app.get("/api/scenario/:scenario/assessments", async (req, res) => {
  res.json(await listAssessments(req.params.scenario));
});

app.get("/api/scenario/:scenario/audit", async (req, res) => {
  res.json(await listAudit(req.params.scenario));
});

app.listen(PORT, () => {
  console.log(`bothy-agent listening on :${PORT}`);
});