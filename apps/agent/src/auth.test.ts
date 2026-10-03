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

test("HTTP identity configuration requires explicit development-only loopback opt-in", async () => {
  const fixture = await authFixture();
  const local = { ...fixture.env, NODE_ENV: "development", BOTHY_OIDC_ALLOW_LOCAL_DEMO: "true", BOTHY_OIDC_ISSUER: "http://127.0.0.1:9099", BOTHY_OIDC_JWKS_URL: "http://127.0.0.1:9099/jwks" };
  assert.equal(createAuth(local, fixture.keys).configured, true);
  for (const env of [
    { ...local, NODE_ENV: "production" }, { ...local, NODE_ENV: "test" },
    { ...local, BOTHY_OIDC_ALLOW_LOCAL_DEMO: "false" },
    { ...local, BOTHY_OIDC_ISSUER: "http://remote.example" },
    { ...local, BOTHY_OIDC_JWKS_URL: "http://remote.example/jwks" },
    { ...local, BOTHY_OIDC_ISSUER: "http://user:pass@127.0.0.1:9099" },
  ]) assert.equal(createAuth(env, fixture.keys).configured, false);
  const verifier = createAuth(local, fixture.keys);
  assert.deepEqual(await verifier.authenticate(`Bearer ${await fixture.token("reviewer", undefined, "5m", local.BOTHY_OIDC_ISSUER)}`), { subject: "reviewer", roles: ["reviewer"] });
  await assert.rejects(verifier.authenticate(`Bearer ${await fixture.token("reviewer", "wrong", "5m", local.BOTHY_OIDC_ISSUER)}`));
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
