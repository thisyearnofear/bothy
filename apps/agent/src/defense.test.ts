import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { createAuth } from "./auth";
import { authFixture } from "./test/authFixture";
import { DefenseStore, defenseRouter } from "./defense";
import { captureGraphRun } from "./graph/witness";
import { SCENARIOS } from "./graph/scenarios";

function fixture() {
  const db = new DatabaseSync(":memory:");
  const store = new DefenseStore(db);
  const run = captureGraphRun(SCENARIOS[1], {
    rows: Array.from({ length: 8 }, (_, i) => ({ "p.name": `Test platform ${i}` })),
    columns: ["p.name"], count: 8, ms: 1, graphCommit: "abc12345",
  });
  db.prepare("INSERT INTO graph_runs (id, run) VALUES (?, ?)").run(run.runId, JSON.stringify(run));
  return { db, store, run };
}

test("deterministic brief binds pinned evidence/query/generator versions and exact row citations", () => {
  const { db, store, run } = fixture();
  try {
    const brief = store.draft(run.runId);
    assert.equal(brief.graphCommit, run.graphCommit);
    assert.equal(brief.queryHash, run.queryHash);
    assert.equal(brief.status, "pending");
    assert.equal(brief.generator.cloudInference, false);
    assert.equal(brief.claims.length, 5);
    for (const claim of brief.claims) {
      const citation = claim.citations[0];
      assert.equal(citation.runId, run.runId);
      assert.ok(claim.text.includes(String(run.rows[citation.row][citation.column])));
    }
    assert.match(brief.gaps.join(" "), /not established/);
    const unpinned = { ...run, graphCommit: null };
    db.prepare("UPDATE graph_runs SET run = ? WHERE id = ?").run(JSON.stringify(unpinned), run.runId);
    assert.throws(() => store.draft(run.runId), /pinned evidence/);
    assert.throws(() => store.review(brief.id, { subject: "reviewer", roles: ["reviewer"] }, "approved", ""), /evidence changed/);
    assert.equal(store.get(brief.id).status, "pending");
    assert.equal(store.audit(brief.id).length, 0);
  } finally { db.close(); }
});

test("review and audit roll back together when audit persistence fails", () => {
  const { db, store, run } = fixture();
  try {
    const brief = store.draft(run.runId);
    db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON defense_audit BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;");
    assert.throws(() => store.review(brief.id, { subject: "reviewer", roles: ["reviewer"] }, "approved", ""), /test audit failure/);
    assert.equal(store.get(brief.id).status, "pending");
    assert.equal(store.audit(brief.id).length, 0);
  } finally { db.close(); }
});

