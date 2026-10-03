import { loadConfig, refreshToken, SsoError } from "@/lib/oidc";
import type { Env } from "@/lib/env";
import {
  SESSION_COOKIE,
  isSameOrigin,
  openSession,
  sealSession,
  sessionCookieOptions,
} from "@/lib/session";

// The agent's defence surface is deliberately small. Proxying only these shapes
// keeps this from becoming an open proxy onto anything else on the agent.
const ALLOWED: readonly { method: string; pattern: RegExp; key: string }[] = [
  { method: "GET", pattern: /^\/session$/, key: "GET /session" },
  { method: "POST", pattern: /^\/briefs$/, key: "POST /briefs" },
  { method: "GET", pattern: /^\/briefs\/[^/]+$/, key: "GET /briefs/:id" },
  { method: "GET", pattern: /^\/briefs\/[^/]+\/evidence$/, key: "GET /briefs/:id/evidence" },
  { method: "GET", pattern: /^\/briefs\/[^/]+\/audit$/, key: "GET /briefs/:id/audit" },
  { method: "POST", pattern: /^\/briefs\/[^/]+\/review$/, key: "POST /briefs/:id/review" },
  { method: "POST", pattern: /^\/briefs\/[^/]+\/action$/, key: "POST /briefs/:id/action" },
  { method: "POST", pattern: /^\/briefs\/[^/]+\/action\/acknowledge$/, key: "POST /briefs/:id/acknowledge" },
  { method: "POST", pattern: /^\/briefs\/[^/]+\/action\/outcome$/, key: "POST /briefs/:id/outcome" },
];

// Only these fields may cross the bridge. Identity and evidence fields are
// refused here as well as by the agent's zod .strict() bodies, so the browser
// cannot even attempt to smuggle in a subject, commit, or evidence hash.
const BODY_FIELDS: Record<string, readonly string[]> = {
  "POST /briefs": ["runId"],
  "POST /briefs/:id/review": ["decision", "note"],
  "POST /briefs/:id/action": ["owner", "dueAt"],
  "POST /briefs/:id/acknowledge": [],
  "POST /briefs/:id/outcome": ["outcome"],
};

export interface ProxyResult {
  status: number;
  body: string;
  headers: Record<string, string>;
  setCookie?: string;
}

const json = (status: number, error: string): ProxyResult => ({
  status,
  body: JSON.stringify({ error }),
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

export function allowPath(method: string, rawPath: string): { ok: true; key: string } | { ok: false } {
  if (!rawPath.startsWith("/") || rawPath.includes("..")) return { ok: false };
  const match = ALLOWED.find((rule) => rule.method === method && rule.pattern.test(rawPath));
  return match ? { ok: true, key: match.key } : { ok: false };
}

export function filterBody(key: string, body: unknown): unknown {
  const allowed = BODY_FIELDS[key];
  if (!allowed) return undefined;
  if (allowed.length === 0) return {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const source = body as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of allowed) if (field in source) result[field] = source[field];
  return result;
}

const cookieValue = (request: Request, name: string): string | undefined =>
  (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const serializeCookie = (name: string, value: string, env: Env, maxAge: number): string => {
  const options = sessionCookieOptions(maxAge, env);
  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    "HttpOnly",
    `SameSite=Lax`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
};

export async function proxyDefense(
  request: Request,
  rawPath: string,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<ProxyResult> {
  const method = request.method.toUpperCase();
  const route = allowPath(method, rawPath);
  if (!route.ok) return json(404, "not found");

  // SameSite=Lax already blocks a cross-site cookie riding a POST; this makes
  // the CSRF boundary explicit for an endpoint that approves interventions.
  if (method !== "GET" && !isSameOrigin(request, env)) return json(403, "cross-origin request refused");

  let session = await openSession(cookieValue(request, SESSION_COOKIE), env);
  // GET /session is the one public read: the agent answers it without a token so
  // the UI can still distinguish "not configured" from "not signed in". Every
  // other route requires a real session.
  if (!session) {
    if (route.key === "GET /session") {
      try {
        const response = await fetchImpl(`${env.AGENT_URL ?? "http://localhost:8787"}/api/defense/session`, {
          method: "GET",
          cache: "no-store",
        });
        return {
          status: response.status,
          body: await response.text(),
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        };
      } catch {
        return json(502, "the defence service is unavailable");
      }
    }
    return json(401, "sign in to review this brief");
  }

  let refreshedCookie: string | undefined;

  if (session.expiresAt <= Date.now()) {
    const config = loadConfig(env);
    if (!session.refreshToken || !config) return json(401, "sign in again to continue");
    try {
      const tokens = await refreshToken(config, session.refreshToken);
      session = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? session.refreshToken,
        expiresAt: tokens.expiresAt,
      };
      const maxAge = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));
      refreshedCookie = serializeCookie(
        SESSION_COOKIE,
        await sealSession(session, env),
        env,
        maxAge
      );
    } catch (error) {
      if (error instanceof SsoError && error.status === 503) return json(503, "SSO token endpoint is unreachable");
      return json(401, "sign in again to continue");
    }
  }

  const body = method === "GET" ? undefined : filterBody(route.key, await request.json().catch(() => null));
  const headers: Record<string, string> = {
    // The sealed cookie is the only credential; a browser-supplied Authorization
    // header is deliberately never forwarded.
    authorization: `Bearer ${session.accessToken}`,
  };
  if (body !== undefined) headers["content-type"] = "application/json";

  try {
    const response = await fetchImpl(`${env.AGENT_URL ?? "http://localhost:8787"}/api/defense${rawPath}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const result: ProxyResult = {
      // Preserve the agent's status verbatim: 401/403/409/503 are meaningful to
      // the UI and must not collapse into 502.
      status: response.status,
      body: await response.text(),
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    };
    if (refreshedCookie) result.setCookie = refreshedCookie;
    return result;
  } catch {
    return json(502, "the defence service is unavailable");
  }
}