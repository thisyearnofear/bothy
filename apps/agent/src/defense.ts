import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { z } from "zod";
import type { DefenseBrief, DefenseCasePage, DefenseCaseFilter, GraphRun } from "../../../packages/shared/src/types";
import { AccessError, type Principal, type createAuth } from "./auth";
import { getScenarioDef } from "./graph/scenarios";
import { witnessRunId } from "./graph/witness";

export const evidenceHash = (run: GraphRun) => createHash("sha256").update(JSON.stringify(run)).digest("hex");

export class DefenseStore {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS graph_runs (id TEXT PRIMARY KEY, run TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS defense_briefs (id TEXT PRIMARY KEY, status TEXT NOT NULL, brief TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS defense_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, brief_id TEXT NOT NULL, subject TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS defense_creator ON defense_briefs(json_extract(brief, '$.createdBySubject'));
      CREATE INDEX IF NOT EXISTS defense_owner ON defense_briefs(json_extract(brief, '$.action.owner'));
      CREATE INDEX IF NOT EXISTS defense_created ON defense_briefs(json_extract(brief, '$.createdAt'), id);`);
  }
  private run(id: string): GraphRun {
    const row = this.db.prepare("SELECT run FROM graph_runs WHERE id = ?").get(id) as { run: string } | undefined;
    if (!row) throw new AccessError(404, "captured run not found");
    return JSON.parse(row.run);
  }
  get(id: string): DefenseBrief {
    const row = this.db.prepare("SELECT brief FROM defense_briefs WHERE id = ?").get(id) as { brief: string } | undefined;
    if (!row) throw new AccessError(404, "brief not found");
    return JSON.parse(row.brief);
  }
  evidence(id: string) {
    const brief = this.get(id);
    const run = this.run(brief.runId);
    if (evidenceHash(run) !== brief.evidenceHash) throw new AccessError(409, "captured evidence changed");
    return run;
  }
  audit(id: string) {
    this.get(id);
    return this.db.prepare("SELECT subject, action, at FROM defense_audit WHERE brief_id = ? ORDER BY id").all(id);
  }
  authorizeRead(id: string, principal: Principal): DefenseBrief {
    const brief = this.get(id);
    const demo = brief.accessScope === undefined || brief.accessScope === "synthetic-demo";
    const allowed = demo && (principal.roles.includes("reviewer") ||
      (principal.roles.includes("analyst") && brief.createdBySubject === principal.subject) ||
      (principal.roles.includes("action-owner") && brief.action?.owner === principal.subject));
    if (!allowed) throw new AccessError(404, "brief not found");
    return brief;
  }
  list(principal: Principal, offset: number, filter: DefenseCaseFilter = "all"): DefenseCasePage {
    if (!["all", "review", "assignment", "work"].includes(filter)) throw new AccessError(400, "invalid case filter");
    if ((filter === "review" || filter === "assignment") && !principal.roles.includes("reviewer")) throw new AccessError(403, "reviewer role required");
    if (filter === "work" && !principal.roles.includes("action-owner")) throw new AccessError(403, "action-owner role required");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new AccessError(400, "invalid case offset");
    const rows = this.db.prepare(`SELECT brief FROM defense_briefs
      WHERE COALESCE(json_extract(brief, '$.accessScope'), 'synthetic-demo') = 'synthetic-demo'
      AND (? = 1 OR (? = 1 AND json_extract(brief, '$.createdBySubject') = ?)
        OR (? = 1 AND json_extract(brief, '$.action.owner') = ?))
      AND (? = 'all' OR (? = 'review' AND (status = 'pending' OR (json_extract(brief, '$.action.status') = 'completed' AND json_extract(brief, '$.reassessment') IS NULL)))
        OR (? = 'assignment' AND status = 'approved' AND json_extract(brief, '$.action') IS NULL)
        OR (? = 'work' AND json_extract(brief, '$.action.owner') = ? AND json_extract(brief, '$.action.status') IN ('assigned', 'acknowledged')))
      ORDER BY json_extract(brief, '$.createdAt') DESC, id DESC LIMIT 21 OFFSET ?`).all(
      Number(principal.roles.includes("reviewer")), Number(principal.roles.includes("analyst")), principal.subject,
      Number(principal.roles.includes("action-owner")), principal.subject, filter, filter, filter, filter, principal.subject, offset,
    ) as { brief: string }[];
    return {
      cases: rows.slice(0, 20).map(({ brief }) => {
        const { id, title, createdAt, status, action, reassessment } = JSON.parse(brief) as DefenseBrief;
        return { id, title, createdAt, status, ...(reassessment ? { reassessment: { ...reassessment, note: "" } } : {}), ...(action ? { action: { owner: action.owner, dueAt: action.dueAt, status: action.status } } : {}) };
      }),
      nextOffset: rows.length > 20 ? offset + 20 : null,
    };
  }
  revise(id: string, runId: string, principal: Principal): DefenseBrief {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const parent = this.authorizeRead(id, principal);
      if (!principal.roles.some((role) => role === "analyst" || role === "reviewer")) throw new AccessError(403, "analyst or reviewer role required");
      const previous = this.evidence(id);
      const capture = this.run(runId);
      if (runId === parent.runId || capture.scenarioId !== previous.scenarioId || capture.graph !== previous.graph || capture.cypher !== previous.cypher) {
        throw new AccessError(409, "a separate capture of the same exposure question is required");
      }
      const child = this.draft(runId, principal);
      child.parentBriefId = parent.id;
      this.db.prepare("UPDATE defense_briefs SET brief = ? WHERE id = ?").run(JSON.stringify(child), child.id);
      this.db.prepare("INSERT INTO defense_audit (brief_id, subject, action, at) VALUES (?, ?, ?, ?)").run(child.id, principal.subject, "revision_created", new Date().toISOString());
      this.db.exec("COMMIT");
      return child;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  draft(runId: string, creator?: Principal): DefenseBrief {
    const run = this.run(runId);
    if (!run.graphCommit || !run.queryHash) throw new AccessError(409, "rerun the question to capture pinned evidence");
    const scenario = getScenarioDef(run.scenarioId);
    if (!scenario || scenario.cypher !== run.cypher || scenario.graph !== run.graph) throw new AccessError(409, "evidence does not match the reviewed catalogue");
    const brief: DefenseBrief = {
      accessScope: "synthetic-demo", ...(creator ? { createdBySubject: creator.subject } : {}),
      id: randomUUID(), runId, title: `${scenario.title}: verification brief`,
      createdAt: new Date().toISOString(), evidenceHash: evidenceHash(run),
      graphCommit: run.graphCommit, queryHash: run.queryHash, resultCount: run.count,
      generator: { id: "bothy-scripted", version: "defense-brief-v1", cloudInference: false },
      claims: run.rows.slice(0, 5).map((row, index) => ({
        text: run.columns.map((column) => `${column}: ${String(row[column] ?? "not recorded")}`).join("; "),
        citations: run.columns.map((column) => ({ runId, row: index, column })),
      })),
      gaps: [
        run.sourceBoundary,
        "The first five rows are summarized. Query limits may truncate results; captured rows are not a total programme-impact count.",
        "Inventory, qualified substitutes, delivery timing, and actual production effects are not established by these dependency rows.",
      ],
      recommendedAction: "Ask the programme supply-chain owner to verify inventory, substitutes, and delivery timing against the cited dependencies before an operational decision.",
      status: "pending",
    };
    this.db.prepare("INSERT INTO defense_briefs (id, status, brief) VALUES (?, ?, ?)").run(brief.id, brief.status, JSON.stringify(brief));
    return brief;
  }
  private transition(id: string, principal: Principal, action: string, change: (brief: DefenseBrief) => void) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const brief = this.authorizeRead(id, principal);
      change(brief);
      this.db.prepare("UPDATE defense_briefs SET status = ?, brief = ? WHERE id = ?").run(brief.status, JSON.stringify(brief), id);
      this.db.prepare("INSERT INTO defense_audit (brief_id, subject, action, at) VALUES (?, ?, ?, ?)").run(id, principal.subject, action, new Date().toISOString());
      this.db.exec("COMMIT");
      return brief;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  review(id: string, principal: Principal, decision: "approved" | "rejected", note: string) {
    if (!principal.roles.includes("reviewer")) throw new AccessError(403, "reviewer role required");
    return this.transition(id, principal, decision, (brief) => {
      if (brief.status !== "pending") throw new AccessError(409, "brief already decided");
      const run = this.run(brief.runId);
      if (evidenceHash(run) !== brief.evidenceHash ||
          run.graphCommit !== brief.graphCommit || run.queryHash !== brief.queryHash) {
        throw new AccessError(409, "captured evidence changed; generate a new brief");
      }
      brief.status = decision;
      brief.review = { subject: principal.subject, decision, note, at: new Date().toISOString() };
    });
  }
  assign(id: string, principal: Principal, owner: string, dueAt: string) {
    if (!principal.roles.includes("reviewer")) throw new AccessError(403, "reviewer role required");
    return this.transition(id, principal, "action_assigned", (brief) => {
      if (brief.status !== "approved") throw new AccessError(409, "only an approved brief can have an action");
      if (brief.action) throw new AccessError(409, "action already assigned");
      brief.action = { owner, dueAt, status: "assigned" };
    });
  }
  reassess(id: string, principal: Principal, decision: "accepted" | "further-verification", note: string) {
    if (!principal.roles.includes("reviewer")) throw new AccessError(403, "reviewer role required");
    return this.transition(id, principal, `finding_${decision}`, (brief) => {
      if (brief.status !== "approved" || brief.action?.status !== "completed" || !brief.action.outcome) throw new AccessError(409, "a completed owner finding is required");
      if (brief.reassessment) throw new AccessError(409, "finding already reassessed");
      this.evidence(id);
      brief.reassessment = { subject: principal.subject, decision, note, at: new Date().toISOString() };
    });
  }
  advanceAction(id: string, principal: Principal, outcome?: string) {
    if (!principal.roles.includes("action-owner")) throw new AccessError(403, "action-owner role required");
    return this.transition(id, principal, outcome === undefined ? "action_acknowledged" : "action_completed", (brief) => {
      if (!brief.action || brief.action.owner !== principal.subject) throw new AccessError(403, "only the assigned owner can update this action");
      const expected = outcome === undefined ? "assigned" : "acknowledged";
      if (brief.action.status !== expected) throw new AccessError(409, "action is not in the required state");
      brief.action.status = outcome === undefined ? "acknowledged" : "completed";
      if (outcome === undefined) brief.action.acknowledgedAt = new Date().toISOString();
      else {
        brief.action.outcome = outcome;
        brief.action.completedAt = new Date().toISOString();
      }
    });
  }
}

const reviewBody = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(2000).default("") }).strict();
const assignmentBody = z.object({ owner: z.string().trim().min(1).max(200), dueAt: z.iso.datetime() }).strict();
const reassessmentBody = z.object({ decision: z.enum(["accepted", "further-verification"]), note: z.string().trim().min(1).max(2000) }).strict();
const outcomeBody = z.object({ outcome: z.string().trim().min(1).max(2000) }).strict();

export function defenseRouter(db: DatabaseSync, auth: ReturnType<typeof createAuth>) {
  const router = Router();
  const store = new DefenseStore(db);
  const handle = (operation: () => unknown, res: import("express").Response, created = false) => {
    try { res.status(created ? 201 : 200).json(operation()); }
    catch (e) {
      const error = e instanceof AccessError ? e : new AccessError(503, "defence record unavailable");
      res.status(error.status).json({ error: error.message });
    }
  };
  router.get("/session", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!req.headers.authorization) return res.json({ configured: auth.configured, authenticated: false, roles: [] });
    try { res.json({ configured: auth.configured, authenticated: true, ...(await auth.authenticate(req.headers.authorization)) }); }
    catch (e) { const error = e as AccessError; res.status(error.status).json({ error: error.message }); }
  });
  // Public/synthetic demo drafts only. Private customer evidence is a later gate.
  router.post("/briefs", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const runId = witnessRunId(req.body);
    if (!runId) return res.status(400).json({ error: "only runId is accepted" });
    let creator: Principal | undefined;
    if (req.headers.authorization) {
      try { creator = await auth.authenticate(req.headers.authorization); }
      catch (e) { const error = e as AccessError; return res.status(error.status).json({ error: error.message }); }
    }
    handle(() => store.draft(runId, creator), res, true);
  });
  router.use(auth.require("analyst", "reviewer", "action-owner"));
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/briefs/page/:offset", (req, res) => {
    if (Object.keys(req.query).length || !/^(0|[1-9]\d*)$/.test(req.params.offset)) return res.status(400).json({ error: "only a numeric case offset is accepted" });
    handle(() => store.list(res.locals.principal, Number(req.params.offset)), res);
  });
  router.get("/briefs/page/:filter/:offset", (req, res) => {
    if (Object.keys(req.query).length || !/^(0|[1-9]\d*)$/.test(req.params.offset) || !["all", "review", "assignment", "work"].includes(req.params.filter)) return res.status(400).json({ error: "invalid case page" });
    handle(() => store.list(res.locals.principal, Number(req.params.offset), req.params.filter as DefenseCaseFilter), res);
  });
  router.post("/briefs/:id/revisions", (req, res) => {
    const runId = witnessRunId(req.body);
    if (!runId) return res.status(400).json({ error: "only runId is accepted" });
    handle(() => store.revise(req.params.id, runId, res.locals.principal), res, true);
  });
  router.get("/owners", (_req, res) => {
    if (!res.locals.principal.roles.includes("reviewer")) return res.status(403).json({ error: "reviewer role required" });
    handle(() => ({ owners: auth.eligibleOwners() }), res);
  });
  router.get("/briefs/:id", (req, res) => handle(() => store.authorizeRead(req.params.id, res.locals.principal), res));
  router.get("/briefs/:id/evidence", (req, res) => handle(() => { store.authorizeRead(req.params.id, res.locals.principal); return store.evidence(req.params.id); }, res));
  router.get("/briefs/:id/audit", (req, res) => handle(() => { store.authorizeRead(req.params.id, res.locals.principal); return { entries: store.audit(req.params.id) }; }, res));
  router.post("/briefs/:id/review", (req, res) => {
    const parsed = reviewBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "decision and optional note required; identity/evidence fields are forbidden" });
    handle(() => store.review(req.params.id, res.locals.principal, parsed.data.decision, parsed.data.note), res);
  });
  router.post("/briefs/:id/action", (req, res) => {
    const parsed = assignmentBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "owner subject and ISO dueAt required" });
    if (!auth.canOwn(parsed.data.owner)) return res.status(400).json({ error: "owner must be an assigned action-owner principal" });
    handle(() => store.assign(req.params.id, res.locals.principal, parsed.data.owner, parsed.data.dueAt), res);
  });
  router.post("/briefs/:id/action/acknowledge", (req, res) => {
    if (!req.body || Object.keys(req.body).length) return res.status(400).json({ error: "acknowledgment body must be empty" });
    handle(() => store.advanceAction(req.params.id, res.locals.principal), res);
  });
  router.post("/briefs/:id/reassessment", (req, res) => {
    const parsed = reassessmentBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "finding decision and nonempty rationale required; identity fields forbidden" });
    handle(() => store.reassess(req.params.id, res.locals.principal, parsed.data.decision, parsed.data.note), res);
  });
  router.post("/briefs/:id/action/outcome", (req, res) => {
    const parsed = outcomeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "a nonempty outcome is required" });
    handle(() => store.advanceAction(req.params.id, res.locals.principal, parsed.data.outcome), res);
  });
  return router;
}
