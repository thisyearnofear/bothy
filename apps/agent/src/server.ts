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
  getAssessment,
  createSubscription,
  listSubscriptions,
  countSubscriptions,
  listNotifications,
  isValidEmail,
} from "./repo";
import { sendDigest } from "./digest";
import type { ScenarioId } from "../../../packages/shared/src/types";
import { getLiveWeather } from "./integrations/openMeteo";
import { hasProviders, providerSummary, rehearseChain } from "./agent/providers";

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
    rehearseFallback: Boolean(req.body.rehearseFallback),
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
      rehearseFallback: Boolean(req.body.rehearseFallback),
      onTrace: (t) => send("trace", t),
    });
    send("assessment", assessment);
  } catch (e) {
    send("error", { message: e instanceof Error ? e.message : String(e) });
  } finally {
    res.end();
  }
});

// ---- Defense track: TuringDB graph proxy ---------------------------------
// The TS agent talks to the Python sidecar (graph/sidecar.py :6777), which
// owns the only TuringDB client. Every route degrades to 503 with a clear
// message when the sidecar/graph is down — Postgres paths never depend on it.
app.get("/api/graph/health", async (_req, res) => {
  try {
    const { graphAvailable } = await import("./graph/turing");
    res.json(await graphAvailable());
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

app.get("/api/graph/history", async (req, res) => {
  try {
    const { graphHistory } = await import("./graph/turing");
    const graph = typeof req.query.graph === "string" ? req.query.graph : "supply_chain_deep";
    res.json(await graphHistory(graph));
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

app.post("/api/graph/query", async (req, res) => {
  try {
    const { graphQuery } = await import("./graph/turing");
    const graph = typeof req.body.graph === "string" ? req.body.graph : "supply_chain_deep";
    const cypher = String(req.body.cypher ?? "");
    if (!cypher) return res.status(400).json({ error: "cypher is required" });
    const commit = typeof req.body.commit === "string" ? req.body.commit : undefined;
    res.json(await graphQuery(graph, cypher, commit));
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

app.post("/api/graph/simulate", async (req, res) => {
  // Branch-to-simulate: open change -> apply hypothetical writes -> read the
  // blast-radius delta -> abandon (default) or submit. Returns before/after.
  try {
    const { graphChange, graphQuery, BLAST_QUERIES } = await import("./graph/turing");
    const graph = typeof req.body.graph === "string" ? req.body.graph : "supply_chain_deep";
    const writes = Array.isArray(req.body.writes) ? req.body.writes.map(String) : [];
    const readCypher = typeof req.body.readCypher === "string" && req.body.readCypher
      ? req.body.readCypher
      : BLAST_QUERIES.bom8("Loitering munition");
    const keep = req.body.keep === true;
    if (!writes.length) return res.status(400).json({ error: "writes[] (Cypher CREATE/SET) is required" });
    const change = await graphChange.open();
    await graphChange.checkout(change);
    const { logAudit } = await import("./repo");
    // Writes must be SET-only on existing nodes (no CREATE/MATCH-write). Take the
    // baseline BEFORE opening the change so before/after is meaningful.
    const before = await graphQuery(graph, readCypher);
    try {
      for (const w of writes) await graphQuery(graph, w);
      const after = await graphQuery(graph, readCypher);
      if (keep) {
        await graphChange.submit();
        await logAudit("live", "duty-officer", "graph_simulate_keep", `${graph}: kept simulation (${writes.length} writes)`);
      } else {
        await graphChange.abandon();
      }
      res.json({ ok: true, kept: keep, beforeCount: before.count, afterCount: after.count, after, before });
    } catch (e) {
      try { await graphChange.abandon(); } catch { /* already clean */ }
      throw e;
    }
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

// ---- Defense scenario catalogue + bench + witness-pack -------------------------
// Durable state: witness chain, loop subs/digests, and pilot counter persist in
// a local SQLite file (DATA_DIR/bothy-loop.db, default ./data/). Postgres
// remains the system of record when reachable (best-effort mirrors); SQLite is
// what survives restarts on venue floors with no tunnel. No new npm deps —
// better-sqlite3 would be nicer but this ships via node:sqlite-free SQL using
// the zero-dep `node:sqlite` module on Node 22+.
import { createHash } from "crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
interface WitnessEntry { hash: string; prev: string | null; at: string; pack: unknown }
// Cwd-independent: resolve next to the agent package (apps/agent/data) so the
// same SQLite file is used whether the agent is launched from the repo root or
// the package dir — durability must not depend on how you started it.
const DATA_DIR = process.env.BOTHY_DATA_DIR ?? fileURLToPath(new URL("../data/", import.meta.url));
mkdirSync(DATA_DIR, { recursive: true });
const loopDb = new DatabaseSync(join(DATA_DIR, "bothy-loop.db"));
loopDb.exec(`CREATE TABLE IF NOT EXISTS witness (hash TEXT PRIMARY KEY, prev TEXT, at TEXT, pack TEXT);
CREATE TABLE IF NOT EXISTS loop_subs (email TEXT, route_id TEXT, scenario TEXT, at TEXT, PRIMARY KEY (email, route_id));
CREATE TABLE IF NOT EXISTS loop_digests (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT, subject TEXT, body TEXT, case_href TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, n INTEGER);
INSERT OR IGNORE INTO counters (name, n) VALUES ('pilot_fallback', 0);`);
const witnessByHash = new Map<string, WitnessEntry>(
  (loopDb.prepare(`SELECT hash, prev, at, pack FROM witness ORDER BY rowid`).all() as { hash: string; prev: string | null; at: string; pack: string }[])
    .map((r) => [r.hash, { hash: r.hash, prev: r.prev, at: r.at, pack: JSON.parse(r.pack) } as WitnessEntry]),
);
const witnessPrev = (): string | null => {
  const row = loopDb.prepare(`SELECT hash FROM witness ORDER BY rowid DESC LIMIT 1`).get() as { hash: string } | undefined;
  return row?.hash ?? null;
};
const saveWitness = (e: WitnessEntry) => {
  loopDb.prepare(`INSERT OR IGNORE INTO witness (hash, prev, at, pack) VALUES (?, ?, ?, ?)`).run(e.hash, e.prev, e.at, JSON.stringify(e.pack));
  witnessByHash.set(e.hash, e);
};

app.get("/api/graph/scenarios", async (_req, res) => {
  try {
    const { SCENARIOS } = await import("./graph/scenarios");
    res.json({ scenarios: SCENARIOS });
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

app.post("/api/graph/scenario/:id/run", async (req, res) => {
  try {
    const { SCENARIOS } = await import("./graph/scenarios");
    const { runScenario } = await import("./graph/turing");
    const def = SCENARIOS.find((s: { id: string }) => s.id === req.params.id);
    if (!def) return res.status(404).json({ error: "unknown scenario" });
    const r = await runScenario(def.id);
    res.json({
      ...r,
      evidence: {
        scenario: def.id,
        title: def.title,
        cypher: def.cypher,
        graph: def.graph,
        ms: r.ms,
        count: r.count,
        sample: r.rows.slice(0, 5),
        historyTip: `GET /api/graph/history?graph=${encodeURIComponent(def.graph)} then POST /api/graph/diff with beforeCommit/afterCommit`,
      },
    });
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

app.get("/api/graph/bench", async (_req, res) => {
  // 4 fastest scenarios; total budget <2s on warm graphs.
  try {
    const { runScenario } = await import("./graph/turing");
    const ids = ["ukr-energy-near", "red-sea-d01", "logistics-high-risk", "chn-ownership"];
    const t0 = Date.now();
    const out: { id: string; ms: number; count: number }[] = [];
    for (const id of ids) {
      const r = await runScenario(id);
      out.push({ id, ms: r.ms, count: r.count });
    }
    res.json({ results: out, totalMs: Date.now() - t0 });
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

app.post("/api/graph/diff", async (req, res) => {
  try {
    const { graphQuery } = await import("./graph/turing");
    const graph = typeof req.body.graph === "string" ? req.body.graph : "";
    const beforeCommit = typeof req.body.beforeCommit === "string" ? req.body.beforeCommit : "";
    const afterCommit = typeof req.body.afterCommit === "string" ? req.body.afterCommit : "";
    const cypher = typeof req.body.cypher === "string" ? req.body.cypher : "";
    if (!graph || !beforeCommit || !afterCommit || !cypher) {
      return res.status(400).json({ error: "graph, beforeCommit, afterCommit, cypher are required" });
    }
    const key = (r: Record<string, unknown>) => JSON.stringify(r);
    const [before, after] = await Promise.all([
      graphQuery(graph, cypher, beforeCommit),
      graphQuery(graph, cypher, afterCommit),
    ]);
    const beforeKeys = new Set(before.rows.map(key));
    const afterKeys = new Set(after.rows.map(key));
    res.json({
      commits: { before: beforeCommit, after: afterCommit },
      graph,
      beforeCount: before.count,
      afterCount: after.count,
      addedSample: after.rows.filter((r) => !beforeKeys.has(key(r))).slice(0, 10),
      removedSample: before.rows.filter((r) => !afterKeys.has(key(r))).slice(0, 10),
    });
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

app.post("/api/graph/witness", async (req, res) => {
  try {
    const scenarioId = typeof req.body.scenarioId === "string" ? req.body.scenarioId : "";
    if (!scenarioId) return res.status(400).json({ error: "scenarioId is required" });
    const pack = {
      scenarioId,
      assessmentId: typeof req.body.assessmentId === "string" ? req.body.assessmentId : null,
      officer: typeof req.body.officer === "string" ? req.body.officer.slice(0, 120) : null,
      rows: Array.isArray(req.body.rows) ? (req.body.rows as unknown[]).slice(0, 50) : [],
      at: new Date().toISOString(),
    };
    const prev = witnessPrev();
    const hash = createHash("sha256").update(JSON.stringify({ prev, pack })).digest("hex");
    const entry: WitnessEntry = { hash, prev, at: pack.at, pack };
    saveWitness(entry);
    res.status(201).json({ hash, prev, at: pack.at, pack });
  } catch (e) {
    res.status(503).json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});

app.get("/api/graph/witness/:hash", async (req, res) => {
  const entry = witnessByHash.get(req.params.hash);
  if (!entry) return res.status(404).json({ error: "unknown witness hash" });
  const pack = entry.pack as Record<string, unknown>;
  // Distribution shape: every witness resolves to a shareable link + a live
  // re-run path, so the artifact points back into the product (Thiel loop).
  res.json({ ...entry, links: { page: `/witness/${entry.hash}`, rerun: pack.scenarioId ? `/watch?scenario=${pack.scenarioId}` : "/watch" } });
});

// ---- Digest loop (SQLite-durable; Postgres mirror best-effort) ----------------
interface LoopSub { email: string; routeId: string; scenario: string; at: string }
const getSubs = (routeId?: string): LoopSub[] => {
  const rows = (routeId
    ? loopDb.prepare(`SELECT email, route_id AS routeId, scenario, at FROM loop_subs WHERE route_id = ?`).all(routeId)
    : loopDb.prepare(`SELECT email, route_id AS routeId, scenario, at FROM loop_subs`).all()) as unknown as LoopSub[];
  return rows;
};

app.post("/api/loop/subscribe", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const routeId = typeof req.body.routeId === "string" ? req.body.routeId.trim().slice(0, 80) : "";
  const scenario = typeof req.body.scenario === "string" ? req.body.scenario.trim().slice(0, 40) : "defense";
  if (!isValidEmail(email)) return res.status(400).json({ error: "valid email is required" });
  if (!routeId) return res.status(400).json({ error: "routeId (lane / scenario id) is required" });
  if (!getSubs(routeId).some((s) => s.email === email)) {
    loopDb.prepare(`INSERT OR IGNORE INTO loop_subs (email, route_id, scenario, at) VALUES (?, ?, ?, ?)`)
      .run(email, routeId, scenario, new Date().toISOString());
  }
  try {
    const { q } = await import("./db");
    await q(`INSERT INTO subscriptions (route_id, email, scenario) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [routeId, email, scenario]);
  } catch { /* venue has no tunnel — SQLite is the record */ }
  const lane = getSubs(routeId);
  res.status(201).json({ ok: true, count: lane.length, total: getSubs().length });
});

app.post("/api/loop/notify", async (req, res) => {
  // Called after a blast run / approval: fans a digest to every subscriber on
  // the lane. Body: { routeId, label, summary, caseHref }.
  const routeId = typeof req.body.routeId === "string" ? req.body.routeId.trim() : "";
  const label = typeof req.body.label === "string" ? req.body.label.trim().slice(0, 40) : "ELEVATED";
  const summary = typeof req.body.summary === "string" ? req.body.summary.trim().slice(0, 500) : "";
  const caseHref = typeof req.body.caseHref === "string" ? req.body.caseHref.trim().slice(0, 300) : "/watch";
  if (!routeId) return res.status(400).json({ error: "routeId is required" });
  const targets = getSubs(routeId);
  const ins = loopDb.prepare(`INSERT INTO loop_digests (recipient, subject, body, case_href, at) VALUES (?, ?, ?, ?, ?)`);
  const at = new Date().toISOString();
  for (const t of targets) {
    ins.run(
      t.email,
      `Bothy: ${routeId} is ${label}`,
      `${summary}\n\nReview and forward: ${caseHref}\n\nBothy drafts; a duty officer approves.`,
      caseHref,
      at
    );
  }
  res.status(201).json({ ok: true, queued: targets.length });
});

app.get("/api/loop/digest", async (_req, res) => {
  // Public log-only digest wall: proves the loop fires without email infra.
  const digests = loopDb
    .prepare(`SELECT id, recipient AS "to", subject, body, case_href AS caseHref, at FROM loop_digests ORDER BY id DESC LIMIT 20`)
    .all();
  const { n } = loopDb.prepare(`SELECT COUNT(*) AS n FROM loop_subs`).get() as { n: number };
  res.json({ digests, subs: n });
});

// Pilot-interest funnel: Postgres audit-log when reachable, SQLite counter
// otherwise (merged), so the GTM number never resets on a venue floor.
const bumpPilot = () => {
  loopDb.exec(`UPDATE counters SET n = n + 1 WHERE name = 'pilot_fallback'`);
  return (loopDb.prepare(`SELECT n FROM counters WHERE name = 'pilot_fallback'`).get() as { n: number }).n;
};
const pilotPgCount = async (): Promise<number | null> => {
  try {
    const { q } = await import("./db");
    const { rows } = await q(`SELECT COUNT(*)::int AS n FROM audit_log WHERE action = 'pilot_interest'`);
    return (rows[0] as { n: number }).n;
  } catch {
    return null;
  }
};
app.post("/api/pilot-interest", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim().slice(0, 120) : "";
  const org = typeof req.body.org === "string" ? req.body.org.trim().slice(0, 160) : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
  if (!name) return res.status(400).json({ error: "name is required" });
  if (!org) return res.status(400).json({ error: "org is required" });
  if (!isValidEmail(email)) return res.status(400).json({ error: "valid email is required" });
  const role = typeof req.body.role === "string" ? req.body.role.trim().slice(0, 120) : "";
  const note = typeof req.body.note === "string" ? req.body.note.trim().slice(0, 500) : "";
  const pg = await pilotPgCount();
  if (pg != null) {
    try {
      await logAudit("live", email.toLowerCase(), "pilot_interest", `${name} <${email}> @ ${org}${role ? ` (${role})` : ""}${note ? ` — ${note}` : ""}`);
      const after = (await pilotPgCount()) ?? pg;
      return res.status(201).json({ ok: true, count: after, degraded: false });
    } catch { /* mirror failed — fall through */ }
  }
  return res.status(201).json({ ok: true, count: bumpPilot(), degraded: true });
});

app.get("/api/pilot-interest/count", async (_req, res) => {
  const pg = await pilotPgCount();
  const { n } = loopDb.prepare(`SELECT n FROM counters WHERE name = 'pilot_fallback'`).get() as { n: number };
  return res.json({ count: Math.max(n, pg ?? 0), degraded: pg == null });
});

app.get("/api/llm", (_req, res) => {
  res.json({ now: new Date().toISOString(), providers: providerSummary(), scripted: true });
});

// Roadmap §1: exercise the full provider chain end-to-end under realistic
// conditions (429s, timeouts, dead endpoints) and rehearse the scripted
// fallback so a degraded demo is a *boring* failure, not a visible one.
app.get("/api/llm/health", async (_req, res) => {
  const rehearsal = await rehearseChain();
  res.json(rehearsal);
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

app.get("/api/assessments/:id", async (req, res) => {
  const row = await getAssessment(req.params.id);
  if (!row) return res.status(404).json({ error: "assessment not found" });
  const notifications = await listNotifications(row.id);
  res.json({ ...row, notifications });
});

app.get("/api/scenario/:scenario/audit", async (req, res) => {
  res.json(await listAudit(req.params.scenario));
});

// Watch-my-road: subscribe an email to one route. Validates route + email,
// idempotent per (route, scenario, email). This is the marketing funnel AND
// the Good Neighbor proof: groups get pinged only on real decisions.
app.post("/api/subscriptions", async (req, res) => {
  const routeId = typeof req.body.routeId === "string" ? req.body.routeId.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
  const scenario = req.body.scenario === "flood" || req.body.scenario === "backtest" ? req.body.scenario : "live";
  if (!routeId) return res.status(400).json({ error: "routeId is required" });
  if (!isValidEmail(email)) return res.status(400).json({ error: "valid email is required" });
  const route = await getRoute(scenario, routeId);
  if (!route) return res.status(404).json({ error: "unknown route for scenario" });
  const sub = await createSubscription(routeId, email, scenario);
  await logAudit(scenario, email, "subscribe", `${route.name} (${routeId})`);
  res.status(201).json({ ...sub, routeName: route.name, count: await countSubscriptions() });
});

app.get("/api/subscriptions", async (req, res) => {
  const scenario = typeof req.query.scenario === "string" ? req.query.scenario : "live";
  const routeId = typeof req.query.routeId === "string" ? req.query.routeId : undefined;
  res.json({ subscriptions: await listSubscriptions(scenario, routeId), count: await countSubscriptions() });
});

// Digest trigger: send queued HIGH/ELEVATED notifications. Protect with
// DIGEST_TOKEN in production (cron + Coolify scheduled job call it).
app.post("/api/digest/send", async (req, res) => {
  const token = process.env.DIGEST_TOKEN;
  const provided = req.headers["x-digest-token"] ?? req.body.token;
  if (token && provided !== token) return res.status(401).json({ error: "unauthorized" });
  res.json({ ...(await sendDigest()), at: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`bothy-agent listening on :${PORT}`);
});