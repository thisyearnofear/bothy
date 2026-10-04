import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { AccessError } from "./auth";
import { DefenseStore } from "./defense";
import { ANALYST, DUE, OWNER_A, REVIEWER, refusal, sandbox, type LabStep } from "./lab";
import type { GraphRun } from "../../../packages/shared/src/types";

export type SandboxAction =
  | "approve" | "reject" | "assign" | "acknowledge" | "complete" | "accept" | "verify"
  | "attack-self-approve" | "attack-replay" | "attack-edit-evidence" | "attack-rewrite-audit";

export interface SandboxState {
  sid: string;
  briefStatus: string;
  actionStatus: string;
  reassessed: boolean;
  evidenceEdited: boolean;
  claims: string[];
  steps: LabStep[];
  available: SandboxAction[];
}

interface Session { db: DatabaseSync; store: DefenseStore; runId: string; briefId: string; steps: LabStep[]; evidenceEdited: boolean; touched: number }

const MAX_SESSIONS = 100;
const TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, Session>();

function sweep() {
  const now = Date.now();
  for (const [id, session] of sessions) if (now - session.touched > TTL_MS) { session.db.close(); sessions.delete(id); }
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.get(oldest)?.db.close();
    sessions.delete(oldest);
  }
}

function state(sid: string, session: Session): SandboxState {
  const brief = session.store.get(session.briefId);
  const actionStatus = brief.action?.status ?? "none";
  const available: SandboxAction[] = ["verify"];
  if (brief.status === "pending") available.push("approve", "reject");
  if (brief.status === "approved" && !brief.action) available.push("assign");
  if (actionStatus === "assigned") available.push("acknowledge");
  if (actionStatus === "acknowledged") available.push("complete");
  if (actionStatus === "completed" && !brief.reassessment) available.push("accept");
  available.push("attack-self-approve", "attack-edit-evidence", "attack-rewrite-audit");
  if (brief.status !== "pending") available.push("attack-replay");
  return {
    sid, briefStatus: brief.status, actionStatus, reassessed: Boolean(brief.reassessment), evidenceEdited: session.evidenceEdited,
    claims: brief.claims.slice(0, 3).map((claim) => claim.text), steps: session.steps, available,
  };
}

// A stateful variant of the lab: each action runs the real DefenseStore against
// the session's own in-memory database. When `source` holds the requested real
// graph capture it is copied in, so the brief cites the rows the viewer saw.
export function createSandbox(source: DatabaseSync, runId?: string): SandboxState {
  sweep();
  const base = sandbox();
  let usedRunId = base.run.runId;
  if (runId) {
    const row = source.prepare("SELECT run FROM graph_runs WHERE id = ?").get(runId) as { run: string } | undefined;
    if (row) {
      const captured = JSON.parse(row.run) as GraphRun;
      if (captured.scenarioId === "gallium-chain" || captured.scenarioId === "red-sea-d01") {
        base.db.prepare("INSERT OR REPLACE INTO graph_runs (id, run) VALUES (?, ?)").run(captured.runId, row.run);
        usedRunId = captured.runId;
      }
    }
  }
  const steps: LabStep[] = [];
  let briefId: string;
  try {
    briefId = base.store.draft(usedRunId, ANALYST).id;
  } catch {
    // Real captures can lack a pinned commit; fall back to the fixture rather than failing the story.
    usedRunId = base.run.runId;
    briefId = base.store.draft(usedRunId, ANALYST).id;
  }
  steps.push({ label: "Analyst drafts a cited brief", outcome: "allowed", detail: "Accepted" });
  const sid = randomUUID();
  const session: Session = { db: base.db, store: base.store, runId: usedRunId, briefId, steps, evidenceEdited: false, touched: Date.now() };
  sessions.set(sid, session);
  return state(sid, session);
}

export function actSandbox(sid: string, action: SandboxAction): SandboxState | null {
  const session = sessions.get(sid);
  if (!session) return null;
  session.touched = Date.now();
  const { store, db, briefId, steps } = session;
  const run = (label: string, operation: () => unknown, blocked: LabStep["outcome"] = "blocked") => {
    try { operation(); steps.push({ label, outcome: "allowed", detail: "Accepted" }); }
    catch (e) { steps.push({ label, outcome: e instanceof AccessError ? blocked : "blocked", detail: refusal(e) }); }
  };
  switch (action) {
    case "approve": run("Reviewer approves", () => store.review(briefId, REVIEWER, "approved", "Approved in the story")); break;
    case "reject": run("Reviewer rejects", () => store.review(briefId, REVIEWER, "rejected", "Rejected in the story")); break;
    case "assign": run("Reviewer assigns owner-a", () => store.assign(briefId, REVIEWER, OWNER_A.subject, DUE)); break;
    case "acknowledge": run("Owner acknowledges", () => store.advanceAction(briefId, OWNER_A)); break;
    case "complete": run("Owner records the observed outcome", () => store.advanceAction(briefId, OWNER_A, "Inventory, alternates and timing checked against the cited path.")); break;
    case "accept": run("Reviewer accepts the finding", () => store.reassess(briefId, REVIEWER, "accepted", "Finding accepted.")); break;
    case "attack-self-approve": run("Attack: the analyst approves their own brief", () => store.review(briefId, ANALYST, "approved", "self")); break;
    case "attack-replay": run("Attack: the approval is submitted again", () => store.review(briefId, REVIEWER, "approved", "again"), "duplicate"); break;
    case "attack-edit-evidence": {
      const row = db.prepare("SELECT run FROM graph_runs WHERE id = ?").get(session.runId) as { run: string };
      const captured = JSON.parse(row.run) as GraphRun;
      const edited = { ...captured, rows: captured.rows.map((r, i) => i === 0 ? { ...r, [captured.columns[0]]: "Edited after drafting" } : r) };
      db.prepare("UPDATE graph_runs SET run = ? WHERE id = ?").run(JSON.stringify(edited), session.runId);
      session.evidenceEdited = true;
      steps.push({ label: "Attack: a stored evidence row is edited in the database", outcome: "tamper-detected", detail: "Row 1 changed" });
      run("Anyone opens the cited evidence", () => store.evidence(briefId));
      break;
    }
    case "attack-rewrite-audit": {
      const target = db.prepare("SELECT id FROM defense_audit WHERE brief_id = ? ORDER BY id LIMIT 1").get(briefId) as { id: number } | undefined;
      if (!target) { steps.push({ label: "Attack: rewrite an audit entry", outcome: "blocked", detail: "No audit entry exists yet. Make a decision first." }); break; }
      db.prepare("UPDATE defense_audit SET subject = 'intruder@lab' WHERE id = ?").run(target.id);
      steps.push({ label: "Attack: the first audit entry is rewritten in storage", outcome: "tamper-detected", detail: "subject set to intruder@lab" });
      break;
    }
    case "verify": {
      const result = store.verifyAudit(briefId);
      if (result.events === 0) steps.push({ label: "Verify the audit chain", outcome: "verified", detail: "No decisions recorded yet" });
      else steps.push({ label: "Verify the audit chain", outcome: result.ok ? "verified" : "tamper-detected", detail: result.ok ? `${result.verified} of ${result.events} entries chained` : `Chain breaks at entry ${result.brokenAt}` });
      break;
    }
  }
  return state(sid, session);
}