test("OIDC-protected HTTP journey rejects forged fields, wrong roles, duplicate reviews, and wrong action owners", async () => {
  const { db, run, store } = fixture();
  const { auth, token } = await authFixture();
  const app = express().use(express.json()).use("/api/defense", defenseRouter(db, auth));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/defense`;
  const tokens = Object.fromEntries(await Promise.all(["analyst", "reviewer", "owner", "other"].map(async (subject) => [subject, await token(subject)])));
  const request = async (path: string, body?: unknown, subject?: string) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...(subject ? { authorization: `Bearer ${tokens[subject]}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal((await request("/briefs", { runId: run.runId, rows: [] })).status, 400);
    const { data: brief } = await request("/briefs", { runId: run.runId });
    const path = `/briefs/${brief.id}`;
    assert.equal((await request(path)).status, 401);
    assert.equal((await request("/briefs/page/0")).status, 401);
    assert.equal((await request("/briefs/page/0?subject=other", undefined, "reviewer")).status, 400);
    assert.equal((await request("/briefs/page/-1", undefined, "reviewer")).status, 400);
    assert.equal((await request("/owners", undefined, "analyst")).status, 403);
    assert.deepEqual((await request("/owners", undefined, "reviewer")).data.owners, [{ subject: "other" }, { subject: "owner" }]);
    for (const suffix of ["", "/evidence", "/audit"]) {
      assert.equal((await request(path + suffix, undefined, "other")).status, 404);
      assert.equal((await request(path + suffix, undefined, "analyst")).status, 404);
      assert.equal((await request(path + suffix, undefined, "reviewer")).status, 200);
    }
    assert.equal((await request(path + "/review", { decision: "approved" }, "analyst")).status, 403);
    assert.equal((await request(path + "/review", { decision: "approved", actor: "forged" }, "reviewer")).status, 400);
    assert.equal((await request(path + "/action", { owner: "owner", dueAt: "2026-10-30T12:00:00Z" }, "reviewer")).status, 409);
    const decisions = await Promise.all([
      request(path + "/review", { decision: "approved", note: "Verify stock, not shutdown." }, "reviewer"),
      request(path + "/review", { decision: "rejected" }, "reviewer"),
    ]);
    assert.deepEqual(decisions.map((result) => result.status).sort(), [200, 409]);
    assert.equal(store.audit(brief.id).length, 1);
    // Regardless of scheduling, use a fresh approved record for the action journey.
    const approved = store.draft(run.runId, { subject: "analyst", roles: ["analyst"] });
    store.review(approved.id, { subject: "reviewer", roles: ["reviewer"] }, "approved", "");
    const action = `/briefs/${approved.id}/action`;
    assert.equal((await request(action, { owner: "unassigned", dueAt: "2026-10-30T12:00:00Z" }, "reviewer")).status, 400);
    assert.equal((await request(action, { owner: "owner", dueAt: "2026-10-30T12:00:00Z" }, "reviewer")).status, 200);
    assert.equal((await request(action + "/outcome", { outcome: "Too early" }, "owner")).status, 409);
    assert.equal((await request(action + "/acknowledge", {}, "other")).status, 404);
    assert.equal((await request(action + "/acknowledge", {}, "owner")).status, 200);
    assert.equal((await request(action + "/acknowledge", {}, "owner")).status, 409);
    assert.equal((await request(action + "/outcome", { outcome: "Reference inventory checked; follow-up required." }, "owner")).status, 200);
    assert.equal((await request(action + "/outcome", { outcome: "overwrite" }, "owner")).status, 409);
    assert.equal(store.audit(approved.id).length, 4);
    assert.equal((await request(`/briefs/${approved.id}`, undefined, "analyst")).data.action.status, "completed");
    assert.deepEqual((await request(`/briefs/${approved.id}/evidence`, undefined, "reviewer")).data, run);
    const rejected = store.draft(run.runId);
    store.review(rejected.id, { subject: "reviewer", roles: ["reviewer"] }, "rejected", "");
    assert.throws(() => store.assign(rejected.id, { subject: "reviewer", roles: ["reviewer"] }, "owner", "2026-10-30T12:00:00Z"), /approved brief/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
    db.close();
  }
});

test("case access is limited to creator, assigned owner and synthetic-demo reviewer", () => {
  const { db, store, run } = fixture();
  try {
    const analyst = { subject: "analyst", roles: ["analyst"] as ("analyst")[] };
    const reviewer = { subject: "reviewer", roles: ["reviewer"] as ("reviewer")[] };
    const brief = store.draft(run.runId, analyst);
    assert.equal(store.authorizeRead(brief.id, analyst).id, brief.id);
    assert.throws(() => store.authorizeRead(brief.id, { subject: "other-analyst", roles: ["analyst"] }), /not found/);
    assert.throws(() => store.authorizeRead(brief.id, { subject: "owner", roles: ["action-owner"] }), /not found/);
    store.review(brief.id, reviewer, "approved", "");
    store.assign(brief.id, reviewer, "owner", "2026-10-30T12:00:00Z");
    assert.equal(store.authorizeRead(brief.id, { subject: "owner", roles: ["action-owner"] }).id, brief.id);
    assert.throws(() => store.authorizeRead(brief.id, { subject: "other", roles: ["action-owner"] }), /not found/);
    const legacy = store.draft(run.runId);
    db.prepare("UPDATE defense_briefs SET brief = ? WHERE id = ?").run(JSON.stringify({ ...legacy, accessScope: undefined }), legacy.id);
    assert.equal(store.authorizeRead(legacy.id, reviewer).id, legacy.id);
    assert.throws(() => store.authorizeRead(legacy.id, analyst), /not found/);
    db.prepare("UPDATE defense_briefs SET brief = ? WHERE id = ?").run(JSON.stringify({ ...brief, accessScope: "restricted" }), brief.id);
    assert.throws(() => store.authorizeRead(brief.id, reviewer), /not found/);
  } finally { db.close(); }
});

