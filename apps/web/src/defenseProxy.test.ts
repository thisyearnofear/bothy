import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowPath, filterBody, proxyDefense } from "../lib/defenseProxy";
import { sealSession } from "../lib/session";

const SECRET = { NODE_ENV: "test", BOTHY_SESSION_SECRET: "c".repeat(48), AGENT_URL: "http://agent.test" };

const cookie = async (accessToken: string, expiresAt = Date.now() + 3_600_000) =>
  `bt_sess=${await sealSession({ accessToken, expiresAt }, SECRET)}`;

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://bothy.example/api/defense${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "bothy.example",
      origin: "https://bothy.example",
      ...headers,
    },
    body: JSON.stringify(body),
  });

const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://bothy.example/api/defense${path}`, { headers: { host: "bothy.example", ...headers } });

// Records what the bridge forwarded to the agent and replays a canned reply.
const upstream = (status: number, body: unknown) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, impl };
};

describe("allowPath", () => {
  it("permits the documented defence routes", () => {
    for (const [method, path] of [
      ["GET", "/session"], ["POST", "/briefs"], ["GET", "/briefs/abc"],
      ["GET", "/owners"], ["GET", "/briefs/page/0"], ["GET", "/briefs/page/20"],
      ["GET", "/briefs/page/review/0"], ["GET", "/briefs/page/work/20"], ["GET", "/briefs/page/assignment/0"],
      ["POST", "/briefs/abc/revisions"],
      ["GET", "/briefs/abc/evidence"], ["GET", "/briefs/abc/audit"],
      ["POST", "/briefs/abc/reassessment"], ["POST", "/briefs/abc/review"], ["POST", "/briefs/abc/action"],
      ["POST", "/briefs/abc/action/acknowledge"], ["POST", "/briefs/abc/action/outcome"],
    ] as const) {
      assert.equal(allowPath(method, path).ok, true, `${method} ${path}`);
    }
  });

  it("refuses anything outside the defence surface", () => {
    for (const [method, path] of [
      ["GET", "/graph/health"], ["POST", "/briefs/abc/../../etc/passwd"],
      ["GET", "/briefs/page/-1"], ["GET", "/briefs/page/owner"], ["POST", "/owners"],
      ["GET", "/briefs/page/other/0"], ["GET", "/briefs/page/work/-1"],
      ["DELETE", "/briefs/abc"], ["POST", "/briefs/abc/email"], ["GET", "/briefs/abc/action"],
      ["POST", "/assessments/abc/decision"], ["GET", "/session/extra"],
    ] as const) {
      assert.equal(allowPath(method, path).ok, false, `${method} ${path}`);
    }
  });
});

describe("filterBody", () => {
  it("keeps only allowlisted fields", () => {
    assert.deepEqual(filterBody("POST /briefs/:id/review", { decision: "approved", note: "ok" }), { decision: "approved", note: "ok" });
  });

  it("drops identity and evidence fields the browser might smuggle", () => {
    const filtered = filterBody("POST /briefs/:id/review", {
      decision: "approved", subject: "attacker", evidenceHash: "forged", graphCommit: "deadbeef",
    }) as Record<string, unknown>;
    assert.deepEqual(Object.keys(filtered), ["decision"]);
  });

  it("forces an empty body for acknowledgment", () => {
    assert.deepEqual(filterBody("POST /briefs/:id/acknowledge", { subject: "attacker" }), {});
  });

  it("revision bodies contain only captured run identity", () => {
    assert.deepEqual(filterBody("POST /briefs/:id/revisions", { runId: "capture", parentBriefId: "forged", subject: "forged", status: "approved" }), { runId: "capture" });
  });

  it("reassessment strips authority, owner finding and evidence fields", () => {
    assert.deepEqual(filterBody("POST /briefs/:id/reassessment", { decision: "accepted", note: "Checked", subject: "forged", outcome: "overwrite", evidenceHash: "forged" }), { decision: "accepted", note: "Checked" });
  });

  it("returns undefined for reads", () => {
    assert.equal(filterBody("GET /briefs/:id", undefined), undefined);
  });
});

