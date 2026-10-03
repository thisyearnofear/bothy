import { NextResponse } from "next/server";
import { proxyDefense } from "@/lib/defenseProxy";

export const dynamic = "force-dynamic";

// These filesystem handlers take precedence over the `/api/:path*` rewrite to
// the agent in next.config.ts (which is afterFiles), so defence traffic is
// bridged rather than forwarded unauthenticated. Do not add `beforeFiles`.
type Params = { params: Promise<{ path?: string[] }> };

async function handler(request: Request, context: Params): Promise<NextResponse> {
  const { path = [] } = await context.params;
  const rawPath = `/${path.map((segment) => encodeURIComponent(segment)).join("/")}`;
  const result = await proxyDefense(request, rawPath);
  const response = new NextResponse(result.body, { status: result.status, headers: result.headers });
  if (result.setCookie) response.headers.set("set-cookie", result.setCookie);
  return response;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;