"use client";

import { useCallback, useEffect, useState } from "react";
import { api, isAbortError, type GraphDiff, type GraphRun, type GraphScenario, type GraphWitness } from "../lib/api";
import type { DefenseSession } from "../lib/api";
import DefenseBriefPanel from "./DefenseBriefPanel";

const card = { borderColor: "var(--rule)", background: "var(--panel)" } as const;
const control = "coarse-target rounded-lg border px-3 py-2 text-sm disabled:opacity-50";
const ANONYMOUS: DefenseSession = { configured: false, authenticated: false, roles: [] };

export default function GraphPanel({ initialSession }: { initialSession?: DefenseSession }) {
  const [scenarios, setScenarios] = useState<GraphScenario[]>([]);
  const [activeId, setActiveId] = useState("");
  const [rows, setRows] = useState<GraphRun | null>(null);
  const [health, setHealth] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<string[]>([]);
  const [beforeCommit, setBeforeCommit] = useState("");
  const [afterCommit, setAfterCommit] = useState("");
  const [diff, setDiff] = useState<GraphDiff | null>(null);
  const [simNote, setSimNote] = useState<string | null>(null);
  const [witness, setWitness] = useState<GraphWitness | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // Seeded from the server so the first paint already reflects the session
  // rather than flashing a signed-out state before hydration resolves.
  const [session, setSession] = useState<DefenseSession>(initialSession ?? ANONYMOUS);
  const active = scenarios.find((scenario) => scenario.id === activeId);

  useEffect(() => {
    const ctl = new AbortController();
    setHealth(null);
    setError(null);
    api.graphHealth(ctl.signal).then((result) => setHealth(result.ok)).catch((e) => {
      if (!isAbortError(e)) setHealth(false);
    });
    api.defenseSession(ctl.signal).then((result) => { if (!ctl.signal.aborted) setSession(result); }).catch(() => {
      if (!ctl.signal.aborted) setSession({ configured: false, authenticated: false, roles: [], error: "SSO session could not be verified. Review and action updates are disabled." });
    });
    api.graphScenarios(ctl.signal).then((list) => {
      if (ctl.signal.aborted) return;
      setScenarios(list);
      const requested = new URLSearchParams(window.location.search).get("scenario");
      setActiveId((previous) => list.some((item) => item.id === previous) ? previous
        : list.find((item) => item.id === requested)?.id
        ?? list.find((item) => item.id === "gallium-exposure")?.id
        ?? list[0]?.id ?? "");
    }).catch((e) => {
      if (!isAbortError(e)) setError(e instanceof Error ? e.message : String(e));
    });
    return () => ctl.abort();
  }, [retry]);

  const execute = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await operation(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }, []);

  const run = (commit?: string) => {
    if (!active) return;
    void execute(async () => {
      const result = await api.runScenario(active.id, commit ? { commit } : {});
      setRows(result);
      setWitness(null);
      setCopyNote(null);
      setDiff(null);
      setSimNote(null);
      window.history.replaceState(null, "", `/defense?scenario=${encodeURIComponent(active.id)}`);
    });
  };

  const select = (id: string) => {
    setActiveId(id);
    setRows(null);
    setWitness(null);
    setCopyNote(null);
    setCommits([]);
    setBeforeCommit("");
    setAfterCommit("");
    setDiff(null);
    setSimNote(null);
    setError(null);
    window.history.replaceState(null, "", `/defense?scenario=${encodeURIComponent(id)}`);
  };

  const history = () => {
    if (!active) return;
    void execute(async () => {
      const result = await api.graphHistory(active.graph);
      const list = result.rows.map((row) => String(row.commit ?? "").replace(/\(HEAD\)$/, "")).filter(Boolean);
      setCommits(list);
      setBeforeCommit(list.at(-1) ?? "");
      setAfterCommit(list[0] ?? "");
    });
  };

  return (
    <section className="space-y-5" aria-label="Defence exposure workspace">
      <div className="rounded-lg border p-4 sm:p-5" style={card}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="min-w-0 flex-1 text-sm">
            Exposure question
            <select value={activeId} disabled={busy || !scenarios.length} onChange={(e) => select(e.target.value)}
              className="mt-2 block w-full rounded-lg border px-3 py-3 text-sm" style={{ ...card, color: "var(--text-strong)" }}>
              {!scenarios.length && <option value="">Loading questions…</option>}
              {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title}</option>)}
            </select>
          </label>
          <button className={control} style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
            disabled={busy || !active || health !== true} onClick={() => run()}>
            {busy ? "Working…" : "Analyze exposure"}
          </button>
        </div>
        {active && <p className="mt-3 max-w-3xl text-sm leading-relaxed">{active.stakes}</p>}
        {health === false && (
          <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
            <p className="text-sm">Graph unavailable or sidecar upgrade required. No results have been fabricated. Start TuringDB and the request-isolated sidecar, then retry.</p>
            <button className={control} style={card} disabled={busy} onClick={() => setRetry((value) => value + 1)}>Retry connection</button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm" style={{ color: "oklch(80% 0.06 25)" }}>{error}</p>}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <section className="min-w-0 rounded-lg border p-4 sm:p-5" style={card} aria-label="Exposure results" aria-live="polite">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Exposure, not confirmed stoppage</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>
            {rows ? `${rows.count} query result${rows.count === 1 ? "" : "s"}` : "Start with one dependency question."}
          </h2>
          <p className="mt-2 text-sm leading-relaxed">
            {rows ? active?.howToRead : "Choose a question and analyze the graph. Then inspect the relationships and export an evidence snapshot for review."}
          </p>
          {rows && (
            <>
              <p className="mono mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
                retrieved {new Date(rows.capturedAt).toLocaleString()} · {rows.ms}ms query
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
                Query limits may truncate results. Row count is not the total number of affected programmes.
              </p>
              <div className="mt-4 max-h-80 overflow-auto sm:max-h-[480px]" tabIndex={0} role="region" aria-label="Captured query rows">
                <table className="w-full border-collapse text-left text-sm">
                  <thead><tr>{rows.columns.map((column) => <th key={column} className="border-b px-2 py-2 font-medium" style={{ borderColor: "var(--rule)", color: "var(--text-strong)" }}>{column}</th>)}</tr></thead>
                  <tbody>{rows.rows.slice(0, 50).map((row, index) => <tr key={index}>{rows.columns.map((column) => <td key={column} className="border-b px-2 py-2 align-top" style={{ borderColor: "var(--rule)" }}>{String(row[column] ?? "—")}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {rows.count > 50 && <p className="mt-2 text-xs">Showing 50 rows; the export retains the captured query result.</p>}
            </>
          )}
        </section>

        <aside className="rounded-lg border p-4 sm:p-5" style={card} aria-label="Evidence snapshot">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Evidence snapshot</p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-strong)" }}>Unapproved analysis</h2>
          <p className="mt-2 text-sm leading-relaxed">
            This records a server-captured graph result, not an authorized intervention.
            Confirm inventory, substitutes, timing, and missing dependencies before making a programme decision.
          </p>
          {rows && <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            {rows.graphCommit ? `Pinned graph commit: ${rows.graphCommit}` : "Graph HEAD captured without a pinned commit. This is not yet a reproducible versioned decision record."}
          </p>}
          <button className={`${control} mt-4`} style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
            disabled={busy || !rows} onClick={() => void execute(async () => {
              if (rows) setWitness(await api.graphWitness({ runId: rows.runId }));
            })}>Export evidence snapshot</button>
          {witness && (
            <div className="mt-4 space-y-3 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
              <p className="mono break-all text-xs" style={{ color: "var(--text-faint)" }}>hash {witness.hash}</p>
              <div className="flex flex-wrap gap-3 text-sm" style={{ color: "var(--cursor)" }}>
                <a className="underline" href={`/witness/${witness.hash}`}>Open share link</a>
                <a className="underline" href={`data:application/json,${encodeURIComponent(JSON.stringify(witness, null, 2))}`} download={`witness-${witness.pack.scenarioId}.json`}>Download JSON</a>
                <button className="underline" onClick={() => void execute(async () => {
                  const url = `${window.location.origin}/witness/${witness.hash}`;
                  if (navigator.clipboard) {
                    await navigator.clipboard.writeText(url);
                    setCopyNote("Link copied");
                  } else setCopyNote(url);
                })}>Copy link</button>
              </div>
              {copyNote && <p role="status" className="break-all text-xs">{copyNote}</p>}
              <p className="text-xs leading-relaxed">Hash linkage is not an authenticated signature. Public demo links must not contain customer-sensitive data.</p>
            </div>
          )}
        </aside>
      </div>

      <DefenseBriefPanel key={rows?.runId ?? activeId} run={rows} session={session} />

      <details className="rounded-lg border p-4 sm:p-5" style={card}>
        <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--text-strong)" }}>Advanced: query, replay, and simulation</summary>
        {active && <pre className="mono mt-4 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>{active.cypher}</pre>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={control} style={card} disabled={busy || !active || health !== true} onClick={history}>Load graph versions</button>
          {commits.map((commit) => <button key={commit} className={control} style={card} disabled={busy} onClick={() => run(commit)}>Replay {commit.slice(0, 8)}</button>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input className="mono min-w-0 max-w-full rounded-lg border px-3 py-2 text-xs" style={card} aria-label="Before commit" placeholder="Before commit" value={beforeCommit} onChange={(e) => setBeforeCommit(e.target.value)} />
          <input className="mono min-w-0 max-w-full rounded-lg border px-3 py-2 text-xs" style={card} aria-label="After commit" placeholder="After commit" value={afterCommit} onChange={(e) => setAfterCommit(e.target.value)} />
          <button className={control} style={card} disabled={busy || !active || !beforeCommit || !afterCommit} onClick={() => void execute(async () => {
            if (active) setDiff(await api.graphDiff({ graph: active.graph, cypher: active.cypher, beforeCommit, afterCommit }));
          })}>Compare versions</button>
          <button className={control} style={card} disabled={busy || active?.graph !== "supply_chain_deep" || health !== true || !session.authenticated || !session.roles.some((role) => role === "analyst" || role === "reviewer")} onClick={() => void execute(async () => {
            const result = await api.graphSimulate({
              graph: "supply_chain_deep",
              writes: ["MATCH (p:Platform {archetype:'Loitering munition'}) SET p.sim_closed = true"],
              readCypher: "MATCH (p:Platform {archetype:'Loitering munition'}) WHERE p.sim_closed = true RETURN p.name",
            });
            setSimNote(`Temporary marker demonstration: ${result.beforeCount} → ${result.afterCount} rows. Change left unsubmitted; this does not model lost production.`);
          })}>Demo temporary branch</button>
        </div>
        {simNote && <p className="mt-3 text-sm">{simNote}</p>}
        {diff && <div className="mt-3 text-sm"><p>{diff.beforeCount} → {diff.afterCount} query rows</p><pre className="mono mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ added: diff.addedSample, removed: diff.removedSample }, null, 2)}</pre></div>}
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>Catalogue-only, pinned reads use isolated graph clients. Simulation requires SSO and cannot submit changes. Daemon-side abandoned-change reclamation and independent operational validation remain outstanding.</p>
      </details>
    </section>
  );
}
