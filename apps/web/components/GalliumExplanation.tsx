"use client";

import { useState, type CSSProperties } from "react";
import type { GraphRun } from "../lib/api";

const stages = [["Platform", "p.name"], ["System", "s.name"], ["Subsystem", "ss.name"], ["Assembly", "a.name"], ["Subassembly", "sa.name"], ["Component", "c.name"], ["Material", "m.name"], ["Primary material", "g.name"]] as const;
const value = (row: Record<string, unknown>, key: string) => typeof row[key] === "string" && row[key] ? String(row[key]) : "Not recorded";

export default function GalliumExplanation({ run }: { run: GraphRun }) {
  const [sample, setSample] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const row = run.rows[sample];
  const control = "coarse-target rounded-lg border px-4 py-2 text-sm";
  return <section className="rounded-xl border p-5 sm:p-7" style={{ borderColor: "var(--cursor)", background: "var(--panel)" }} aria-label="Gallium dependency explanation">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>02 / Follow the dependency</p>
      <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--rule)" }}>Synthetic model · captured evidence</span>
    </div>
    <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">A small material. A long dependency.</h2>
    <div className="record-status mt-3"><span>Modeled relationship</span><span>Not a real BOM</span><span>Not confirmed production loss</span></div>
    {row ? <>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <label className="min-w-0 max-w-full text-sm">Captured sample
          <select className="mt-2 block w-full max-w-full rounded-lg border px-3 py-2" style={{ background: "var(--panel)", borderColor: "var(--rule)" }} value={sample}
            onChange={(e) => { setSample(Number(e.target.value)); setExpanded(false); }}>
            {run.rows.map((item, index) => <option key={index} value={index}>Path {index + 1}: {value(item, "c.family")}</option>)}
          </select>
        </label>
        <button className={control} style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }} aria-expanded={expanded} aria-controls={`chain-${run.runId}`} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Return to the big picture" : "Reveal the full dependency"}
        </button>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]" aria-label="Dependency overview">
        {([["Platform", "p.name"], ["Component", "c.name"], ["Material", "g.name"]] as const).map(([label, key], index) => <div key={key} className="contents">
          {index > 0 && <p className="self-center text-center text-xs" style={{ color: "var(--cursor)" }}>connected through<br />modeled dependencies ↓</p>}
          <div className="min-w-0 rounded-lg border p-4 sm:p-5" style={{ borderColor: "var(--rule)", background: "var(--page)" }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--cursor)" }}>{label}</p>
            <p className="mt-3 break-words text-lg font-semibold">{value(row, key)}</p>
          </div>
        </div>)}
      </div>
      <div id={`chain-${run.runId}`} hidden={!expanded} className="mt-5">
        <ol key={`${sample}-${expanded}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stages.map(([label, column], index) => <li key={column} className="stage-in min-w-0 rounded-lg border p-4" style={{ borderColor: "var(--rule)", "--stage": index } as CSSProperties}>
          <p className="text-xs" style={{ color: "var(--cursor)" }}>{index + 1}. {label}</p>
          <p className="mt-2 break-words text-sm font-medium">{value(row, column)}</p>
        </li>)}</ol>
        <p className="mt-3 text-sm">Stages 1–7 are directly connected by CONTAINS. The final segment spans 1–4 edges; intermediate material names were not returned.</p>
      </div>
      <p role="status" className="mt-4 text-sm">Showing captured path {sample + 1} of {run.rows.length}. {expanded ? "Full returned hierarchy revealed." : "Overview groups the captured hierarchy; connectors are not direct edges."} Query limit: 10 paths; this is not total exposure.</p>
      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--rule)" }}>
        <h3 className="eyebrow">Next: cited brief → authorized owner</h3>
        <ul className="measure-list mt-3">{["Programme mapping", "Inventory", "Qualified alternatives", "Delivery timing"].map((check) => <li key={check}>{check}</li>)}</ul>
      </div>
      <details className="mt-4 text-sm"><summary className="cursor-pointer">Capture receipt and source boundary</summary>
        <p className="mt-3 break-all">Row {sample + 1} · revision {run.graphCommit ?? "not pinned"} · captured {new Date(run.capturedAt).toLocaleString()}.</p>
        <p className="mt-2">{run.sourceBoundary}</p>
      </details>
    </> : <p className="mt-4 text-sm">No chain rows captured. This does not establish no exposure.</p>}
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">Why gallium matters: official context</summary>
      <p className="mt-3">USGS 2026 reports China accounted for 99% of worldwide primary low-purity gallium production. This is not an EU-import or platform-specific share. <a className="underline" href="https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gallium.pdf">USGS source</a>.</p>
      <p className="mt-3">Gallium appears on the European Commission's 2023 critical raw materials list. <a className="underline" href="https://single-market-economy.ec.europa.eu/sectors/raw-materials/areas-specific-interest/critical-raw-materials_en">Commission source</a>.</p>
      <p className="mt-3">Neither source validates this synthetic platform's BOM.</p>
    </details>
  </section>;
}
