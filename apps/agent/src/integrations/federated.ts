// Federated evidence capture for the defence path: reviewed Lightning SQL
// questions run through Zetaris at draft time, frozen into federated_runs and
// bound into the brief by hash — the same pin-and-verify discipline as the
// versioned graph capture. The catalogue is allowlisted per scenario; callers
// can never supply SQL. Unconfigured or unreachable federation degrades to a
// stated gap, never a fabricated capture.

import { createHash, randomUUID } from "node:crypto";
import type { FederatedRun } from "../../../../packages/shared/src/types";
import { runSql, zetarisConfig, type ZetarisRows } from "./zetaris";

export interface FederatedQuestion {
  id: string;
  title: string;
  // "rows": each captured row becomes a cited claim. "context": the reach is
  // cited once; rows are envelope/metadata not meaningful as findings.
  kind: "rows" | "context";
  sql: string;
  limit: number;
  sourceBoundary: string;
}

const INVENTORY: FederatedQuestion = {
  id: "ops-inventory-contracts",
  title: "Ops inventory and contract extract",
  kind: "rows",
  sql: "SELECT * FROM BOTHY_OPS.inventory_contracts WHERE notes LIKE '%gallium%' AND notes NOT LIKE '%no gallium%' AND notes NOT LIKE '%unaffected%'",
  limit: 100,
  sourceBoundary:
    "Analyst-side inventory/contract extract federated in place through Zetaris (BOTHY_OPS.inventory_contracts), keyword-filtered to gallium-bearing lines — the reviewed question states its markers, it does not infer semantics. Synthetic demo rows the dependency graph never ingested: stock and contract posture, not verified programme impact.",
};

// One Lightning query across three heterogeneous sources — the ops filestore
// table, the company_dns REST registry, and SEC EDGAR filings — projected into
// a single evidence table. This is the federated-query story, not parallel API
// calls: Zetaris plans and runs the cross-source statement in place.
const CROSS_SOURCE: FederatedQuestion = {
  id: "cross-source-check",
  title: "Cross-source evidence reconciliation",
  kind: "rows",
  sql: "SELECT supplier AS entry_name, 'ops-inventory' AS evidence_source, contract_ref AS detail FROM BOTHY_OPS.inventory_contracts WHERE notes LIKE '%gallium%' AND notes NOT LIKE '%no gallium%' AND notes NOT LIKE '%unaffected%' UNION ALL SELECT entityName, 'sec-edgar-filings', label FROM SEC_DATA.ford_revenue_facts UNION ALL SELECT code, 'eu-nace-registry', message FROM COMPANY_DNS_EU.nace_raw ORDER BY evidence_source LIMIT 20",
  limit: 20,
  sourceBoundary:
    "One Lightning SQL statement federating BOTHY_OPS (filestore), SEC_DATA and COMPANY_DNS_EU (REST) into a single projection, ordered by evidence source. Ops rows are synthetic; registry and filings rows are real public data but are not entity-matched to the synthetic supplier names.",
};

// Reviewed federation catalogue keyed by defence scenario. Sources the curated
// graph never ingested: the analyst's own ops extract, plus a cross-source
// query that exercises Zetaris federation rather than parallel API calls.
export const FEDERATED_QUESTIONS: Record<string, FederatedQuestion[]> = {
  "gallium-exposure": [INVENTORY, CROSS_SOURCE],
  "gallium-chain": [INVENTORY],
};

export function federatedCatalogue(scenarioId: string): FederatedQuestion[] {
  return FEDERATED_QUESTIONS[scenarioId] ?? [];
}

export interface FederationCapture {
  runs: FederatedRun[];
  unavailable: string[];
  // Optional model-drafted claim text per "rows" run: narrative[fedIndex]
  // aligns with runs, each entry parallel to that run's cited rows. Missing
  // or short entries fall back to the deterministic field rendering.
  narrative?: (string | undefined)[][] | null;
  narrativeModel?: string;
}

export const federatedHash = (runs: FederatedRun[]) =>
  createHash("sha256").update(JSON.stringify(runs)).digest("hex");

type Exec = (sql: string, limit: number) => Promise<ZetarisRows>;

const sqlHash = (sql: string) => createHash("sha256").update(sql).digest("hex");

function toRun(question: FederatedQuestion, result: ZetarisRows): FederatedRun {
  const columns = Array.isArray(result.headers) ? result.headers.map(String) : [];
  const raw = Array.isArray(result.data) ? result.data : [];
  const rows = raw.map((cells) =>
    Object.fromEntries(columns.map((column, index) => [column, Array.isArray(cells) ? cells[index] ?? null : null])),
  );
  return {
    runId: randomUUID(),
    questionId: question.id,
    title: question.title,
    kind: question.kind,
    source: "zetaris",
    sql: question.sql,
    sqlHash: sqlHash(question.sql),
    capturedAt: new Date().toISOString(),
    columns,
    rows,
    count: rows.length,
    total: typeof result.total === "number" ? result.total : rows.length,
    sourceBoundary: question.sourceBoundary,
  };
}

/** Run the reviewed federated questions for a scenario. Never throws:
 * unconfigured federation or a failed leg lands in `unavailable`. */
export async function captureFederation(
  scenarioId: string,
  exec?: Exec,
): Promise<FederationCapture> {
  const questions = federatedCatalogue(scenarioId);
  const capture: FederationCapture = { runs: [], unavailable: [] };
  if (!questions.length) return capture;
  const run = exec ?? defaultExec();
  if (!run) {
    capture.unavailable = questions.map((question) => question.title);
    return capture;
  }
  for (const question of questions) {
    try {
      capture.runs.push(toRun(question, await run(question.sql, question.limit)));
    } catch {
      capture.unavailable.push(question.title);
    }
  }
  return capture;
}

function defaultExec(): Exec | null {
  const cfg = zetarisConfig();
  if (!cfg) return null;
  return (sql, limit) => runSql(cfg, sql, limit);
}
