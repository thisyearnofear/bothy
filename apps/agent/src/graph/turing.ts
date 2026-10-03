/** Catalogue-only TuringDB sidecar client (loopback bridge on :6777).
 * Reads are revision-pinned; the reviewed simulation is a single isolated
 * request and cannot submit. A dead/old sidecar fails explicitly.
 */
import { readFileSync } from "node:fs";
import type { GraphRows } from "../../../../packages/shared/src/types";
export type { GraphRows } from "../../../../packages/shared/src/types";

const BASE = process.env.TURING_SIDECAR_URL ?? "http://localhost:6777";
const TIMEOUT_MS = Number(process.env.TURING_SIDECAR_TIMEOUT ?? 8000);
const policy = JSON.parse(readFileSync(new URL("./read-policy.json", import.meta.url), "utf8")) as {
  reads: Record<string, string[]>;
  simulation: { graph: string; writes: string[]; readCypher: string };
};

async function req<T>(path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = (await r.json()) as T & { ok?: boolean; error?: string };
    if (!r.ok) throw new GraphRequestError(r.status, data.error ?? "graph operation unavailable");
    return data;
  } finally {
    clearTimeout(t);
  }
}

export class GraphRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function graphAvailable(): Promise<{ ok: boolean; graphs?: string[]; requestIsolation?: boolean; pinnedReads?: boolean; error?: string }> {
  try {
    const h = await req<{ ok: boolean; graphs: string[]; requestIsolation?: boolean; pinnedReads?: boolean }>("/health");
    return { ...h, ok: h.requestIsolation === true && h.pinnedReads === true,
      ...(h.requestIsolation && h.pinnedReads ? {} : { error: "restart the sidecar with request isolation and pinned reads" }) };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

/** Run read-only Cypher on a graph; optional commit pins a time-travel read. */
export async function graphQuery(graph: string, cypher: string, commit?: string): Promise<GraphRows> {
  // Reject writes before any HTTP call, even if an old sidecar is still up.
  if (!Object.hasOwn(policy.reads, graph) || !policy.reads[graph].includes(cypher)) {
    throw new GraphRequestError(400, "query is not in the read-only catalogue");
  }
  if (commit !== undefined && !/^[a-fA-F0-9]{1,128}$/.test(commit)) {
    throw new GraphRequestError(400, "commit must be a bare hexadecimal graph revision");
  }
  const result = await req<GraphRows>("/query", { graph, cypher, commit });
  if (!result.graphCommit || (commit !== undefined && result.graphCommit !== commit)) {
    throw new Error("sidecar returned unpinned/mismatched rows; restart the hardened sidecar");
  }
  return result;
}

export async function graphHistory(graph: string): Promise<GraphRows> {
  if (!Object.hasOwn(policy.reads, graph)) throw new GraphRequestError(400, "graph is not in the read catalogue");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BASE}/history?graph=${encodeURIComponent(graph)}`, { signal: ctrl.signal });
    const data = (await r.json()) as GraphRows;
    if (!r.ok) throw new Error(`history failed: ${r.status}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

/** One sidecar request owns the whole lifecycle; no public submit endpoint. */
export async function graphSimulate(body: { graph: string; writes: string[]; readCypher: string }) {
  if (body.graph !== policy.simulation.graph || body.readCypher !== policy.simulation.readCypher ||
      !Array.isArray(body.writes) || JSON.stringify(body.writes) !== JSON.stringify(policy.simulation.writes)) {
    throw new GraphRequestError(400, "only the reviewed temporary-marker simulation is enabled");
  }
  return req<{ ok: boolean; kept: false; graphCommit: string; beforeCount: number; afterCount: number }>("/simulate", body);
}

/** Pre-built blast-radius queries for the defense demo (TuringDB postfix quantifiers). */
export const BLAST_QUERIES = {
  /** Platform -> raw minerals, exactly 8 CONTAINS hops. */
  bom8: (archetype: string) =>
    `MATCH (p:Platform {archetype:'${archetype.replace(/'/g, "\\'")}'})-[:CONTAINS]->{8,8}(m:Mineral) RETURN DISTINCT p.name, m.name`,
  /** Every platform ultimately depending on a material, any depth. */
  materialExposure: (material: string) =>
    `MATCH (p:Platform)-[:CONTAINS]->+(:Material {name:'${material.replace(/'/g, "\\'")}'}) RETURN DISTINCT p.name LIMIT 50`,
  /** NATO-HQ companies whose ultimate parent sits in a country (ownership chains). */
  ownership: (hqCountry: string) =>
    `MATCH (:Country {nato_member:true})<-[:HEADQUARTERED_IN]-(c:Company)-[:SUBSIDIARY_OF]->+(u:Company {hq_country:'${hqCountry}'}) RETURN DISTINCT c.name, u.name LIMIT 20`,
  /** Primes downstream of shipments through a chokepoint. */
  chokepoint: (chokepoint: string) =>
    `MATCH (s:Shipment)-[:TRANSITED]->(:Chokepoint {name:'${chokepoint.replace(/'/g, "\\'")}'}), (s)-[:SHIPPED_TO]->(f:Facility)-[:SUPPLIES]->+(prime:Facility {facility_type:'final assembly plant'}) RETURN DISTINCT prime.name LIMIT 20`,
  /** High-risk shipments for a product with supplier + country. */
  riskyShipments: (productId: string) =>
    `MATCH (s:Shipment)-[:CLASSIFIED_AS]->(:RiskClassification {name:'High Risk'}), (s)-[:FROM_SUPPLIER]->(sup:Supplier)-[:SUPPLIES]->(:Product {product_id:'${productId}'}), (sup)-[:LOCATED_IN]->(co:Country) RETURN s.shipment_id, sup.supplier_id, co.name, s.delivery_time_deviation LIMIT 20`,
};

/** Defense scenario runner; legacy templates must satisfy the same catalogue. */
import { getScenarioDef } from "./scenarios";

export async function runScenario(id: string, commit?: string): Promise<GraphRows & { scenario: string }> {
  const def = getScenarioDef(id);
  if (!def) throw new Error(`unknown scenario: ${id}`);
  const r = await graphQuery(def.graph, def.cypher, commit);
  return { ...r, scenario: def.id };
}
