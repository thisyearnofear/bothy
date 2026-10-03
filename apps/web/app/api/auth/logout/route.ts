import { NextResponse } from "next/server";
import { SESSION_COOKIE, TX_COOKIE, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

// Relative redirect built against the configured public origin, so a deployed
// instance does not emit a localhost Location header.
const origin = () => new URL(process.env.PUBLIC_WEB_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3001").origin;

async function logout() {
  const response = NextResponse.redirect(new URL("/defense", origin()));
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  response.cookies.set(TX_COOKIE, "", sessionCookieOptions(0));
  return response;
}

export const GET = logout;
export const POST = logout;