import { DatabaseSync } from "node:sqlite";
import { AccessError, type Principal } from "./auth";
import { DefenseStore } from "./defense";
import { getScenarioDef } from "./graph/scenarios";
import { captureGraphRun } from "./graph/witness";

export type LabOutcome = "allowed" | "blocked" | "duplicate" | "tamper-detected" | "verified";
export interface LabStep { label: string; outcome: LabOutcome; detail: string }
export interface LabResult { id: string; steps: LabStep[]; verdict: string }
export interface LabScenario { id: string; number: string; title: string; description: string; expect: string }

export const LAB_SCENARIOS: LabScenario[] = [
  { id: "self-approval", number: "01", title: "Analyst approves their own brief", description: "The person who prepared the evidence tries to approve it.", expect: "Expect BLOCKED" },
  { id: "replayed-approval", number: "02", title: "Replay an approval", description: "A reviewer decision is submitted twice, then reversed.", expect: "Expect DUPLICATE REFUSED" },
  { id: "wrong-owner", number: "03", title: "Wrong person acknowledges the task", description: "Another owner, then a reviewer, try to take over an assigned verification.", expect: "Expect BLOCKED" },
  { id: "skip-ahead", number: "04", title: "Skip a step in the workflow", description: "Assign before approval; record an outcome before acknowledging.", expect: "Expect BLOCKED" },
  { id: "tampered-evidence", number: "05", title: "Edit the captured evidence", description: "A stored evidence row is changed after the brief was drafted.", expect: "Expect BLOCKED" },
  { id: "tampered-audit", number: "06", title: "Rewrite the audit log", description: "After a legitimate run, one audit entry is edited directly in storage.", expect: "Expect TAMPER DETECTED" },
];

// Not listed as an attack: the legitimate end-to-end run used by the guided demo.
export const HAPPY_PATH = "happy-path";

const ANALYST: Principal = { subject: "analyst@lab", roles: ["analyst"] };
const REVIEWER: Principal = { subject: "reviewer@lab", roles: ["reviewer"] };
const OWNER_A: Principal = { subject: "owner-a@lab", roles: ["action-owner"] };
const OWNER_B: Principal = { subject: "owner-b@lab", roles: ["action-owner"] };
const DUE = "2030-01-01T00:00:00.000Z";

// Every scenario runs the real DefenseStore against a throwaway in-memory
// database, so the outcomes are the production rules' own, with no shared state.
function sandbox() {
  const db = new DatabaseSync(":memory:");
  const store = new DefenseStore(db);
  const def = getScenarioDef("gallium-chain");
  if (!def) throw new Error("gallium-chain scenario missing");
  const run = captureGraphRun(def, {
    rows: Array.from({ length: 5 }, (_, i) => ({ "p.name": `Lab platform ${i + 1}`, "c.name": `Lab component ${i + 1}`, "g.name": "Gallium" })),
    columns: ["p.name", "c.name", "g.name"], count: 5, ms: 1, graphCommit: "lab00001",
  });
  db.prepare("INSERT INTO graph_runs (id, run) VALUES (?, ?)").run(run.runId, JSON.stringify(run));
  return { db, store, run };
}

const refusal = (e: unknown) => e instanceof AccessError ? `${e.status} ${e.message}` : "refused";

function attempt(steps: LabStep[], label: string, operation: () => unknown, onBlock: LabOutcome = "blocked") {
  try { operation(); steps.push({ label, outcome: "allowed", detail: "Accepted" }); return true; }
  catch (e) { steps.push({ label, outcome: onBlock, detail: refusal(e) }); return false; }
}

function legitimate(store: DefenseStore, runId: string, steps: LabStep[]) {
  const brief = store.draft(runId, ANALYST);
  steps.push({ label: "Analyst drafts a cited brief", outcome: "allowed", detail: "Accepted" });
  store.review(brief.id, REVIEWER, "approved", "Lab approval");
  steps.push({ label: "Reviewer approves", outcome: "allowed", detail: "Accepted" });
  return brief;
}

