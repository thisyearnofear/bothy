import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeUrl, loadConfig, pkce, ssoConfigured } from "@/lib/oidc";
import { TX_COOKIE, TX_MAX_AGE, sealTx, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = loadConfig();
  // Fail closed, matching the agent: no configuration means no sign-in path,
  // not a weaker fallback.
  if (!config || !ssoConfigured()) {
    return NextResponse.json({ error: "SSO is not configured; sign-in is disabled" }, { status: 503 });
  }

  const { verifier, challenge } = pkce();
  const tx = {
    state: randomBytes(24).toString("base64url"),
    verifier,
    nonce: randomBytes(16).toString("base64url"),
    returnTo: new URL(request.url).searchParams.get("returnTo") ?? "/defense",
  };
  const response = NextResponse.redirect(authorizeUrl(config, { state: tx.state, challenge, nonce: tx.nonce }));
  response.cookies.set(TX_COOKIE, await sealTx(tx), sessionCookieOptions(TX_MAX_AGE));
  return response;
}