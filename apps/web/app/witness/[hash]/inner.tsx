"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { PilotInterestForm } from "../../../components/EyPilotBand";
import type { GraphWitness } from "../../../../../packages/shared/src/types";
import { card } from "../../../lib/ui";

type Pack = Omit<GraphWitness, "pack"> & {
  pack: Partial<GraphWitness["pack"]> & { officer?: string | null };
  links?: { page: string; rerun: string };
};


export default function WitnessInner({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params);
  const [data, setData] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.witness(hash).then(setData).catch((e) => setError(String((e as Error)?.message ?? e)));
  }, [hash]);

  if (error) {
    return (
      <div className="rounded-lg border p-4" style={card}>
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Witness-pack</p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-body)" }}>Pack unavailable ({hash.slice(0, 12)}…). It may be unknown, or the evidence service may be offline. Packs persist in the local SQLite store.</p>
        <Link href="/defense" className="mono mt-3 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>← open the defence workspace</Link>
      </div>
    );
  }
  if (!data) return <p className="mono text-sm" style={{ color: "var(--text-faint)" }}>loading witness-pack…</p>;

  const rows = data.pack.rows ?? [];
  return (
    <div>
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Witness-pack · unapproved analysis</p>
      <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
        {data.pack.scenarioId ?? "blast query"} · {rows.length} rows
      </h1>
      <p className="mono mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
        hash {data.hash.slice(0, 16)}… · prev {String(data.prev).slice(0, 12)} · {data.at}
        {data.pack.officer ? ` · officer ${data.pack.officer}` : ""}
      </p>
      <p className="mt-3 text-sm leading-relaxed">
        {data.pack.version === 1 ? "Server-captured evidence snapshot." : "Legacy export: server-captured provenance is not established."}
        {" "}Hash linkage is not an authenticated signature or proof of source truth.
      </p>
      {data.pack.graph && <p className="mono mt-2 break-all text-xs" style={{ color: "var(--text-faint)" }}>
        graph {data.pack.graph} · captured {data.pack.capturedAt}
        {" · "}{data.pack.graphCommit ? `commit ${data.pack.graphCommit}` : "HEAD was not commit-pinned"}
      </p>}
      {data.pack.sourceBoundary && <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>{data.pack.sourceBoundary}</p>}

      <section className="mt-4 rounded-lg border p-3" style={card} aria-label="Evidence rows">
        <ul className="mono max-h-72 space-y-1 overflow-auto text-xs leading-5">
          {rows.slice(0, 20).map((r, i) => (
            <li key={i} style={{ color: "var(--text-body)" }}>{Object.values(r).join(" ← ")}</li>
          ))}
        </ul>
        {rows.length > 20 && <p className="mono mt-1 text-xs" style={{ color: "var(--text-faint)" }}>… +{rows.length - 20} more in download</p>}
      </section>

      <section className="mt-2 flex flex-wrap gap-2" aria-label="Forward">
        <Link href={data.links?.rerun ?? "/defense"} className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
          Open this exposure question →
        </Link>
        <a
          className="mono rounded border px-3 py-1.5 text-xs"
          style={{ borderColor: "var(--rule)", color: "var(--cursor)" }}
          href={`data:application/json,${encodeURIComponent(JSON.stringify(data, null, 2))}`}
          download={`witness-${data.hash.slice(0, 8)}.json`}
        >
          Download JSON
        </a>
      </section>

      <section className="mt-2 rounded-lg border p-3" style={card} aria-label="Pilot">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Test one programme-impact question</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>A two-week pilot with your analyst and an agreed reference dataset. This demo snapshot is not proof of operational effectiveness.</p>
        <PilotInterestForm />
      </section>

      <Link href="/defense" className="mono mt-3 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>← back to defence workspace</Link>
    </div>
  );
}
