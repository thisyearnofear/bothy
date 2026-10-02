"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type GraphDiff, type GraphRows, type GraphScenario } from "../lib/api";

const esc = (s: string) => s.replace(/'/g, "\\'");

function buildCypher(kind: string): string {
  if (kind.startsWith("material:")) {
    const t = esc(kind.slice(9) || "Primary gallium");
    return `MATCH (p:Platform)-[:CONTAINS]->+(:Material {name:'${t}'}) RETURN DISTINCT p.name`;
  }
  if (kind.startsWith("ownership:")) {
    const t = esc(kind.slice(10) || "CHN");
    return `MATCH (:Country {nato_member:true})<-[:HEADQUARTERED_IN]-(c:Company)-[:SUBSIDIARY_OF]->+(u:Company {hq_country:'${t}'}) RETURN DISTINCT c.name, u.name LIMIT 20`;
  }
  if (kind.startsWith("chokepoint:")) {
    const t = esc(kind.slice(11) || "Taiwan Strait");
    return `MATCH (s:Shipment)-[:TRANSITED]->(:Chokepoint {name:'${t}'}) RETURN DISTINCT s.shipment_id LIMIT 20`;
  }
  if (kind.startsWith("risk:")) {
    return `MATCH (s:Shipment)-[:CLASSIFIED_AS]->(:RiskClassification {name:'High Risk'}) RETURN s.shipment_id LIMIT 20`;
  }
  const t = esc(kind.startsWith("bom:") ? kind.slice(4) : "Loitering munition");
  return `MATCH (p:Platform {archetype:'${t || "Loitering munition"}'})-[:CONTAINS]->{8,8}(m:Mineral) RETURN DISTINCT p.name, m.name`;
}

const FALLBACKS: GraphScenario[] = [
  { id: "bom-loitering", title: "Loitering munition — 8-hop BOM", stakes: "Which minerals break the build if one tier-3 supplier fails.", graph: "supply_chain_deep", kind: "bom:Loitering munition", howToRead: "Each row is one platform-to-mineral path. Count is blast radius." },
  { id: "material-gallium", title: "Primary gallium dependency", stakes: "Which platforms stop if gallium is constrained.", graph: "supply_chain_deep", kind: "material:Primary gallium", howToRead: "Each row is a dependent platform. Short list, high leverage." },
  { id: "ownership-chn", title: "NATO firms with CHN parents", stakes: "Ownership exposure hidden behind subsidiaries.", graph: "supply_chain_deep", kind: "ownership:CHN", howToRead: "Company pairs: NATO-housed firm left, ultimate parent right." },
  { id: "chokepoint-taiwan", title: "Primes behind the Taiwan Strait", stakes: "Final assembly downstream of one chokepoint.", graph: "supply_chain_deep", kind: "chokepoint:Taiwan Strait", howToRead: "Each row is a prime whose lane transits the strait." },
  { id: "risk-shipments", title: "High-risk shipments (P0353)", stakes: "Flagged lanes worth an audit before they sail.", graph: "logistics_risk", kind: "risk:P0353", howToRead: "Shipment sample. Full count in the header." },
];

function rowKey(r: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]));
}

