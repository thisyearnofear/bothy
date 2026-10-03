import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { exchangeCode, loadConfig, safeReturnTo, SsoError } from "@/lib/oidc";
import {
  SESSION_COOKIE,
  TX_COOKIE,
  openTx,
  sealSession,
  sessionCookieOptions,
} from "@/lib/session";

export const dynamic = "force-dynamic";

// Relative redirects only. NextResponse.redirect needs an absolute URL, so build
// one against the configured public origin rather than a hardcoded localhost,
// which would emit a wrong Location in a deployed environment.
const webOrigin = () => {
  const configured = process.env.PUBLIC_WEB_URL ?? process.env.WEB_ORIGIN;
  if (!configured) throw new Error("PUBLIC_WEB_URL or WEB_ORIGIN must be set");
  return new URL(configured).origin;
};

const redirectTo = (path: string) => NextResponse.redirect(new URL(path, webOrigin()));

const fail = (code: string) => {
  const response = redirectTo(`/defense?authError=${encodeURIComponent(code)}`);
  // Clear both cookies so a stale or partially-used transaction cannot be replayed.
  response.cookies.set(TX_COOKIE, "", sessionCookieOptions(0));
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
};

// Length-safe constant-time compare, so state verification does not leak timing.
const stateMatches = (expected: string, received: string): boolean => {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function GET(request: Request) {
  let config;
  try {
    config = loadConfig();
    webOrigin();
  } catch {
    return NextResponse.json({ error: "SSO is not configured; sign-in is disabled" }, { status: 503 });
  }
  if (!config) return fail("sso_not_configured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state) return fail("callback_rejected");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const txCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TX_COOKIE}=`))
    ?.slice(TX_COOKIE.length + 1);
  const tx = await openTx(txCookie);
  if (!tx) return fail("transaction_missing");
  if (!stateMatches(tx.state, state)) return fail("state_mismatch");

  try {
    const tokens = await exchangeCode(config, code, tx.verifier);
    const sealed = await sealSession({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
    const response = redirectTo(safeReturnTo(tx.returnTo));
    response.cookies.set(TX_COOKIE, "", sessionCookieOptions(0));
    response.cookies.set(SESSION_COOKIE, sealed, sessionCookieOptions(Math.max(1, Math.floor((tokens.expiresAt - Date.now()) / 1000))));
    return response;
  } catch (error) {
    // Surface only our own coarse codes; never an IdP response body or token.
    return fail(error instanceof SsoError ? error.code : "sign_in_failed");
  }
}