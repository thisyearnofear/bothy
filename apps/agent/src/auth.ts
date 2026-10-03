import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { RequestHandler } from "express";

export type Role = "analyst" | "reviewer" | "action-owner";
export interface Principal { subject: string; roles: Role[] }
const ROLES = new Set<Role>(["analyst", "reviewer", "action-owner"]);

export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function createAuth(env: NodeJS.ProcessEnv = process.env, keys?: JWTVerifyGetKey) {
  let principals: Record<string, Role[]> = Object.create(null);
  let resolver: JWTVerifyGetKey | undefined;
  const issuer = env.BOTHY_OIDC_ISSUER;
  const audience = env.BOTHY_OIDC_AUDIENCE;
  try {
    const parsed: unknown = JSON.parse(env.BOTHY_OIDC_PRINCIPALS ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    for (const [subject, roles] of Object.entries(parsed)) {
      if (!subject || !Array.isArray(roles) || !roles.length || roles.some((role) => !ROLES.has(role))) throw new Error();
      principals[subject] = roles;
    }
    const jwks = new URL(env.BOTHY_OIDC_JWKS_URL ?? "");
    const origin = new URL(issuer ?? "");
    if (!audience || jwks.protocol !== "https:" || origin.protocol !== "https:" ||
        jwks.username || jwks.password || origin.username || origin.password ||
        !Object.keys(principals).length) throw new Error();
    resolver = keys ?? createRemoteJWKSet(jwks, { timeoutDuration: 5000, cacheMaxAge: 300000 });
  } catch {
    principals = {};
  }
  const configured = Boolean(resolver);
  return {
    configured,
    canOwn: (subject: string) => Object.hasOwn(principals, subject) && principals[subject].includes("action-owner"),
    async authenticate(header: string | undefined): Promise<Principal> {
      if (!resolver) throw new AccessError(503, "OIDC review is not configured; approval is disabled");
      if (!header?.startsWith("Bearer ") || header.length > 16384) throw new AccessError(401, "bearer access token required");
      try {
        const { payload } = await jwtVerify(header.slice(7), resolver, {
          issuer, audience, algorithms: ["RS256", "ES256"],
          requiredClaims: ["sub", "exp", "iat"], maxTokenAge: "1h",
        });
        if (!payload.sub || !Object.hasOwn(principals, payload.sub)) throw new AccessError(403, "subject has no assigned roles");
        return { subject: payload.sub, roles: [...principals[payload.sub]] };
      } catch (e) {
        if (e instanceof AccessError) throw e;
        throw new AccessError(401, "access token could not be verified");
      }
    },
    require(...roles: Role[]): RequestHandler {
      return async (req, res, next) => {
        try {
          const principal = await this.authenticate(req.headers.authorization);
          if (!roles.some((role) => principal.roles.includes(role))) throw new AccessError(403, "role is not permitted");
          res.locals.principal = principal;
          next();
        } catch (e) {
          const error = e instanceof AccessError ? e : new AccessError(503, "authentication unavailable");
          res.status(error.status).json({ error: error.message });
        }
      };
    },
  };
}