test("saved-case pages enforce identity scope, bounded order and legacy visibility", () => {
  const { db, store, run } = fixture();
  try {
    const creator = { subject: "analyst", roles: ["analyst"] as "analyst"[] };
    const reviewer = { subject: "reviewer", roles: ["reviewer"] as "reviewer"[] };
    const ids = Array.from({ length: 22 }, () => store.draft(run.runId, creator).id);
    const anonymous = store.draft(run.runId);
    const first = store.list(creator, 0);
    assert.equal(first.cases.length, 20);
    assert.equal(first.nextOffset, 20);
    const second = store.list(creator, 20);
    assert.equal(second.cases.length, 2);
    assert.equal(second.nextOffset, null);
    assert.equal(new Set([...first.cases, ...second.cases].map((item) => item.id)).size, 22);
    assert.ok(!first.cases.some((item) => item.id === anonymous.id));
    assert.equal(store.list({ subject: "unrelated", roles: ["analyst"] }, 0).cases.length, 0);
    assert.equal(store.list({ subject: "owner", roles: ["action-owner"] }, 0).cases.length, 0);
    store.review(ids[0], reviewer, "approved", "");
    store.assign(ids[0], reviewer, "owner", "2026-10-30T12:00:00Z");
    const owned = store.list({ subject: "owner", roles: ["action-owner"] }, 0);
    assert.equal(owned.cases[0].id, ids[0]);
    assert.equal(owned.cases.length, 1);
    assert.ok(!("outcome" in owned.cases[0].action!));
    assert.equal(store.list(reviewer, 20).cases.length, 3);
    assert.throws(() => store.list(creator, -1), /offset/);
    assert.throws(() => store.list(creator, 100001), /offset/);
    // Recreating the store adds idempotent indexes without changing the ledger.
    const reopened = new DefenseStore(db);
    assert.deepEqual(reopened.list(creator, 0), store.list(creator, 0));
    assert.equal(reopened.audit(ids[0]).length, 2);
  } finally { db.close(); }
});

test("focused views enforce roles and include only the relevant case stage", () => {
  const { db, store, run } = fixture();
  try {
    const reviewer = { subject: "reviewer", roles: ["reviewer", "action-owner"] as ("reviewer" | "action-owner")[] };
    const pending = store.draft(run.runId);
    const approved = store.draft(run.runId);
    store.review(approved.id, reviewer, "approved", "");
    assert.deepEqual(store.list(reviewer, 0, "review").cases.map((item) => item.id), [pending.id]);
    assert.deepEqual(store.list(reviewer, 0, "assignment").cases.map((item) => item.id), [approved.id]);
    store.assign(approved.id, reviewer, reviewer.subject, "2026-10-30T12:00:00Z");
    assert.equal(store.list(reviewer, 0, "assignment").cases.length, 0);
    assert.deepEqual(store.list(reviewer, 0, "work").cases.map((item) => item.id), [approved.id]);
    store.advanceAction(approved.id, reviewer);
    store.advanceAction(approved.id, reviewer, "Verified");
    assert.equal(store.list(reviewer, 0, "work").cases.length, 0);
    assert.throws(() => store.list({ subject: "analyst", roles: ["analyst"] }, 0, "review"), /reviewer/);
    assert.throws(() => store.list({ subject: "reviewer", roles: ["reviewer"] }, 0, "work"), /action-owner/);
  } finally { db.close(); }
});

