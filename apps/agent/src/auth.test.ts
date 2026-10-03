import assert from "node:assert/strict";
import test from "node:test";
import { AccessError, createAuth } from "./auth";
import { authFixture } from "./test/authFixture";

test("OIDC fails closed when configuration is absent, partial, or malformed", async () => {
  const fixture = await authFixture();
  for (const env of [{}, { ...fixture.env, BOTHY_OIDC_AUDIENCE: "" },
    { ...fixture.env, BOTHY_OIDC_JWKS_URL: "http://issuer.example/keys" },
    { ...fixture.env, BOTHY_OIDC_PRINCIPALS: '{"reviewer":["admin"]}' }]) {
    const auth = createAuth(env, fixture.keys);
    assert.equal(auth.configured, false);
    await assert.rejects(auth.authenticate(undefined), (e: unknown) => e instanceof AccessError && e.status === 503);
  }
});

test("OIDC verifies signatures, issuer, audience, expiry, and configured subjects; token roles are ignored", async () => {
  const { auth, token } = await authFixture();
  assert.deepEqual(await auth.authenticate(`Bearer ${await token("analyst")}`), { subject: "analyst", roles: ["analyst"] });
  for (const value of [
    await token("reviewer", "wrong-api"), await token("reviewer", undefined, "-10s"),
    await token("reviewer", undefined, "5m", "https://wrong.example"),
    (await token("reviewer")).slice(0, -20) + "tampered",
  ]) {
    await assert.rejects(auth.authenticate(`Bearer ${value}`), (e: unknown) => e instanceof AccessError && e.status === 401);
  }
  await assert.rejects(auth.authenticate(`Bearer ${await token("unassigned")}`), (e: unknown) => e instanceof AccessError && e.status === 403);
  assert.equal(auth.canOwn("reviewer"), false);
  assert.equal(auth.canOwn("owner"), true);
  assert.equal(auth.canOwn("constructor"), false);
});