async function sha256Hex(input: string): Promise<string> {
  const b = await crypto.subtle.digest("sha256", new TextEncoder().encode(input));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export default function GraphPanel({ compact }: { compact?: boolean }) {
  const [health, setHealth] = useState<{ ok: boolean } | null>(null);
  const [scenarios, setScenarios] = useState<GraphScenario[]>(FALLBACKS);
  const [fromCat, setFromCat] = useState(false);
  const [activeId, setActiveId] = useState(FALLBACKS[0].id);
  const [rows, setRows] = useState<GraphRows | null>(null);
  const [commits, setCommits] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [simNote, setSimNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guided, setGuided] = useState(true);
  const [step, setStep] = useState(1);
  const [beforeCommit, setBeforeCommit] = useState("");
  const [afterCommit, setAfterCommit] = useState("");
  const [diff, setDiff] = useState<GraphDiff | null>(null);
  const [diffNote, setDiffNote] = useState<string | null>(null);
  const [witness, setWitness] = useState<{ hash: string; prev: string; at: string; local?: boolean } | null>(null);
  const [bench, setBench] = useState<Record<string, number>>({});

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const cypher = useMemo(() => buildCypher(active.kind), [active]);

  useEffect(() => {
    let off = false;
    api.graphHealth().then((h) => { if (!off) setHealth({ ok: h.ok }); }).catch(() => { if (!off) setHealth({ ok: false }); });
    api.graphScenarios().then((list) => {
      if (!off && Array.isArray(list) && list.length > 0) {
        setScenarios(list.slice(0, 5)); setActiveId(list[0].id); setFromCat(true);
      }
    }).catch(() => { /* catalogue lands later — fallback stands */ });
    api.graphBench().then((b) => {
      if (!off && Array.isArray(b)) {
        const m: Record<string, number> = {};
        for (const r of b) m[r.id] = r.ms;
        setBench(m);
      }
    }).catch(() => { /* bench optional */ });
    return () => { off = true; };
  }, []);

  const runScenario = useCallback(async (s: GraphScenario) => {
    setLoading(true); setError(null); setDiff(null); setDiffNote(null);
    setActiveId(s.id); if (guided) setStep(1);
    const q = { graph: s.graph, cypher: buildCypher(s.kind) };
    try {
      setRows(fromCat ? await api.runScenario(s.id) : await api.graphQuery(q));
    } catch {
      try { setRows(await api.graphQuery(q)); setFromCat(false); }
      catch (e) { setError(String((e as Error)?.message ?? e)); }
    } finally { setLoading(false); }
  }, [fromCat, guided]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.graphHistory(active.graph);
      const list = data.rows.map((row) => String(row.commit ?? "")).filter(Boolean);
      setCommits(list);
      if (list.length >= 2) {
        setBeforeCommit((v) => v || list[list.length - 1]);
        setAfterCommit((v) => v || list[0]);
      }
      if (guided) setStep(2);
    } catch { /* history is garnish */ }
  }, [active.graph, guided]);

  const replay = useCallback(async (commit: string) => {
    setLoading(true); setError(null);
    try {
      setRows(await api.graphQuery({ graph: active.graph, cypher, commit }));
      if (guided) setStep(2);
    } catch (e) { setError(String((e as Error)?.message ?? e)); }
    finally { setLoading(false); }
  }, [active.graph, cypher, guided]);

  const runDiff = useCallback(async () => {
    setLoading(true); setError(null); setDiffNote(null);
    try {
      setDiff(await api.graphDiff({
        graph: active.graph, cypher,
        beforeCommit: beforeCommit || undefined, afterCommit: afterCommit || undefined,
      }));
    } catch {
      try {
        const [b, a] = await Promise.all([
          api.graphQuery({ graph: active.graph, cypher, commit: beforeCommit || undefined }),
          api.graphQuery({ graph: active.graph, cypher, commit: afterCommit || undefined }),
        ]);
        const bs = new Set(b.rows.map(rowKey));
        const as = new Set(a.rows.map(rowKey));
        setDiff({
          beforeCount: b.count, afterCount: a.count,
          addedSample: a.rows.filter((r) => !bs.has(rowKey(r))).slice(0, 5),
          removedSample: b.rows.filter((r) => !as.has(rowKey(r))).slice(0, 5),
        });
        setDiffNote("client-side diff (agent /diff not ready)");
      } catch (e) { setError(String((e as Error)?.message ?? e)); }
    } finally { setLoading(false); }
  }, [active.graph, afterCommit, beforeCommit, cypher]);

  const simulate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.graphSimulate({
        graph: active.graph,
        writes: ["MATCH (p:Platform {archetype:'Loitering munition'}) SET p.sim_closed = true"],
        readCypher: "MATCH (p:Platform {archetype:'Loitering munition'}) WHERE p.sim_closed = true RETURN p.name",
      });
      setSimNote(`simulate: ${data.beforeCount} → ${data.afterCount} flagged in branch (abandoned, graph unchanged)`);
      if (guided) setStep(3);
    } catch (e) { setError(String((e as Error)?.message ?? e)); }
    finally { setLoading(false); }
  }, [active.graph, guided]);

  const exportWitness = useCallback(async () => {
    setError(null);
    try {
      setWitness(await api.graphWitness({ rows: rows?.rows ?? [], graph: active.graph, scenario: active.id }));
    } catch {
      try {
        const at = new Date().toISOString();
        const hash = await sha256Hex(JSON.stringify({ rows: rows?.rows ?? [], at }));
        setWitness({ hash, prev: "local-only", at, local: true });
      } catch (e) { setError(String((e as Error)?.message ?? e)); }
    }
  }, [active.graph, active.id, rows]);

  const exposure = useMemo(() => {
    if (!rows) return null;
    const costs = rows.rows.map((r) => Number(r.unit_cost ?? r.unitCost ?? NaN)).filter((n) => Number.isFinite(n));
    return costs.length ? costs.reduce((a, b) => a + b, 0) : null;
  }, [rows]);

  if (health && !health.ok) {
    return (
      <div className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Defense graph</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>Graph offline — Postgres evidence stands. Start TuringDB + sidecar.</p>
      </div>
    );
  }

  const cap = compact ? 4 : 6;
  const eur = (n: number) => n.toLocaleString("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Defense graph · blast radius</p>
        <label className="mono flex cursor-pointer items-center gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
          <input type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} aria-label="Guided mode" />
          guided: 1 Blast → 2 Replay → 3 Simulate
        </label>
      </div>
      <div className="mono mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-live="polite">
        <span style={{ color: "var(--text-strong)" }}>{rows ? `${rows.count} affected` : "no run yet"}</span>
        {rows && <span style={{ color: "var(--text-body)" }}>{rows.ms}ms</span>}
        {exposure != null && <span style={{ color: "var(--text-body)" }}>est. exposure {eur(exposure)}</span>}
      </div>
      {guided && (
        <ol className="mono mt-2 flex flex-wrap gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
          {[1, 2, 3].map((n) => (
            <li key={n} className="rounded border px-2 py-1"
              style={{ borderColor: step === n ? "var(--cursor)" : "var(--rule)", color: step === n ? "var(--text-strong)" : "var(--text-faint)" }}>
              {n === 1 ? "1 Blast" : n === 2 ? "2 Replay" : "3 Simulate + Diff"}
            </li>
          ))}
        </ol>
      )}
      <ul className="mt-2 grid gap-2">
        {scenarios.map((s) => (
          <li key={s.id} className="rounded border p-2"
            style={{ borderColor: s.id === activeId ? "var(--cursor)" : "var(--rule)", background: "var(--page)" }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>{s.title}
                  <span className="mono ml-2 cursor-help text-xs" style={{ color: "var(--text-faint)" }} title={s.howToRead} aria-label={`How to read: ${s.howToRead}`}>[?]</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-body)" }}>{s.stakes}</p>
                <p className="mono mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{s.graph}{bench[s.id] != null ? ` · ${bench[s.id]}ms bench` : ""}</p>
              </div>
              <button onClick={() => void runScenario(s)} disabled={loading}
                className="mono shrink-0 rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
                style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
                {loading && s.id === activeId ? "running…" : "Run"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!fromCat && <p className="mono mt-1 text-xs" style={{ color: "var(--text-faint)" }}>catalogue fallback — agent /scenarios not ready</p>}
      <p className="mono mt-2 text-xs" style={{ color: "var(--text-faint)" }}>{cypher}</p>
      {error && <p className="mt-2 text-sm" style={{ color: "oklch(64% 0.21 25)" }}>{error}</p>}
      {rows && (
        <div className="mt-2">
          <ul className="mono mt-1 max-h-36 space-y-1 overflow-auto text-xs leading-5">
            {rows.rows.slice(0, cap).map((r, i) => (
              <li key={i} style={{ color: "var(--text-body)" }}>{Object.values(r).join(" ← ")}</li>
            ))}
          </ul>
          {rows.count > cap && <p className="mono text-xs" style={{ color: "var(--text-faint)" }}>… +{rows.count - cap} more</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => void loadHistory()} className="mono rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
              2 · Load replay commits
            </button>
            <button onClick={() => void exportWitness()} className="mono rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
              Export witness-pack
            </button>
          </div>
        </div>
      )}
      {commits.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="mono text-xs" style={{ color: "var(--text-faint)" }}>replay:</span>
          {commits.slice(0, 4).map((c) => (
            <button key={c} onClick={() => void replay(c)} className="mono rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--rule)", color: "var(--cursor)" }}>
              {c.replace("(HEAD)", "").slice(0, 8) || "HEAD"}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 rounded border p-2" style={{ borderColor: "var(--rule)", background: "var(--page)" }}>
        <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>3 · Simulate + diff</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <input value={beforeCommit} onChange={(e) => setBeforeCommit(e.target.value)} placeholder="before commit" aria-label="Before commit"
            className="mono rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--rule)", background: "var(--panel)", color: "var(--text-strong)" }} />
          <input value={afterCommit} onChange={(e) => setAfterCommit(e.target.value)} placeholder="after commit" aria-label="After commit"
            className="mono rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--rule)", background: "var(--panel)", color: "var(--text-strong)" }} />
          <button onClick={() => void runDiff()} disabled={loading} className="mono rounded border px-2 py-1 text-xs disabled:opacity-50" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>Diff</button>
          <button onClick={() => void simulate()} disabled={loading} className="mono rounded border px-2 py-1 text-xs disabled:opacity-50" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>Simulate branch</button>
        </div>
        {simNote && <p className="mono mt-1 text-xs" style={{ color: "var(--cursor)" }}>{simNote}</p>}
        {diff && (
          <div className="mono mt-1 text-xs" style={{ color: "var(--text-body)" }}>
            <p>{diff.beforeCount} → {diff.afterCount}{diffNote ? ` · ${diffNote}` : ""}</p>
            <p className="mt-1" style={{ color: "var(--text-faint)" }}>added ({diff.addedSample.length} sampled):</p>
            <ul className="space-y-0.5">{diff.addedSample.map((r, i) => <li key={`a-${i}`}>+ {Object.values(r).join(" ← ")}</li>)}</ul>
            <p className="mt-1" style={{ color: "var(--text-faint)" }}>removed ({diff.removedSample.length} sampled):</p>
            <ul className="space-y-0.5">{diff.removedSample.map((r, i) => <li key={`r-${i}`}>− {Object.values(r).join(" ← ")}</li>)}</ul>
          </div>
        )}
      </div>
      {witness && (
        <div className="mono mt-2 text-xs" style={{ color: "var(--text-body)" }}>
          <p>witness {witness.hash.slice(0, 16)}… · prev {String(witness.prev).slice(0, 12)} · {witness.at}{witness.local ? " · local-only (agent /witness not ready)" : ""}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <a className="underline" style={{ color: "var(--cursor)" }}
              href={`data:application/json,${encodeURIComponent(JSON.stringify({ hash: witness.hash, prev: witness.prev, at: witness.at, rows: rows?.rows ?? [] }, null, 2))}`}
              download={`witness-${active.id}.json`}>Download JSON</a>
            {!witness.local && (
              <>
                <a className="underline" style={{ color: "var(--cursor)" }} href={`/witness/${witness.hash}`} target="_blank" rel="noreferrer">Open share link →</a>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/witness/${witness.hash}`;
                    void (navigator.clipboard?.writeText(url).then(() => setDiffNote(`link copied: ${url}`)).catch(() => setDiffNote(url)));
                  }}
                  className="underline" style={{ color: "var(--cursor)" }}
                >
                  Copy link
                </button>
              </>
            )}
          </div>
          <p className="mt-1" style={{ color: "var(--text-faint)" }}>Every scan is a user you didn&apos;t pitch — print the QR at your desk.</p>
        </div>
      )}
    </div>
  );
}
