import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { authorizeUrl, exchangeCode, loadConfig, pkce, refreshToken, safeReturnTo, ssoConfigured } from "../lib/oidc";

const env = {
  NODE_ENV: "test",
  BOTHY_SSO_AUTHORIZE_URL: "https://idp.example/authorize",
  BOTHY_SSO_TOKEN_URL: "https://idp.example/token",
  BOTHY_SSO_CLIENT_ID: "bothy-web",
  BOTHY_SSO_CLIENT_SECRET: "secret-value",
  BOTHY_SSO_AUDIENCE: "bothy-api",
  BOTHY_SSO_REDIRECT_URI: "https://bothy.example/api/auth/callback",
};

describe("loadConfig fails closed", () => {
  it("accepts a complete https configuration", () => {
    const config = loadConfig(env);
    assert.ok(config);
    assert.equal(config.audience, "bothy-api");
    assert.equal(config.scope, "openid profile email");
    assert.equal(ssoConfigured(env), true);
  });

  for (const missing of Object.keys(env).filter((key) => key.startsWith("BOTHY_SSO_") && key !== "BOTHY_SSO_SCOPE")) {
    it(`disables sign-in when ${missing} is missing`, () => {
      const partial = { ...env, [missing]: "" };
      assert.equal(loadConfig(partial), null);
      assert.equal(ssoConfigured(partial), false);
    });
  }

  it("refuses plain http in production", () => {
    const insecure = { ...env, NODE_ENV: "production", BOTHY_SSO_AUTHORIZE_URL: "http://idp.example/authorize" };
    assert.equal(loadConfig(insecure), null);
  });

  it("allows localhost http only outside production", () => {
    const local = { ...env, BOTHY_SSO_AUTHORIZE_URL: "http://localhost:9000/authorize" };
    assert.ok(loadConfig(local));
    const prod = { ...local, NODE_ENV: "production" };
    assert.equal(loadConfig(prod), null);
  });

  it("refuses a non-loopback http host in development", () => {
    assert.equal(loadConfig({ ...env, BOTHY_SSO_TOKEN_URL: "http://idp.example/token" }), null);
  });

  it("refuses urls carrying embedded credentials", () => {
    const creds = { ...env, BOTHY_SSO_TOKEN_URL: "https://user:pass@idp.example/token" };
    assert.equal(loadConfig(creds), null);
  });

  it("refuses an audience equal to the browser client id", () => {
    assert.equal(loadConfig({ ...env, BOTHY_SSO_AUDIENCE: env.BOTHY_SSO_CLIENT_ID }), null);
  });
});

describe("pkce", () => {
  it("derives an S256 challenge from the verifier", () => {
    const { verifier, challenge } = pkce();
    assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
    assert.ok(verifier.length >= 43);
  });

  it("does not repeat", () => {
    assert.notEqual(pkce().verifier, pkce().verifier);
  });
});

describe("authorizeUrl", () => {
  it("requests a code with PKCE, state, and the API audience", () => {
    const config = loadConfig(env)!;
    const url = new URL(authorizeUrl(config, { state: "st", challenge: "ch", nonce: "no" }));
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("code_challenge"), "ch");
    assert.equal(url.searchParams.get("state"), "st");
    assert.equal(url.searchParams.get("nonce"), "no");
    assert.equal(url.searchParams.get("audience"), "bothy-api");
    assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
    assert.equal(url.searchParams.get("client_secret"), null);
  });
});

describe("token exchange", () => {
  it("sends the verifier and returns a token set", async () => {
    const config = loadConfig(env)!;
    let sent = new URLSearchParams();
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sent = new URLSearchParams(init.body as string);
      return new Response(JSON.stringify({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 }), { status: 200 });
    }) as unknown as typeof fetch;
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch;
    try {
      const tokens = await exchangeCode(config, "code-1", "verifier-1");
      assert.equal(tokens.accessToken, "at-1");
      assert.equal(tokens.refreshToken, "rt-1");
      assert.ok(tokens.expiresAt > Date.now());
      assert.equal(sent.get("grant_type"), "authorization_code");
      assert.equal(sent.get("code_verifier"), "verifier-1");
      assert.equal(sent.get("code"), "code-1");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("never exposes a client secret in a thrown message", async () => {
    const config = loadConfig(env)!;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("denied", { status: 401 })) as unknown as typeof fetch;
    try {
      await assert.rejects(() => exchangeCode(config, "code", "verifier"), (error: Error) => {
        assert.ok(!error.message.includes(config.clientSecret));
        return true;
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  it("rejects a response with no access token", async () => {
    const config = loadConfig(env)!;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ token_type: "Bearer" }), { status: 200 })) as unknown as typeof fetch;
    try {
      await assert.rejects(() => refreshToken(config, "rt"), /no access token/);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("safeReturnTo", () => {
  it("keeps same-origin relative paths", () => {
    assert.equal(safeReturnTo("/defense?brief=abc"), "/defense?brief=abc");
  });

  for (const hostile of ["https://evil.example", "//evil.example", "/\\evil.example", "", null]) {
    it(`refuses ${JSON.stringify(hostile)}`, () => {
      assert.equal(safeReturnTo(hostile as string | null), "/defense");
    });
  }
});