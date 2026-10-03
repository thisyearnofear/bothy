import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSameOrigin, openSession, openTx, sealSession, sealTx, sessionEnabled } from "../lib/session";

const env = { NODE_ENV: "test", BOTHY_SESSION_SECRET: "a".repeat(48) };
const other = { NODE_ENV: "test", BOTHY_SESSION_SECRET: "b".repeat(48) };

describe("session seal/open", () => {
  const payload = { accessToken: "at-secret", refreshToken: "rt-secret", expiresAt: Date.now() + 60_000 };

  it("round-trips", async () => {
    assert.deepEqual(await openSession(await sealSession(payload, env), env), payload);
  });

  it("refuses to seal without a configured secret", async () => {
    await assert.rejects(() => sealSession(payload, {}), /not configured/);
    await assert.rejects(() => sealSession(payload, { BOTHY_SESSION_SECRET: "short" }), /not configured/);
    assert.equal(sessionEnabled({}), false);
    assert.equal(sessionEnabled(env), true);
  });

  it("does not leak the access token in the ciphertext", async () => {
    const sealed = await sealSession(payload, env);
    assert.ok(!sealed.includes(payload.accessToken));
  });

  it("fails to open under a different key", async () => {
    const sealed = await sealSession(payload, env);
    assert.equal(await openSession(sealed, other), null);
  });

  it("fails on a tampered cookie", async () => {
    const sealed = await sealSession(payload, env);
    const [head, body, tail] = sealed.split(".");
    const flipped = `${head}.${body.slice(0, -2)}${body.slice(-2) === "AA" ? "AB" : "AA"}.${tail}`;
    assert.equal(await openSession(flipped, env), null);
  });

  it("fails on absent or malformed input", async () => {
    assert.equal(await openSession(undefined, env), null);
    assert.equal(await openSession("", env), null);
    assert.equal(await openSession("not-a-jwe", env), null);
  });
});

describe("transaction cookie", () => {
  const tx = { state: "st", verifier: "vf", nonce: "no", returnTo: "/defense" };

  it("round-trips", async () => {
    assert.deepEqual(await openTx(await sealTx(tx, env), env), tx);
  });

  it("cannot be opened with the session cookie", async () => {
    const sealedTx = await sealTx(tx, env);
    assert.equal(await openSession(sealedTx, env), null);
  });

  it("rejects a mismatched shape", async () => {
    const sealed = await sealTx({ verifier: "vf", returnTo: "/x" } as never, env);
    assert.equal(await openTx(sealed, env), null);
  });

  it("fails under a different key", async () => {
    assert.equal(await openTx(await sealTx(tx, env), other), null);
  });
});

describe("isSameOrigin", () => {
  const request = (origin: string | null, host: string) =>
    new Request("https://bothy.example/api/defense/session", {
      headers: { ...(origin ? { origin } : {}), host },
    });

  it("accepts a matching host", () => {
    assert.equal(isSameOrigin(request("https://bothy.example", "bothy.example"), env), true);
  });

  it("rejects a foreign origin", () => {
    assert.equal(isSameOrigin(request("https://evil.example", "bothy.example"), env), false);
  });

  it("rejects a missing origin", () => {
    assert.equal(isSameOrigin(request(null, "bothy.example"), env), false);
  });

  it("accepts a configured public origin on the same host", () => {
    const withPublic = { ...env, PUBLIC_WEB_URL: "https://bothy.example" };
    assert.equal(isSameOrigin(request("https://bothy.example", "bothy.example"), withPublic), true);
  });
});