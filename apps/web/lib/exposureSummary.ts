import type { GraphRun } from "./api";

/** Describe only entities present in captured evidence; never infer total impact. */
export function exposureSummary(run: GraphRun) {
  if (run.scenarioId !== "gallium-exposure") {
    return {
      heading: run.rows.length ? `${run.rows.length} captured dependency row${run.rows.length === 1 ? "" : "s"}` : "No matching rows captured",
      explanation: "Inspect the captured relationships before drawing a programme conclusion.",
      names: [] as string[],
      gaps: ["Captured rows are not a total programme-impact count. Zero rows does not establish no exposure."],
    };
  }
  const names = [...new Set(run.rows.flatMap((row) => {
    const name = row["p.name"];
    return typeof name === "string" && name.trim() ? [name] : [];
  }))];
  const missing = run.rows.filter((row) => typeof row["p.name"] !== "string" || !String(row["p.name"]).trim()).length;
  return {
    heading: names.length ? `${names.length} platform name${names.length === 1 ? "" : "s"} observed with gallium dependencies` : "No identifiable platform names captured",
    explanation: "The captured query matches platforms connected to Primary gallium through one or more CONTAINS relationships. It returns names, not the intervening dependency paths or programme identities.",
    names,
    gaps: [
      run.rows.length >= 50 ? "The query limit of 50 rows was reached; additional matches may be omitted." : "This query is limited to 50 rows. Overall graph coverage is unknown.",
      ...(missing ? [`${missing} captured row${missing === 1 ? " has" : "s have"} no usable platform name.`] : []),
      ...(run.rows.length === 0 ? ["No matching rows were captured. This is not evidence of no exposure."] : []),
      "Names are not unique programme identifiers. Inventory, substitutes, delivery timing, and production effects still need verification.",
    ],
  };
}

export type CatalogueState = "loading" | "ready" | "empty" | "unavailable";
export const catalogueLabel = (state: CatalogueState) => ({
  loading: "Loading questions…",
  ready: "Choose an exposure question",
  empty: "No exposure questions configured",
  unavailable: "Exposure questions unavailable",
})[state];
