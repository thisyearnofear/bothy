"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { PilotInterestForm } from "../../../components/EyPilotBand";

type Pack = {
  hash: string;
  prev: string | null;
  at: string;
  pack: { scenarioId?: string; officer?: string | null; rows?: Record<string, unknown>[]; at?: string };
  links?: { page: string; rerun: string };
};

const card = { borderColor: "var(--rule)", background: "var(--panel)" } as const;

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
        <p className="mt-2 text-sm" style={{ color: "var(--text-body)" }}>Unknown or expired pack ({hash.slice(0, 12)}…). Packs live in server memory for the session.</p>
        <Link href="/watch" className="mono mt-3 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>← run a scenario in the watch room</Link>
      </div>
    );
  }
  if (!data) return <p className="mono text-sm" style={{ color: "var(--text-faint)" }}>loading witness-pack…</p>;

  const rows = data.pack.rows ?? [];
  return (
    <div>
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Witness-pack · hash-linked evidence</p>
      <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
        {data.pack.scenarioId ?? "blast query"} · {rows.length} rows
      </h1>
      <p className="mono mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
        hash {data.hash.slice(0, 16)}… · prev {String(data.prev).slice(0, 12)} · {data.at}
        {data.pack.officer ? ` · officer ${data.pack.officer}` : ""}
      </p>

      <section className="mt-4 rounded-lg border p-3" style={card} aria-label="Evidence rows">
        <ul className="mono max-h-72 space-y-1 overflow-auto text-xs leading-5">
          {rows.slice(0, 20).map((r, i) => (
            <li key={i} style={{ color: "var(--text-body)" }}>{Object.values(r).join(" ← ")}</li>
          ))}
        </ul>
        {rows.length > 20 && <p className="mono mt-1 text-xs" style={{ color: "var(--text-faint)" }}>… +{rows.length - 20} more in download</p>}
      </section>

      <section className="mt-2 flex flex-wrap gap-2" aria-label="Forward">
        <Link href={data.links?.rerun ?? "/watch"} className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
          Re-run this scenario live →
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
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Bring this to your cell</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>2-week pilot on your lanes + BOM. This pack is the first exhibit.</p>
        <PilotInterestForm />
      </section>

      <Link href="/watch" className="mono mt-3 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>← back to watch room</Link>
    </div>
  );
}