describe("proxyDefense", () => {
  it("refuses queue identity filters before contacting the agent", async () => {
    const agent = upstream(200, { cases: [] });
    const result = await proxyDefense(get("/briefs/page/0?subject=other", { cookie: await cookie("at") }), "/briefs/page/0", SECRET, agent.impl);
    assert.equal(result.status, 400);
    assert.equal(agent.calls.length, 0);
  });

  it("forwards the cookie token as a bearer and never a client Authorization header", async () => {
    const agent = upstream(200, { ok: true });
    const result = await proxyDefense(
      post("/briefs/abc/review", { decision: "approved" }, {
        cookie: await cookie("at-server"),
        authorization: "Bearer attacker-supplied",
      }),
      "/briefs/abc/review", SECRET, agent.impl
    );
    assert.equal(result.status, 200);
    const headers = agent.calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer at-server");
    assert.equal(result.headers["cache-control"], "no-store");
  });

  it("preserves 403 rather than collapsing it", async () => {
    const agent = upstream(403, { error: "reviewer role required" });
    const result = await proxyDefense(
      post("/briefs/abc/review", { decision: "approved" }, { cookie: await cookie("at") }),
      "/briefs/abc/review", SECRET, agent.impl
    );
    assert.equal(result.status, 403);
    assert.equal(JSON.parse(result.body).error, "reviewer role required");
  });

  it("preserves 409 for a conflicting transition", async () => {
    const agent = upstream(409, { error: "brief already decided" });
    const result = await proxyDefense(
      post("/briefs/abc/review", { decision: "approved" }, { cookie: await cookie("at") }),
      "/briefs/abc/review", SECRET, agent.impl
    );
    assert.equal(result.status, 409);
  });

  it("preserves 503 when review is unconfigured on the agent", async () => {
    const agent = upstream(503, { error: "OIDC review is not configured; approval is disabled" });
    const result = await proxyDefense(
      post("/briefs/abc/review", { decision: "approved" }, { cookie: await cookie("at") }),
      "/briefs/abc/review", SECRET, agent.impl
    );
    assert.equal(result.status, 503);
  });

  it("rejects an unauthenticated write with 401 and does not call the agent", async () => {
    const agent = upstream(200, {});
    const result = await proxyDefense(post("/briefs/abc/review", { decision: "approved" }), "/briefs/abc/review", SECRET, agent.impl);
    assert.equal(result.status, 401);
    assert.equal(agent.calls.length, 0);
  });

  it("rejects a cross-origin write", async () => {
    const agent = upstream(200, {});
    const result = await proxyDefense(
      post("/briefs/abc/review", { decision: "approved" }, { cookie: await cookie("at"), origin: "https://evil.example" }),
      "/briefs/abc/review", SECRET, agent.impl
    );
    assert.equal(result.status, 403);
    assert.equal(agent.calls.length, 0);
  });

  it("answers the public session probe without a cookie", async () => {
    const agent = upstream(200, { configured: true, authenticated: false, roles: [] });
    const result = await proxyDefense(get("/session"), "/session", SECRET, agent.impl);
    assert.equal(result.status, 200);
    assert.equal(JSON.parse(result.body).configured, true);
  });

  it("sends the bearer on the session probe when signed in", async () => {
    const agent = upstream(200, { configured: true, authenticated: true, subject: "reviewer", roles: ["reviewer"] });
    const result = await proxyDefense(get("/session", { cookie: await cookie("at-1") }), "/session", SECRET, agent.impl);
    assert.equal(result.status, 200);
    assert.equal((agent.calls[0].init.headers as Record<string, string>).authorization, "Bearer at-1");
  });

  it("returns 404 for a non-defence path without calling the agent", async () => {
    const agent = upstream(200, {});
    const result = await proxyDefense(get("/graph/health", { cookie: await cookie("at") }), "/graph/health", SECRET, agent.impl);
    assert.equal(result.status, 404);
    assert.equal(agent.calls.length, 0);
  });

  it("reports 502 when the agent is unreachable", async () => {
    const impl = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const result = await proxyDefense(
      post("/briefs/abc/review", { decision: "approved" }, { cookie: await cookie("at") }),
      "/briefs/abc/review", SECRET, impl
    );
    assert.equal(result.status, 502);
  });

  it("requires sign-in again when an expired session has no refresh token", async () => {
    const agent = upstream(200, {});
    const result = await proxyDefense(
      post("/briefs/abc/review", { decision: "approved" }, { cookie: await cookie("stale", Date.now() - 1000) }),
      "/briefs/abc/review", SECRET, agent.impl
    );
    assert.equal(result.status, 401);
    assert.equal(agent.calls.length, 0);
  });
});