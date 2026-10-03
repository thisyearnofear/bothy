import { createHash, randomBytes } from "node:crypto";
import type { Env } from "@/lib/env";

export interface SsoConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope: string;
  redirectUri: string;
  resource?: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export class SsoError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const isHttpsOrLocal = (raw: string, production: boolean): boolean => {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    // Local HTTP only for a dev loopback IdP; never in production.
    return !production && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
};

// Mirrors the agent's fail-closed posture in apps/agent/src/auth.ts: incomplete
// configuration disables the flow rather than falling back to something weaker.
export function loadConfig(env: Env = process.env): SsoConfig | null {
  const production = env.NODE_ENV === "production";
  const authorizeUrl = env.BOTHY_SSO_AUTHORIZE_URL;
  const tokenUrl = env.BOTHY_SSO_TOKEN_URL;
  const clientId = env.BOTHY_SSO_CLIENT_ID;
  const clientSecret = env.BOTHY_SSO_CLIENT_SECRET;
  const audience = env.BOTHY_SSO_AUDIENCE;
  const redirectUri = env.BOTHY_SSO_REDIRECT_URI;
  if (!authorizeUrl || !tokenUrl || !clientId || !clientSecret || !audience || !redirectUri) return null;
  if (!isHttpsOrLocal(authorizeUrl, production) || !isHttpsOrLocal(tokenUrl, production)) return null;
  // The audience is the API access-token audience, never the browser client id.
  if (audience === clientId) return null;
  return {
    authorizeUrl,
    tokenUrl,
    clientId,
    clientSecret,
    audience,
    scope: env.BOTHY_SSO_SCOPE ?? "openid profile email",
    redirectUri,
    ...(env.BOTHY_SSO_RESOURCE ? { resource: env.BOTHY_SSO_RESOURCE } : {}),
  };
}

export const ssoConfigured = (env: Env = process.env): boolean => loadConfig(env) !== null;

export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authorizeUrl(
  config: SsoConfig,
  params: { state: string; challenge: string; nonce: string }
): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("audience", config.audience);
  if (config.resource) url.searchParams.set("resource", config.resource);
  return url.toString();
}

async function tokenRequest(config: SsoConfig, body: URLSearchParams): Promise<TokenSet> {
  let response: Response;
  try {
    response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body,
      cache: "no-store",
    });
  } catch {
    throw new SsoError(503, "token_endpoint_unreachable", "SSO token endpoint is unreachable");
  }
  if (!response.ok) throw new SsoError(502, "token_request_failed", "SSO token request was rejected");
  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new SsoError(502, "token_response_invalid", "SSO token response was not JSON");
  }
  const accessToken = payload.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new SsoError(502, "token_response_invalid", "SSO token response carried no access token");
  }
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : undefined;
  const lifetime = typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 300;
  // Refresh slightly early so an in-flight request never races the expiry.
  return { accessToken, refreshToken, expiresAt: Date.now() + (lifetime - 30) * 1000 };
}

export async function exchangeCode(config: SsoConfig, code: string, verifier: string): Promise<TokenSet> {
  return tokenRequest(
    config,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      ...(config.resource ? { resource: config.resource } : {}),
    })
  );
}

export async function refreshToken(config: SsoConfig, token: string): Promise<TokenSet> {
  return tokenRequest(
    config,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    })
  );
}

// Only same-origin relative paths, so ?returnTo= cannot become an open redirect.
export function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) return "/defense";
  try {
    const url = new URL(raw, "https://bothy.invalid");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/defense";
  }
}