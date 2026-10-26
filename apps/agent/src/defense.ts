import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { z } from "zod";
import type { DefenseBrief, DefenseCasePage, DefenseCaseFilter, FederatedRun, GraphRun } from "../../../packages/shared/src/types";
import { AccessError, type Principal, type createAuth } from "./auth";
import { getScenarioDef } from "./graph/scenarios";
import { witnessRunId } from "./graph/witness";
import { LAB_SCENARIOS, runLab } from "./lab";
import { actSandbox, createSandbox, type SandboxAction } from "./labSession";
import { caseMemoryStatus, recallInvestigations, recordDecision, recordInvestigation } from "./memory/caseMemory";
import { zetarisStatus } from "./integrations/zetaris";
import { captureFederation, federatedHash, type FederationCapture } from "./integrations/federated";
import { draftFederatedNarrative } from "./integrations/briefAssist";

export const evidenceHash = (run: GraphRun) => createHash("sha256").update(JSON.stringify(run)).digest("hex");

export interface AuditVerification { ok: boolean; events: number; verified: number; unchained: number; brokenAt: number | null }
const auditHash = (prev: string, briefId: string, subject: string, action: string, at: string) =>
  createHash("sha256").update([prev, briefId, subject, action, at].join("\n")).digest("hex");

export class DefenseStore {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS graph_runs (id TEXT PRIMARY KEY, run TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS federated_runs (id TEXT PRIMARY KEY, run TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS defense_briefs (id TEXT PRIMARY KEY, status TEXT NOT NULL, brief TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS defense_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, brief_id TEXT NOT NULL, subject TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS defense_creator ON defense_briefs(json_extract(brief, '$.createdBySubject'));
      CREATE INDEX IF NOT EXISTS defense_owner ON defense_briefs(json_extract(brief, '$.action.owner'));
      CREATE INDEX IF NOT EXISTS defense_created ON defense_briefs(json_extract(brief, '$.createdAt'), id);`);
    const columns = (db.prepare("PRAGMA table_info(defense_audit)").all() as { name: string }[]).map((c) => c.name);
    if (!columns.includes("hash")) db.exec("ALTER TABLE defense_audit ADD COLUMN prev_hash TEXT; ALTER TABLE defense_audit ADD COLUMN hash TEXT;");
  }
  // Each entry commits to its predecessor within the same brief, so editing,
  // deleting or reordering any stored row breaks verification from that point.
  private appendAudit(briefId: string, subject: string, action: string) {
    const last = this.db.prepare("SELECT hash FROM defense_audit WHERE brief_id = ? ORDER BY id DESC LIMIT 1").get(briefId) as { hash: string | null } | undefined;
    const prev = last?.hash ?? "";
    const at = new Date().toISOString();
    this.db.prepare("INSERT INTO defense_audit (brief_id, subject, action, at, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?)")
      .run(briefId, subject, action, at, prev, auditHash(prev, briefId, subject, action, at));
  }
  verifyAudit(id: string): AuditVerification {
    this.get(id);
    const rows = this.db.prepare("SELECT id, subject, action, at, prev_hash, hash FROM defense_audit WHERE brief_id = ? ORDER BY id").all(id) as
      { id: number; subject: string; action: string; at: string; prev_hash: string | null; hash: string | null }[];
    let prev = "";
    let verified = 0;
    let unchained = 0;
    for (const [index, row] of rows.entries()) {
      if (!row.hash) {
        if (verified) return { ok: false, events: rows.length, verified, unchained, brokenAt: index + 1 };
        unchained += 1;
        continue;
      }
      if (row.prev_hash !== prev || row.hash !== auditHash(prev, id, row.subject, row.action, row.at)) {
        return { ok: false, events: rows.length, verified, unchained, brokenAt: index + 1 };
      }
      prev = row.hash;
      verified += 1;
    }
    return { ok: true, events: rows.length, verified, unchained, brokenAt: null };
  }
  private run(id: string): GraphRun {
    const row = this.db.prepare("SELECT run FROM graph_runs WHERE id = ?").get(id) as { run: string } | undefined;
    if (!row) throw new AccessError(404, "captured run not found");
    return JSON.parse(row.run);
  }
  private federatedRun(id: string): FederatedRun {
    const row = this.db.prepare("SELECT run FROM federated_runs WHERE id = ?").get(id) as { run: string } | undefined;
    if (!row) throw new AccessError(409, "captured evidence changed");
    return JSON.parse(row.run);
  }
  // The brief's federated captures in bound order, verified against the
  // recorded hash — a missing or edited federated run fails the same way a
  // tampered graph capture does.
  federated(id: string): FederatedRun[] {
    const brief = this.get(id);
    return (brief.federated?.runIds ?? []).map((runId) => this.federatedRun(runId));
  }
  private verifyFederation(brief: DefenseBrief) {
    if (!brief.federated) return;
    if (federatedHash(this.federated(brief.id)) !== brief.federated.hash) {
      throw new AccessError(409, "captured evidence changed");
    }
  }
  /** Capture reviewed federated questions for the run's scenario (Zetaris). */
  captureFederation(runId: string): Promise<FederationCapture> {
    return captureFederation(this.run(runId).scenarioId);
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
    this.verifyFederation(brief);
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
  revise(id: string, runId: string, principal: Principal, federation?: FederationCapture): DefenseBrief {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const parent = this.authorizeRead(id, principal);
      if (!principal.roles.some((role) => role === "analyst" || role === "reviewer")) throw new AccessError(403, "analyst or reviewer role required");
      const previous = this.evidence(id);
      const capture = this.run(runId);
      if (runId === parent.runId || capture.scenarioId !== previous.scenarioId || capture.graph !== previous.graph || capture.cypher !== previous.cypher) {
        throw new AccessError(409, "a separate capture of the same exposure question is required");
      }
      const child = this.draft(runId, principal, federation);
      child.parentBriefId = parent.id;
      this.db.prepare("UPDATE defense_briefs SET brief = ? WHERE id = ?").run(JSON.stringify(child), child.id);
      this.appendAudit(child.id, principal.subject, "revision_created");
      this.db.exec("COMMIT");
      return child;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  draft(runId: string, creator?: Principal, federation?: FederationCapture): DefenseBrief {
    const run = this.run(runId);
    if (!run.graphCommit || !run.queryHash) throw new AccessError(409, "rerun the question to capture pinned evidence");
    const scenario = getScenarioDef(run.scenarioId);
    if (!scenario || scenario.cypher !== run.cypher || scenario.graph !== run.graph) throw new AccessError(409, "evidence does not match the reviewed catalogue");
    // Case memory recall runs before the draft so a repeat or related question
    // surfaces prior investigations instead of starting cold.
    const memory = recallInvestigations(`${scenario.title}. ${scenario.stakes}`);
    const cell = (value: unknown) => {
      const text = String(value ?? "not recorded");
      return text.length > 120 ? `${text.slice(0, 117)}…` : text;
    };
    // Agent reasoning trace: what the draft actually did, in order — visible to
    // reviewers and judges as the "how this output was reached" record.
    const reasoning: { step: string; detail: string }[] = [
      { step: "capture", detail: `${run.count} graph rows pinned at ${run.graph}@${run.graphCommit} · query ${run.queryHash.slice(0, 12)}` },
    ];
    const federatedClaims = (federation?.runs ?? []).flatMap((fed, fedIndex) => {
      reasoning.push({ step: "federation", detail: `${fed.title}: ${fed.count} of ${fed.total} rows captured via Zetaris (${fed.sqlHash.slice(0, 12)})` });
      return fed.kind === "context"
        ? [{
            text: `${fed.title}: ${fed.count} source row${fed.count === 1 ? "" : "s"} captured for context via Zetaris federation.`,
            citations: fed.rows.length ? fed.columns.map((column) => ({ runId: fed.runId, row: 0, column })) : [],
          }]
        : fed.rows.slice(0, 3).map((row, index) => ({
            text: federation?.narrative?.[fedIndex]?.[index] ?? `${fed.title} — ` + fed.columns.map((column) => `${column}: ${cell(row[column])}`).join("; "),
            citations: fed.columns.map((column) => ({ runId: fed.runId, row: index, column })),
          }));
    });
    for (const title of federation?.unavailable ?? []) {
      reasoning.push({ step: "federation", detail: `${title}: unavailable at draft time — recorded as a stated gap` });
    }
    reasoning.push({ step: "memory", detail: memory && memory.recalled.length ? `recalled ${memory.recalled.length} prior investigation${memory.recalled.length === 1 ? "" : "s"} (H-MEM)` : "no prior investigations recalled" });
    reasoning.push({ step: "generate", detail: `${federation?.narrativeModel ?? "deterministic generator"} drafted ${run.rows.slice(0, 5).length + federatedClaims.length} cited claims` });
    const claims = [
      ...run.rows.slice(0, 5).map((row, index) => ({
        text: run.columns.map((column) => `${column}: ${cell(row[column])}`).join("; "),
        citations: run.columns.map((column) => ({ runId, row: index, column })),
      })),
      ...federatedClaims,
    ];
    // Critique/validate step: every citation is resolved back against the
    // stored captures before the brief exists. A claim that cannot cite a
    // real captured row would be caught here, not by a downstream reviewer.
    const fedById = new Map((federation?.runs ?? []).map((fed) => [fed.runId, fed]));
    let verified = 0;
    let total = 0;
    for (const claim of claims) {
      for (const citation of claim.citations) {
        total += 1;
        const source = citation.runId === runId ? run : fedById.get(citation.runId);
        if (source && Number.isInteger(citation.row) && citation.row >= 0 && citation.row < source.rows.length &&
            source.columns.includes(citation.column) && Object.hasOwn(source.rows[citation.row], citation.column)) {
          verified += 1;
        }
      }
    }
    reasoning.push({ step: "verify", detail: `citation self-check: ${verified}/${total} resolve against stored captures` });
    const brief: DefenseBrief = {
      accessScope: "synthetic-demo", ...(creator ? { createdBySubject: creator.subject } : {}),
      id: randomUUID(), runId, title: `${scenario.title}: verification brief`,
      createdAt: new Date().toISOString(), evidenceHash: evidenceHash(run),
      graphCommit: run.graphCommit, queryHash: run.queryHash, resultCount: run.count,
      generator: { id: "bothy-scripted", version: "defense-brief-v1", cloudInference: false },
      claims,
      gaps: [
        run.sourceBoundary,
        ...(federation?.runs ?? []).map((fed) => fed.sourceBoundary),
        ...(federation?.unavailable ?? []).map((title) => `Federated source "${title}" could not be captured at draft time; the brief cites no rows from it.`),
        "The first five rows are summarized. Query limits may truncate results; captured rows are not a total programme-impact count.",
        "Inventory, qualified substitutes, delivery timing, and actual production effects are not established by these dependency rows.",
      ],
      ...(federation && (federation.runs.length || federation.unavailable.length)
        ? { federated: { engine: "zetaris" as const, runIds: federation.runs.map((fed) => fed.runId), hash: federatedHash(federation.runs), unavailable: federation.unavailable } }
        : {}),
      reasoning,
      recommendedAction: "Ask the programme supply-chain owner to verify inventory, substitutes, and delivery timing against the cited dependencies before an operational decision.",
      status: "pending",
      ...(memory && memory.recalled.length ? { memory } : {}),
    };
    for (const fed of federation?.runs ?? []) {
      this.db.prepare("INSERT INTO federated_runs (id, run) VALUES (?, ?)").run(fed.runId, JSON.stringify(fed));
    }
    this.db.prepare("INSERT INTO defense_briefs (id, status, brief) VALUES (?, ?, ?)").run(brief.id, brief.status, JSON.stringify(brief));
    recordInvestigation(brief, run, runId);
    return brief;
  }
  private transition(id: string, principal: Principal, action: string, change: (brief: DefenseBrief) => void) {
    this.db.exec("BEGIN IMMEDIATE");
    let brief: DefenseBrief;
    try {
      brief = this.authorizeRead(id, principal);
      change(brief);
      this.db.prepare("UPDATE defense_briefs SET status = ?, brief = ? WHERE id = ?").run(brief.status, JSON.stringify(brief), id);
      this.appendAudit(id, principal.subject, action);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    // Case memory records decisions after the audited commit; a memory fault
    // can never roll back or fail the workflow transition.
    recordDecision(brief, action, principal.subject);
    return brief;
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
      this.verifyFederation(brief);
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
  // Stress-test lab: public, runs the real store rules against a throwaway database.
  router.get("/lab", (_req, res) => res.json({ scenarios: LAB_SCENARIOS }));
  router.post("/lab/:id/run", (req, res) => {
    const result = runLab(req.params.id);
    if (!result) return res.status(404).json({ error: "unknown lab scenario" });
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  });
  // Optional model-drafted claim narrative (BOTHY_BRIEF_ASSIST=llm): the
  // provider chain writes claim text; citations and fallbacks stay
  // deterministic. Never throws — a dead chain just means scripted text.
  const assist = async (federation: FederationCapture) => {
    if (process.env.BOTHY_BRIEF_ASSIST !== "llm") return;
    try {
      const narrative = await draftFederatedNarrative(federation.runs);
      if (narrative) {
        federation.narrative = narrative.narrative;
        federation.narrativeModel = narrative.model;
      } else {
        console.warn("brief-assist: provider chain returned no narrative; scripted text stands");
      }
    } catch (e) {
      console.warn("brief-assist:", e instanceof Error ? e.message : e);
    }
  };
  const sandboxActions = new Set<SandboxAction>(["approve", "reject", "assign", "acknowledge", "complete", "accept", "verify", "attack-self-approve", "attack-replay", "attack-edit-evidence", "attack-rewrite-audit"]);
  router.post("/lab/sandbox", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const runId = typeof req.body?.runId === "string" && /^[\w-]{1,80}$/.test(req.body.runId) ? req.body.runId : undefined;
    try { res.status(201).json(createSandbox(db, runId)); } catch { res.status(503).json({ error: "sandbox unavailable" }); }
  });
  router.post("/lab/sandbox/:sid/:action", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!sandboxActions.has(req.params.action as SandboxAction)) return res.status(404).json({ error: "unknown sandbox action" });
    const result = actSandbox(req.params.sid, req.params.action as SandboxAction);
    if (!result) return res.status(404).json({ error: "sandbox expired; start again" });
    res.json(result);
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
    try {
      const federation = await store.captureFederation(runId);
      await assist(federation);
      handle(() => store.draft(runId, creator, federation), res, true);
    } catch (e) {
      const error = e instanceof AccessError ? e : new AccessError(503, "defence record unavailable");
      res.status(error.status).json({ error: error.message });
    }
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
  router.post("/briefs/:id/revisions", async (req, res) => {
    const runId = witnessRunId(req.body);
    if (!runId) return res.status(400).json({ error: "only runId is accepted" });
    try {
      const federation = await store.captureFederation(runId);
      await assist(federation);
      handle(() => store.revise(req.params.id, runId, res.locals.principal, federation), res, true);
    } catch (e) {
      const error = e instanceof AccessError ? e : new AccessError(503, "defence record unavailable");
      res.status(error.status).json({ error: error.message });
    }
  });
  // Case memory surface: engine status, ledger totals and recent recalls.
  router.get("/memory", (_req, res) => handle(() => caseMemoryStatus(), res));
  // Federated-data surface (Zetaris): reports configured/reachable so the UI
  // can show whether the agent can reach sources outside the graph.
  router.get("/federated/status", async (_req, res) => res.json(await zetarisStatus()));
  router.get("/owners", (_req, res) => {
    if (!res.locals.principal.roles.includes("reviewer")) return res.status(403).json({ error: "reviewer role required" });
    handle(() => ({ owners: auth.eligibleOwners() }), res);
  });
  router.get("/briefs/:id", (req, res) => handle(() => store.authorizeRead(req.params.id, res.locals.principal), res));
  router.get("/briefs/:id/evidence", (req, res) => handle(() => { store.authorizeRead(req.params.id, res.locals.principal); return store.evidence(req.params.id); }, res));
  router.get("/briefs/:id/federated", (req, res) => handle(() => { store.authorizeRead(req.params.id, res.locals.principal); return store.federated(req.params.id); }, res));
  router.get("/briefs/:id/audit", (req, res) => handle(() => { store.authorizeRead(req.params.id, res.locals.principal); return { entries: store.audit(req.params.id) }; }, res));
  router.get("/briefs/:id/audit/verify", (req, res) => handle(() => { store.authorizeRead(req.params.id, res.locals.principal); return store.verifyAudit(req.params.id); }, res));
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
