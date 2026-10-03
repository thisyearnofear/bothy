import { createHash } from "node:crypto";
import { CompactSign, EncryptJWT, jwtDecrypt, jwtVerify } from "jose";
import type { Env } from "@/lib/env";

export const SESSION_COOKIE = "bt_sess";
export const TX_COOKIE = "bt_tx";
export const TX_MAX_AGE = 600;

export interface SessionPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface TxPayload {
  state: string;
  verifier: string;
  nonce: string;
  returnTo: string;
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
  }
}

// A256GCM requires exactly 32 bytes, so the configured secret is hashed rather
// than used verbatim. That keeps any strong passphrase usable and makes the key
// length independent of how the operator generated it.
const deriveKey = (secret: string, purpose: string): Uint8Array =>
  createHash("sha256").update(`${purpose}:${secret}`).digest();

function sessionKey(env: Env = process.env): Uint8Array | null {
  const secret = env.BOTHY_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return deriveKey(secret, "bothy-session");
}

function txKey(env: Env = process.env): Uint8Array | null {
  const secret = env.BOTHY_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  // Domain-separated from the session key so neither can open the other.
  return deriveKey(secret, "bothy-tx");
}

export const sessionEnabled = (env: Env = process.env): boolean => sessionKey(env) !== null;

// The session cookie carries a bearer token, so it is encrypted (A256GCM), not
// merely signed. A signed-only cookie would leak the token to anyone who could
// read it, which the agent's own "no cookies at the agent" rule is there to stop.
export async function sealSession(payload: SessionPayload, env?: Env): Promise<string> {
  const key = sessionKey(env);
  if (!key) throw new SessionError("session encryption is not configured");
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .encrypt(key);
}

export async function openSession(cookie: string | undefined, env?: Env): Promise<SessionPayload | null> {
  const key = sessionKey(env);
  if (!key || !cookie) return null;
  try {
    const { payload } = await jwtDecrypt(cookie, key);
    const accessToken = payload.accessToken;
    const expiresAt = payload.expiresAt;
    if (typeof accessToken !== "string" || !accessToken) return null;
    if (typeof expiresAt !== "number") return null;
    const result: SessionPayload = { accessToken, expiresAt };
    if (typeof payload.refreshToken === "string") result.refreshToken = payload.refreshToken;
    return result;
  } catch {
    return null;
  }
}

// The pre-auth cookie holds no secret - only state, the PKCE verifier, and a
// return path - so a signature (not encryption) is sufficient for integrity.
export async function sealTx(payload: TxPayload, env?: Env): Promise<string> {
  const key = txKey(env);
  if (!key) throw new SessionError("session encryption is not configured");
  return new CompactSign(Buffer.from(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "HS256" })
    .sign(key);
}

export async function openTx(cookie: string | undefined, env?: Env): Promise<TxPayload | null> {
  const key = txKey(env);
  if (!key || !cookie) return null;
  try {
    const { payload } = await jwtVerify(cookie, key, { algorithms: ["HS256"] });
    const parsed = payload as unknown as TxPayload;
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string" || !parsed.state) return null;
    if (typeof parsed.returnTo !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = (maxAge: number, env: Env = process.env) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

const allowedOrigins = (env: Env = process.env): string[] =>
  [env.PUBLIC_WEB_URL, env.WEB_ORIGIN].filter((value): value is string => Boolean(value));

// SameSite=Lax already stops a cross-site cookie from riding a POST, but a
// defence-approval endpoint deserves an explicit origin check as well.
export function isSameOrigin(request: Request, env: Env = process.env): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    if (new URL(origin).host === host) return true;
  } catch {
    return false;
  }
  return allowedOrigins(env).some((value) => {
    try {
      return new URL(value).host === host;
    } catch {
      return false;
    }
  });
}