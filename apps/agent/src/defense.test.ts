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
    const approved = store.draft(run.runId);
    store.review(approved.id, { subject: "reviewer", roles: ["reviewer"] }, "approved", "");
    const action = `/briefs/${approved.id}/action`;
    assert.equal((await request(action, { owner: "unassigned", dueAt: "2026-10-30T12:00:00Z" }, "reviewer")).status, 400);
    assert.equal((await request(action, { owner: "owner", dueAt: "2026-10-30T12:00:00Z" }, "reviewer")).status, 200);
    assert.equal((await request(action + "/outcome", { outcome: "Too early" }, "owner")).status, 409);
    assert.equal((await request(action + "/acknowledge", {}, "other")).status, 403);
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
