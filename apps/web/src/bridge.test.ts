import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { defenseRouter, evidenceHash } from "../../agent/src/defense";
import { createAuth } from "../../agent/src/auth";
import { authFixture } from "../../agent/src/test/authFixture";
import { SCENARIOS } from "../../agent/src/graph/scenarios";
import { proxyDefense } from "../lib/defenseProxy";
import { sealSession } from "../lib/session";

// Drives the real agent defence router behind the real bridge, so the assertions
// cover the whole chain rather than a mock of it.
describe("bridge to agent end to end", () => {
  let server: Server;
  let agentUrl: string;
  let db: DatabaseSync;
  let auth: Awaited<ReturnType<typeof authFixture>>["auth"];
  let token: Awaited<ReturnType<typeof authFixture>>["token"];

  before(async () => {
    const fixture = await authFixture();
    auth = fixture.auth;
    token = fixture.token;
    db = new DatabaseSync(":memory:");
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/defense", defenseRouter(db, auth));
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    agentUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  after(async () => { db.close(); await new Promise<void>((resolve) => server.close(() => resolve())); });

  const env = () => ({
    NODE_ENV: "test",
    BOTHY_SESSION_SECRET: "d".repeat(48),
    AGENT_URL: agentUrl,
  });

  const call = async (method: string, path: string, body: unknown, subject: string) => {
    const session = await sealSession(
      { accessToken: await token(subject), expiresAt: Date.now() + 3_600_000 },
      env()
    );
    const request = new Request(`https://bothy.example/api/defense${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        host: "bothy.example",
        origin: "https://bothy.example",
        cookie: `bt_sess=${session}`,
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    });
    return proxyDefense(request, path, env());
  };

  // A run must exist before a brief can be drafted, and drafting requires a
  // pinned commit plus a query hash from the reviewed catalogue.
  let runCounter = 0;
  const captureRun = (scenarioId = "gallium-exposure") => {
    const scenario = SCENARIOS.find((item) => item.id === scenarioId)!;
    const run = {
      runId: `run-${scenarioId}-${++runCounter}`,
      graph: scenario.graph,
      scenarioId: scenario.id,
      cypher: scenario.cypher,
      queryHash: "sha256-test-query",
      graphCommit: "commit-abc123",
      capturedAt: new Date().toISOString(),
      columns: ["p.name"],
      rows: [{ "p.name": "RADAR-AESA" }, { "p.name": "EW-POD" }],
      count: 2,
      ms: 12,
      sourceBoundary: "Test boundary.",
    };
    db.prepare("INSERT INTO graph_runs (id, run) VALUES (?, ?)").run(run.runId, JSON.stringify(run));
    return run;
  };

  it("completes brief -> review -> assign -> acknowledge -> outcome", async () => {
    const run = captureRun();

    const draft = await call("POST", "/briefs", { runId: run.runId }, "analyst");
    assert.equal(draft.status, 201);
    const brief = JSON.parse(draft.body) as { id: string; status: string; evidenceHash: string; claims: unknown[] };
    assert.equal(brief.status, "pending");
    assert.equal(brief.evidenceHash, evidenceHash(run));
    assert.equal(brief.claims.length, 2);

    const approved = await call("POST", `/briefs/${brief.id}/review`, { decision: "approved", note: "Dependencies check out." }, "reviewer");
    assert.equal(approved.status, 200);
    assert.equal(JSON.parse(approved.body).status, "approved");

    const assigned = await call("POST", `/briefs/${brief.id}/action`, { owner: "owner", dueAt: new Date(Date.now() + 86_400_000).toISOString() }, "reviewer");
    assert.equal(assigned.status, 200);
    assert.equal(JSON.parse(assigned.body).action.status, "assigned");

    const acknowledged = await call("POST", `/briefs/${brief.id}/action/acknowledge`, {}, "owner");
    assert.equal(acknowledged.status, 200);
    assert.equal(JSON.parse(acknowledged.body).action.status, "acknowledged");

    const completed = await call("POST", `/briefs/${brief.id}/action/outcome`, { outcome: "Inventory confirmed via the programme office." }, "owner");
    assert.equal(completed.status, 200);
    assert.equal(JSON.parse(completed.body).action.status, "completed");

    const audit = await call("GET", `/briefs/${brief.id}/audit`, undefined, "reviewer");
    assert.equal(audit.status, 200);
    const entries = (JSON.parse(audit.body) as { entries: { subject: string; action: string }[] }).entries;
    assert.deepEqual(entries.map((entry) => entry.action), ["approved", "action_assigned", "action_acknowledged", "action_completed"]);
    assert.deepEqual(entries.map((entry) => entry.subject), ["reviewer", "reviewer", "owner", "owner"]);
  });

  it("surfaces the agent's 409 on a second review", async () => {
    const run = captureRun();
    const briefId = (JSON.parse((await call("POST", "/briefs", { runId: run.runId }, "analyst")).body) as { id: string }).id;
    assert.equal((await call("POST", `/briefs/${briefId}/review`, { decision: "approved" }, "reviewer")).status, 200);
    const second = await call("POST", `/briefs/${briefId}/review`, { decision: "rejected" }, "reviewer");
    assert.equal(second.status, 409);
    assert.match(JSON.parse(second.body).error, /already decided/);
  });

  it("refuses an outcome from a subject who is not the assigned owner", async () => {
    const run = captureRun();
    const briefId = (JSON.parse((await call("POST", "/briefs", { runId: run.runId }, "analyst")).body) as { id: string }).id;
    await call("POST", `/briefs/${briefId}/review`, { decision: "approved" }, "reviewer");
    await call("POST", `/briefs/${briefId}/action`, { owner: "owner", dueAt: new Date(Date.now() + 86_400_000).toISOString() }, "reviewer");
    const stolen = await call("POST", `/briefs/${briefId}/action/acknowledge`, {}, "other");
    assert.equal(stolen.status, 404);
    assert.match(JSON.parse(stolen.body).error, /not found/);
  });

  it("refuses to assign an owner who is not a configured action-owner", async () => {
    const run = captureRun();
    const briefId = (JSON.parse((await call("POST", "/briefs", { runId: run.runId }, "analyst")).body) as { id: string }).id;
    await call("POST", `/briefs/${briefId}/review`, { decision: "approved" }, "reviewer");
    const bad = await call("POST", `/briefs/${briefId}/action`, { owner: "reviewer", dueAt: new Date(Date.now() + 86_400_000).toISOString() }, "reviewer");
    assert.equal(bad.status, 400);
  });

  it("refuses a draft for a run that was never captured", async () => {
    const draft = await call("POST", "/briefs", { runId: "missing-run" }, "analyst");
    assert.equal(draft.status, 404);
    assert.equal(JSON.parse(draft.body).error, "captured run not found");
  });

  it("refuses a review from an analyst-only subject with 403", async () => {
    const result = await call("POST", "/briefs/missing/review", { decision: "approved" }, "analyst");
    // The role check runs before the lookup, so an analyst is rejected outright.
    assert.equal(result.status, 403);
    assert.match(JSON.parse(result.body).error, /role/);
  });

  it("allows a reviewer to reach the transition check for a missing brief", async () => {
    const result = await call("POST", "/briefs/missing/review", { decision: "approved" }, "reviewer");
    assert.equal(result.status, 404);
  });

  it("rejects an identity field smuggled into a review body", async () => {
    const result = await call("POST", "/briefs/missing/review", { decision: "approved", subject: "reviewer" }, "reviewer");
    // The bridge strips it before the agent sees it, so this is a plain 404
    // rather than the agent's strict-body 400.
    assert.equal(result.status, 404);
  });

  it("reports the real session for an authenticated subject", async () => {
    const result = await call("GET", "/session", undefined, "reviewer");
    assert.equal(result.status, 200);
    const body = JSON.parse(result.body) as { authenticated: boolean; subject?: string; roles: string[] };
    assert.equal(body.authenticated, true);
    assert.equal(body.subject, "reviewer");
    assert.deepEqual(body.roles, ["reviewer"]);
  });

  it("returns 401 through the bridge when the agent rejects the token", async () => {
    const session = await sealSession({ accessToken: "not-a-real-token", expiresAt: Date.now() + 3_600_000 }, env());
    const request = new Request("https://bothy.example/api/defense/session", {
      headers: { host: "bothy.example", cookie: `bt_sess=${session}` },
    });
    const result = await proxyDefense(request, "/session", env());
    assert.equal(result.status, 401);
  });

  it("keeps the unconfigured agent's 503 visible through the bridge", async () => {
    const disabled = createAuth({});
    const db = new DatabaseSync(":memory:");
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/defense", defenseRouter(db, disabled));
    const isolated = createServer(app);
    await new Promise<void>((resolve) => isolated.listen(0, "127.0.0.1", resolve));
    const address = isolated.address();
    const session = await sealSession({ accessToken: "anything", expiresAt: Date.now() + 3_600_000 }, env());
    try {
      const result = await proxyDefense(
        new Request("https://bothy.example/api/defense/session", { headers: { host: "bothy.example", cookie: `bt_sess=${session}` } }),
        "/session",
        { ...env(), AGENT_URL: `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}` }
      );
      assert.equal(result.status, 503);
      assert.match(JSON.parse(result.body).error, /approval is disabled/);
    } finally {
      await new Promise<void>((resolve) => isolated.close(() => resolve()));
    }
  });

  it("exposes canOwn through the agent the bridge relies on", () => {
    assert.equal(auth.canOwn("owner"), true);
    assert.equal(auth.canOwn("reviewer"), false);
  });
});