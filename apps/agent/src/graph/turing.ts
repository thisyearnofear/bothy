/** Minimal TuringDB sidecar client (Python stdlib bridge -> TuringDB HTTP :6677).
 * Sidecar: apps/agent/src/graph/sidecar.py on :6777. All queries are read-only
 * Cypher except the explicit simulate-branch flow (change/new -> checkout ->
 * query -> submit/abandon). Timeouts are short so a dead sidecar degrades to
 * "graph unavailable" instead of hanging an assessment.
 */

const BASE = process.env.TURING_SIDECAR_URL ?? "http://localhost:6777";
const TIMEOUT_MS = Number(process.env.TURING_SIDECAR_TIMEOUT ?? 8000);

export interface GraphRows {
  columns: string[];
  rows: Record<string, unknown>[];
  count: number;
  ms: number;
}

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
    if (!r.ok) throw new Error(`sidecar ${path}: ${data.error ?? r.status}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

export async function graphAvailable(): Promise<{ ok: boolean; graphs?: string[]; error?: string }> {
  try {
    const h = await req<{ ok: boolean; graphs: string[] }>("/health");
    return { ok: true, graphs: h.graphs };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

/** Run read-only Cypher on a graph; optional commit pins a time-travel read. */
export async function graphQuery(graph: string, cypher: string, commit?: string): Promise<GraphRows> {
  return req<GraphRows>("/query", { graph, cypher, commit });
}

export async function graphHistory(graph: string): Promise<GraphRows> {
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

/** Simulate-branch lifecycle: open change -> run writes/reads -> submit|abandon. */
export const graphChange = {
  async open(): Promise<number> {
    const r = await req<{ ok: boolean; change: number }>("/change/new", {});
    return r.change;
  },
  async checkout(change: number): Promise<void> {
    await req("/change/checkout", { change });
  },
  async submit(): Promise<void> {
    await req("/change/submit", {});
  },
  async abandon(): Promise<void> {
    await req("/change/abandon", {});
  },
};

/** Pre-built blast-radius queries for the defense demo (TuringDB postfix quantifiers). */
export const BLAST_QUERIES = {
  /** Platform -> raw minerals, exactly 8 CONTAINS hops. */
  bom8: (archetype: string) =>
    `MATCH (p:Platform {archetype:'${archetype.replace(/'/g, "\\'")}')-[:CONTAINS]->{8,8}(m:Mineral) RETURN DISTINCT p.name, m.name`,
  /** Every platform ultimately depending on a material, any depth. */
  materialExposure: (material: string) =>
    `MATCH (p:Platform)-[:CONTAINS]->+(:Material {name:'${material.replace(/'/g, "\\'")}') RETURN DISTINCT p.name`,
  /** NATO-HQ companies whose ultimate parent sits in a country (ownership chains). */
  ownership: (hqCountry: string) =>
    `MATCH (:Country {nato_member:true})<-[:HEADQUARTERED_IN]-(c:Company)-[:SUBSIDIARY_OF]->+(u:Company {hq_country:'${hqCountry}'}) RETURN DISTINCT c.name, u.name LIMIT 20`,
  /** Primes downstream of shipments through a chokepoint. */
  chokepoint: (chokepoint: string) =>
    `MATCH (s:Shipment)-[:TRANSITED]->(:Chokepoint {name:'${chokepoint.replace(/'/g, "\\'")}'), (s)-[:SHIPPED_TO]->(f:Facility)-[:SUPPLIES]->+(prime:Facility {facility_type:'final assembly plant'}) RETURN DISTINCT prime.name LIMIT 20`,
  /** High-risk shipments for a product with supplier + country. */
  riskyShipments: (productId: string) =>
    `MATCH (s:Shipment)-[:CLASSIFIED_AS]->(:RiskClassification {name:'High Risk'}), (s)-[:FROM_SUPPLIER]->(sup:Supplier)-[:SUPPLIES]->(:Product {product_id:'${productId}'}), (sup)-[:LOCATED_IN]->(co:Country) RETURN s.shipment_id, sup.supplier_id, co.name, s.delivery_time_deviation LIMIT 20`,
};

/** Defense scenario catalogue runner (see ./scenarios.ts). BLAST_QUERIES above untouched. */
import { getScenarioDef } from "./scenarios";

export async function runScenario(id: string, commit?: string): Promise<GraphRows & { scenario: string }> {
  const def = getScenarioDef(id);
  if (!def) throw new Error(`unknown scenario: ${id}`);
  const r = await graphQuery(def.graph, def.cypher, commit);
  return { ...r, scenario: def.id };
}
