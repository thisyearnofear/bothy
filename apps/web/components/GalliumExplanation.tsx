import type { GraphRun } from "../lib/api";

const stages = [["Platform", "p.name"], ["System", "s.name"], ["Subsystem", "ss.name"], ["Assembly", "a.name"], ["Subassembly", "sa.name"], ["Component", "c.name"], ["Material", "m.name"], ["Primary material", "g.name"]] as const;

export default function GalliumExplanation({ run }: { run: GraphRun }) {
  const row = run.rows[0];
  return <section className="rounded-lg border p-4 sm:p-5" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-label="Gallium dependency explanation">
    <h2 className="text-xl font-semibold">Why this modeled platform appears in the gallium result</h2>
    <p className="mt-3 text-sm">Illustrative starter graph. Platform and part identities are synthetic. This is not a verified weapon-system bill of materials.</p>
    {row ? <>
      <p className="mt-3 text-sm">Selected captured row 1 of {run.rows.length}. This sample is not a total exposure count.</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stages.map(([label, column], index) => <li key={column} className="min-w-0 rounded border p-3" style={{ borderColor: "var(--rule)" }}>
        <p className="text-xs" style={{ color: "var(--cursor)" }}>{index + 1}. {label}</p>
        <p className="mt-2 break-words text-sm font-medium">{typeof row[column] === "string" ? row[column] : "Not recorded"}</p>
      </li>)}</ol>
      <p className="mt-3 text-sm">Stages 1–7 are directly connected by CONTAINS. The last segment spans 1–4 CONTAINS edges; its intermediate material names were not returned.</p>
      <p className="mt-2 break-all text-sm">Evidence: captured row 1 · graph revision {run.graphCommit ?? "not pinned"}.</p>
    </> : <p className="mt-3 text-sm">No chain rows captured. This does not establish no exposure.</p>}
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Official gallium supply context, separate from graph evidence</summary>
      <p className="mt-3">USGS Mineral Commodity Summaries 2026 reports China accounted for 99% of worldwide primary low-purity gallium production. This is not an EU-import or platform-specific share. <a className="underline" href="https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gallium.pdf">USGS source</a>.</p>
      <p className="mt-3">Gallium appears on the European Commission's 2023 critical raw materials list. <a className="underline" href="https://single-market-economy.ec.europa.eu/sectors/raw-materials/areas-specific-interest/critical-raw-materials_en">Commission source</a>.</p>
      <p className="mt-3">These sources explain material relevance. Neither validates this synthetic platform's BOM. Confirm programme mapping, inventory, alternatives, and timing with an authorized owner.</p>
    </details>
  </section>;
}
