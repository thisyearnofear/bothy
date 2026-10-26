// Zetaris REST client — federated Lightning SQL for the defence path.
// Contract per zetaris/getting-started scripts/zetaris_sql.py (RestChannel):
//   base: ZETARIS_REST_URL (the instance origin, e.g. http://localhost:3000 or
//         an SSH-tunnelled VPS endpoint)
//   headers: Authorization Bearer <ZETARIS_API_KEY>, X-Org-ID (numeric),
//            X-Request-ID (uuid per call)
//   POST /api/proxy/sql-editor/sqls/run-query  { sql, limit }
//     -> { headers: string[], data: any[][], total, timeUsed }
//   GET  /datasource/datasources -> source list
// The client is inert unless configured; every failure maps to a typed error
// so the defence surface can degrade honestly instead of hanging.

import { randomUUID } from "node:crypto";

export interface ZetarisConfig {
  baseUrl: string;
  apiKey: string;
  orgId: string;
}

export function zetarisConfig(env: NodeJS.ProcessEnv = process.env): ZetarisConfig | null {
  const baseUrl = env.ZETARIS_REST_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.ZETARIS_API_KEY?.trim();
  const orgId = env.ZETARIS_ORG_ID?.trim() ?? "1";
  if (!baseUrl || !apiKey) return null;
  if (!/^https?:\/\/[^/]+$/.test(baseUrl) || !/^\d+$/.test(orgId)) return null;
  return { baseUrl, apiKey, orgId };
}

export class ZetarisError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(cfg: ZetarisConfig, path: string, body?: Record<string, unknown>, timeoutMs = 60_000): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "x-org-id": cfg.orgId,
      "x-request-id": randomUUID(),
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 300);
    throw new ZetarisError(`zetaris ${res.status}: ${text}`, res.status);
  }
  return (await res.json()) as T;
}

export interface ZetarisRows {
  headers: string[];
  data: unknown[][];
  total: number;
  timeUsed?: number;
  [key: string]: unknown;
}

/** Run one Lightning SQL statement (no trailing semicolon), rows capped by limit. */
export async function runSql(cfg: ZetarisConfig, sql: string, limit = 100): Promise<ZetarisRows> {
  return call<ZetarisRows>(cfg, "/api/proxy/sql-editor/sqls/run-query", { sql, limit });
}

export async function listDatasources(cfg: ZetarisConfig): Promise<unknown> {
  return call<unknown>(cfg, "/datasource/datasources");
}

/** Health/config probe for the defence surface; never throws. */
export async function zetarisStatus(): Promise<{ configured: boolean; reachable?: boolean; detail?: string }> {
  const cfg = zetarisConfig();
  if (!cfg) return { configured: false };
  try {
    const result = (await runSql(cfg, "SELECT 1", 1)) as ZetarisRows;
    return { configured: true, reachable: true, detail: `SELECT 1 ok (${Array.isArray(result?.data) ? result.data.length : 0} row)` };
  } catch (error) {
    return { configured: true, reachable: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