export function runLab(id: string): LabResult | null {
  if (id !== HAPPY_PATH && !LAB_SCENARIOS.some((scenario) => scenario.id === id)) return null;
  const { db, store, run } = sandbox();
  const steps: LabStep[] = [];
  try {
    switch (id) {
      case HAPPY_PATH: {
        const brief = legitimate(store, run.runId, steps);
        store.assign(brief.id, REVIEWER, OWNER_A.subject, DUE);
        steps.push({ label: "Reviewer assigns owner-a", outcome: "allowed", detail: "Accepted" });
        store.advanceAction(brief.id, OWNER_A);
        steps.push({ label: "Owner acknowledges", outcome: "allowed", detail: "Accepted" });
        store.advanceAction(brief.id, OWNER_A, "Inventory and alternates checked against the modeled path.");
        steps.push({ label: "Owner records the observed outcome", outcome: "allowed", detail: "Accepted" });
        store.reassess(brief.id, REVIEWER, "accepted", "Finding accepted.");
        steps.push({ label: "Reviewer accepts the finding", outcome: "allowed", detail: "Accepted" });
        const audit = store.verifyAudit(brief.id);
        steps.push({ label: "Verify the audit chain", outcome: audit.ok ? "verified" : "tamper-detected", detail: `${audit.verified} of ${audit.events} entries chained` });
        return { id, steps, verdict: "Four roles, six recorded decisions, one chain that still verifies. Nothing here proves a real-world effect." };
      }
      case "self-approval": {
        const brief = store.draft(run.runId, ANALYST);
        steps.push({ label: "Analyst drafts a cited brief", outcome: "allowed", detail: "Accepted" });
        attempt(steps, "Analyst approves own brief", () => store.review(brief.id, ANALYST, "approved", "self"));
        steps.push({ label: "Brief status after the attempt", outcome: store.get(brief.id).status === "pending" ? "verified" : "allowed", detail: `Still ${store.get(brief.id).status}` });
        return { id, steps, verdict: "Preparing the evidence does not confer the authority to approve it." };
      }
      case "replayed-approval": {
        const brief = legitimate(store, run.runId, steps);
        attempt(steps, "Same approval submitted again", () => store.review(brief.id, REVIEWER, "approved", "again"), "duplicate");
        attempt(steps, "Reviewer reverses to rejected", () => store.review(brief.id, REVIEWER, "rejected", "flip"), "duplicate");
        return { id, steps, verdict: "A decision is recorded once. Replays change nothing and add no audit entry." };
      }
      case "wrong-owner": {
        const brief = legitimate(store, run.runId, steps);
        store.assign(brief.id, REVIEWER, OWNER_A.subject, DUE);
        steps.push({ label: "Reviewer assigns owner-a", outcome: "allowed", detail: "Accepted" });
        attempt(steps, "owner-b acknowledges owner-a's task", () => store.advanceAction(brief.id, OWNER_B));
        attempt(steps, "Reviewer acknowledges on the owner's behalf", () => store.advanceAction(brief.id, REVIEWER));
        attempt(steps, "owner-a acknowledges", () => store.advanceAction(brief.id, OWNER_A));
        return { id, steps, verdict: "Only the named owner can move their own task." };
      }
      case "skip-ahead": {
        const brief = store.draft(run.runId, ANALYST);
        steps.push({ label: "Analyst drafts a cited brief", outcome: "allowed", detail: "Accepted" });
        attempt(steps, "Assign an owner before approval", () => store.assign(brief.id, REVIEWER, OWNER_A.subject, DUE));
        store.review(brief.id, REVIEWER, "approved", "ok");
        store.assign(brief.id, REVIEWER, OWNER_A.subject, DUE);
        steps.push({ label: "Approve, then assign owner-a", outcome: "allowed", detail: "Accepted" });
        attempt(steps, "Record an outcome before acknowledging", () => store.advanceAction(brief.id, OWNER_A, "Done early"));
        return { id, steps, verdict: "Each stage opens only after the one before it is complete." };
      }
      case "tampered-evidence": {
        const brief = store.draft(run.runId, ANALYST);
        steps.push({ label: "Analyst drafts a cited brief", outcome: "allowed", detail: "Accepted" });
        const edited = { ...run, rows: run.rows.map((row, i) => i === 0 ? { ...row, "p.name": "Edited after drafting" } : row) };
        db.prepare("UPDATE graph_runs SET run = ? WHERE id = ?").run(JSON.stringify(edited), run.runId);
        steps.push({ label: "A stored evidence row is edited in the database", outcome: "tamper-detected", detail: "Row 1 changed" });
        attempt(steps, "Reviewer approves against changed evidence", () => store.review(brief.id, REVIEWER, "approved", "ok"));
        attempt(steps, "Open the cited evidence", () => store.evidence(brief.id));
        return { id, steps, verdict: "Every brief is bound to the hash of its evidence. A silent edit is refused, not trusted." };
      }
      default: {
        const brief = legitimate(store, run.runId, steps);
        store.assign(brief.id, REVIEWER, OWNER_A.subject, DUE);
        steps.push({ label: "Reviewer assigns owner-a", outcome: "allowed", detail: "Accepted" });
        const before = store.verifyAudit(brief.id);
        steps.push({ label: "Verify the audit chain", outcome: before.ok ? "verified" : "tamper-detected", detail: `${before.verified} of ${before.events} entries chained` });
        db.prepare("UPDATE defense_audit SET subject = 'intruder@lab' WHERE brief_id = ? AND action = 'approved'").run(brief.id);
        steps.push({ label: "The approval entry is rewritten in storage", outcome: "tamper-detected", detail: "subject set to intruder@lab" });
        const after = store.verifyAudit(brief.id);
        steps.push({ label: "Verify the audit chain again", outcome: after.ok ? "verified" : "tamper-detected", detail: after.ok ? "No break found" : `Chain breaks at entry ${after.brokenAt}` });
        return { id, steps, verdict: "Each entry commits to the one before it, so a rewrite shows up at the exact entry." };
      }
    }
  } finally { db.close(); }
}