test("linked revisions preserve parent evidence, state and audit and require a distinct same-question capture", () => {
  const { db, store, run } = fixture();
  try {
    const creator = { subject: "analyst", roles: ["analyst"] as "analyst"[] };
    const reviewer = { subject: "reviewer", roles: ["reviewer"] as "reviewer"[] };
    const parent = store.draft(run.runId, creator);
    store.review(parent.id, reviewer, "approved", "Retain this decision");
    store.assign(parent.id, reviewer, "owner", "2026-10-30T12:00:00Z");
    const prior = JSON.stringify(store.get(parent.id));
    const audit = store.audit(parent.id);
    const fresh = { ...run, runId: "new-capture", capturedAt: "2026-10-03T12:00:00Z" };
    db.prepare("INSERT INTO graph_runs (id, run) VALUES (?, ?)").run(fresh.runId, JSON.stringify(fresh));
    assert.throws(() => store.revise(parent.id, fresh.runId, { subject: "unrelated", roles: ["analyst"] }), /not found/);
    assert.throws(() => store.revise(parent.id, fresh.runId, { subject: "owner", roles: ["action-owner"] }), /analyst or reviewer/);
    assert.throws(() => store.revise(parent.id, run.runId, creator), /separate capture/);
    const child = store.revise(parent.id, fresh.runId, creator);
    assert.equal(child.parentBriefId, parent.id);
    assert.notEqual(child.id, parent.id);
    assert.notEqual(child.evidenceHash, parent.evidenceHash);
    assert.equal(child.status, "pending");
    assert.equal(child.review, undefined);
    assert.equal(child.action, undefined);
    assert.equal(child.createdBySubject, creator.subject);
    assert.equal(JSON.stringify(store.get(parent.id)), prior);
    assert.deepEqual(store.audit(parent.id), audit);
    assert.deepEqual(store.evidence(parent.id), run);
    assert.equal(store.audit(child.id)[0].action, "revision_created");
    const unpinned = { ...fresh, runId: "bad-capture", graphCommit: null };
    db.prepare("INSERT INTO graph_runs (id, run) VALUES (?, ?)").run(unpinned.runId, JSON.stringify(unpinned));
    assert.throws(() => store.revise(parent.id, unpinned.runId, creator), /pinned/);
    assert.equal(store.list(creator, 0).cases.length, 2);
  } finally { db.close(); }
});

test("unconfigured adapter never enables decisions", async () => {
  const auth = createAuth({});
  await assert.rejects(auth.authenticate("Bearer not-a-real-token"), /approval is disabled/);
});

test("reviewed brief, owned action, and audit survive closing and reopening the SQLite ledger", () => {
  const { db: source, run } = fixture();
  source.close();
  const dir = mkdtempSync(join(tmpdir(), "bothy-defense-ledger-test-"));
  const path = join(dir, "ledger.db");
  let db = new DatabaseSync(path);
  try {
    let store = new DefenseStore(db);
    db.prepare("INSERT INTO graph_runs (id, run) VALUES (?, ?)").run(run.runId, JSON.stringify(run));
    const brief = store.draft(run.runId);
    const reviewer = { subject: "reviewer", roles: ["reviewer"] as const };
    const owner = { subject: "owner", roles: ["action-owner"] as const };
    store.review(brief.id, { ...reviewer, roles: [...reviewer.roles] }, "approved", "Verify the dependency.");
    store.assign(brief.id, { ...reviewer, roles: [...reviewer.roles] }, owner.subject, "2026-10-30T12:00:00Z");
    store.advanceAction(brief.id, { ...owner, roles: [...owner.roles] });
    store.advanceAction(brief.id, { ...owner, roles: [...owner.roles] }, "Synthetic reference checked; no operational claim.");
    db.close();
    db = new DatabaseSync(path);
    store = new DefenseStore(db);
    assert.equal(store.get(brief.id).action?.status, "completed");
    assert.equal(store.get(brief.id).review?.subject, "reviewer");
    assert.equal(store.audit(brief.id).length, 4);
    assert.deepEqual(store.evidence(brief.id), run);
  } finally { db.close(); rmSync(dir, { recursive: true }); }
});
