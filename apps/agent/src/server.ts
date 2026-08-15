import express from "express";
import cors from "cors";
import { scoreAt } from "./engine/risk";
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
} from "./repo";
import type { ScenarioId } from "../../../packages/shared/src/types";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 8787);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "bothy-agent", ts: new Date().toISOString() });
});

app.get("/api/scenarios", async (_req, res) => {
  res.json(await listScenarios());
});

app.get("/api/scenario/:scenario", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });
  const [scenario, routes] = await Promise.all([getScenario(sc), listRoutes(sc)]);
  res.json({ scenario, routes });
});

app.get("/api/scenario/:scenario/risk", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });
  const at = (req.query.at as string) || meta.now;
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

app.get("/api/scenario/:scenario/route/:routeId/timeline", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  const snaps = await listRiskSnapshots(sc, req.params.routeId);
  res.json(snaps);
});

app.post("/api/scenario/:scenario/assess", async (req, res) => {
  const sc = req.params.scenario as ScenarioId;
  const meta = await getScenario(sc);
  if (!meta) return res.status(404).json({ error: "unknown scenario" });
  const at = (req.body.at as string) || meta.now;
  const engine = req.body.engine === "llm" ? "llm" : "scripted";
  const assessment = await runAssessment({
    scenario: sc,
    routeId: req.body.routeId,
    at,
    engine,
  });
  res.json(assessment);
});

app.post("/api/assessments/:id/decision", async (req, res) => {
  const decision = req.body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: "decision must be approved|rejected" });
  }
  const row = await updateDecision(req.params.id, decision, req.body.note);
  if (!row) return res.status(404).json({ error: "assessment not found" });
  await logAudit(row.scenario, "duty-officer", `${decision}`, `assessment ${row.id} (${row.routeId})`);
  res.json(row);
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