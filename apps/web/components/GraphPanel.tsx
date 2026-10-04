"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, isAbortError, type DefenseBrief, type GraphDiff, type GraphRun, type GraphScenario, type GraphWitness } from "../lib/api";
import type { DefenseSession } from "../lib/api";
import DefenseBriefPanel from "./DefenseBriefPanel";
import InvestigationAtlas from "./InvestigationAtlas";
import { diffSummary } from "../lib/atlas";
import { createOperationGuard } from "../lib/operations";
import { catalogueLabel, type CatalogueState } from "../lib/exposureSummary";
import { card, control } from "../lib/ui";
import Inspector from "./Inspector";

const ANONYMOUS: DefenseSession = { configured: false, authenticated: false, roles: [] };

export interface InvestigationPresentation {
  run: GraphRun | null;
  busy: boolean;
  error: string | null;
  scenario: GraphScenario | undefined;
  catalogue: CatalogueState;
  health: boolean | null;
  session: DefenseSession;
  brief: DefenseBrief | null;
  analyze: () => void;
  retry: () => void;
  onBriefChange: (brief: DefenseBrief | null) => void;
}

export default function GraphPanel({ initialSession, initialScenarioId, presentation }: {
  initialSession?: DefenseSession;
  initialScenarioId?: string;
  presentation?: (state: InvestigationPresentation) => ReactNode;
}) {
  const [scenarios, setScenarios] = useState<GraphScenario[]>([]);
  const [activeId, setActiveId] = useState("");
  const [rows, setRows] = useState<GraphRun | null>(null);
  const [health, setHealth] = useState<boolean | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueState>("loading");
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const guard = useRef(createOperationGuard()).current;
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
  const [brief, setBrief] = useState<DefenseBrief | null>(null);
  const active = scenarios.find((scenario) => scenario.id === activeId);

  useEffect(() => {
    const ctl = new AbortController();
    setHealth(null);
    setCatalogue("loading");
    setCatalogueError(null);
    setError(null);
    api.graphHealth(ctl.signal).then((result) => { if (!ctl.signal.aborted) setHealth(result.ok); }).catch((e) => {
      if (!ctl.signal.aborted && !isAbortError(e)) setHealth(false);
    });
    api.defenseSession(ctl.signal).then((result) => { if (!ctl.signal.aborted) setSession(result); }).catch(() => {
      if (!ctl.signal.aborted) setSession({ configured: false, authenticated: false, roles: [], error: "SSO session could not be verified. Review and action updates are disabled." });
    });
    api.graphScenarios(ctl.signal).then((list) => {
      if (ctl.signal.aborted) return;
      setScenarios(list);
      setCatalogue(list.length ? "ready" : "empty");
      const requested = new URLSearchParams(window.location.search).get("scenario");
      setActiveId((previous) => list.some((item) => item.id === previous) ? previous
        : list.find((item) => item.id === initialScenarioId)?.id
        ?? list.find((item) => item.id === requested)?.id
        ?? list.find((item) => item.id === "gallium-exposure")?.id
        ?? list[0]?.id ?? "");
    }).catch((e) => {
      if (!ctl.signal.aborted && !isAbortError(e)) {
        setCatalogue("unavailable");
        setCatalogueError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => ctl.abort();
  }, [retry]);

  useEffect(() => {
    guard.mount();
    return () => guard.unmount();
  }, [guard]);

  const execute = useCallback(async (work: (generation: number) => Promise<void>, generation?: number) => {
    const my = generation ?? guard.begin();
    if (!guard.isCurrent(my)) return;
    setBusy(true);
    setError(null);
    try { await work(my); }
    catch (e) { if (guard.isCurrent(my)) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (guard.isCurrent(my)) setBusy(false); }
  }, [guard]);

  const run = (commit?: string) => {
    if (!active) return;
    const scenarioId = active.id;
    const my = guard.begin();
    setCaptureBusy(true);
    void execute(async (gen) => {
      const result = await api.runScenario(scenarioId, commit ? { commit } : {});
      if (!guard.isCurrent(gen)) return;
      setRows(result);
      setWitness(null);
      setCopyNote(null);
      setDiff(null);
      setSimNote(null);
      if (!presentation) window.history.replaceState(null, "", `/defense?scenario=${encodeURIComponent(scenarioId)}`);
    }, my).finally(() => { if (guard.isCurrent(my)) setCaptureBusy(false); });
  };

  const select = (id: string) => {
    guard.invalidate();
    setBusy(false);
    setCaptureBusy(false);
    setActiveId(id);
    setRows(null);
    setBrief(null);
    setWitness(null);
    setCopyNote(null);
    setCommits([]);
    setBeforeCommit("");
    setAfterCommit("");
    setDiff(null);
    setSimNote(null);
    setError(null);
    if (!presentation) window.history.replaceState(null, "", `/defense?scenario=${encodeURIComponent(id)}`);
  };

  const onBriefChange = useCallback((next: DefenseBrief | null) => { setBrief(next); }, []);
  const focusBrief = useCallback(() => {
    const el = document.getElementById("investigation-brief");
    el?.scrollIntoView({ behavior: "auto", block: "start" });
    const target = el?.querySelector<HTMLElement>("button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), textarea:not([disabled])");
    (target ?? el)?.focus({ preventScroll: true });
  }, []);

  const history = () => {
    if (!active) return;
    const graph = active.graph;
    void execute(async (gen) => {
      const result = await api.graphHistory(graph);
      if (!guard.isCurrent(gen)) return;
      const list = result.rows.map((row) => String(row.commit ?? "").replace(/\(HEAD\)$/, "")).filter(Boolean);
      setCommits(list);
      setBeforeCommit(list.at(-1) ?? "");
      setAfterCommit(list[0] ?? "");
    });
  };

  if (presentation) {
    return <>{presentation({
      run: rows,
      busy: captureBusy,
      error,
      scenario: active,
      catalogue,
      health,
      session,
      brief,
      analyze: () => run(),
      retry: () => setRetry((value) => value + 1),
      onBriefChange,
    })}</>;
  }

  return (
    <section className="space-y-5" aria-label="Defence exposure workspace">
      {session.authenticated && <a className="inspect-trigger" href="/defense">Saved cases &amp; verification work →</a>}
      <div id="investigation-question" tabIndex={-1} className="rounded-lg border p-3 sm:p-4" style={card}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm">
            Exposure question
            <select value={activeId} disabled={busy || catalogue !== "ready"} onChange={(e) => select(e.target.value)}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" style={{ ...card, color: "var(--text-strong)" }}>
              {!scenarios.length && <option value="">{catalogueLabel(catalogue)}</option>}
              {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title}</option>)}
            </select>
          </label>
          <button className={control} style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
            disabled={busy || catalogue !== "ready" || !active || health !== true} onClick={() => run()}>
            {captureBusy ? "Working…" : "Analyze exposure"}
          </button>
        </div>
        {active && <p className="context-note mt-2 text-xs">{active.stakes}</p>}
        {(catalogue === "unavailable" || catalogue === "empty" || health === false) && (
          <div role="status" className="mt-4 space-y-3 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
            <p className="text-sm">{catalogue === "unavailable"
              ? "Exposure questions are unavailable. Reconnect to the analysis service to continue."
              : catalogue === "empty" ? "No exposure questions are configured. Contact your deployment administrator."
              : "The analysis service is unavailable. Reconnect before running another analysis."}
              {rows && " Your previously captured evidence remains available below."}</p>
            <button className={control} style={card} disabled={busy || catalogue === "loading"} onClick={() => setRetry((value) => value + 1)}>Retry connection</button>
            {catalogueError && <Inspector label="Inspect connection diagnostics" title="Connection diagnostics"><p className="break-all">{catalogueError}</p></Inspector>}
          </div>
        )}
        {catalogue === "loading" && <p role="status" className="mt-3 text-sm">Connecting to the analysis service…</p>}
        {error && <div role="alert" className="mt-3 text-sm" style={{ color: "oklch(80% 0.06 25)" }}>
          <p>The operation could not be completed. Captured evidence has not been replaced. Retry the operation when the service is available.</p>
          <Inspector label="Inspect operation diagnostics" title="Operation diagnostics"><p className="break-all">{error}</p></Inspector>
        </div>}
      </div>

      <InvestigationAtlas
        run={rows}
        busy={captureBusy}
        scenario={active}
        session={session}
        brief={brief}
        onPrepareVerification={focusBrief}
        onRequestChain={busy ? undefined : () => select("gallium-chain")}
        versionsPanel={
          <div>
            <div className="flex flex-wrap gap-2">
              <button className={control} style={card} disabled={busy || !active || health !== true} onClick={history}>Load graph versions</button>
              {commits.map((commit) => <button key={commit} className={control} style={card} disabled={busy} onClick={() => run(commit)}>Replay {commit.slice(0, 8)}</button>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <input className="mono min-w-0 max-w-full rounded-lg border px-3 py-2 text-xs" style={card} aria-label="Before commit" placeholder="Before commit" value={beforeCommit} onChange={(e) => setBeforeCommit(e.target.value)} />
              <input className="mono min-w-0 max-w-full rounded-lg border px-3 py-2 text-xs" style={card} aria-label="After commit" placeholder="After commit" value={afterCommit} onChange={(e) => setAfterCommit(e.target.value)} />
              <button className={control} style={card} disabled={busy || !active || !beforeCommit || !afterCommit} onClick={() => {
                if (!active) return;
                const request = { graph: active.graph, cypher: active.cypher, beforeCommit, afterCommit };
                void execute(async (gen) => {
                  const result = await api.graphDiff(request);
                  if (guard.isCurrent(gen)) setDiff(result);
                });
              }}>Compare versions</button>
            </div>
            {diff && (() => {
              const summary = diffSummary(diff);
              return <div className="mt-3 text-sm" role="status">
                <p>{summary.counts}</p>
                <p>{summary.added} · {summary.removed}</p>
                <pre className="mono mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs" aria-label="Returned difference samples">{JSON.stringify({ added: diff.addedSample, removed: diff.removedSample }, null, 2)}</pre>
                <p className="hint mt-2">{summary.note}</p>
              </div>;
            })()}
            {!commits.length && <p className="hint mt-3">Load graph versions to replay the reviewed query against a pinned revision.</p>}
          </div>
        }
      />

      <div id="investigation-brief" tabIndex={-1}>
        <DefenseBriefPanel key={rows?.runId ?? activeId} run={rows} session={session} onBriefChange={onBriefChange} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <section className="min-w-0 card p-4 sm:p-5" aria-label="Captured evidence">
          <div className="receipt-strip"><div><p className="eyebrow">Captured evidence</p><p className="readout mt-3">{rows ? rows.rows.length : "—"} <span className="readout-label">rows</span></p></div>
          <Inspector label="Inspect captured rows" title="Captured query evidence" disabled={!rows}>
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
                <table className="captured-table w-full border-collapse text-left text-sm">
                  <thead><tr>{rows.columns.map((column) => <th key={column} className="border-b px-2 py-2 font-medium" style={{ borderColor: "var(--rule)", color: "var(--text-strong)" }}>{column}</th>)}</tr></thead>
                  <tbody>{rows.rows.slice(0, 50).map((row, index) => <tr key={index}>{rows.columns.map((column) => <td key={column} className="border-b px-2 py-2 align-top" style={{ borderColor: "var(--rule)" }}>{String(row[column] ?? "—")}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <p className="hint mt-2">Scroll the table to inspect additional columns.</p>
              {rows.count > 50 && <p className="mt-2 text-xs">Showing 50 rows; the export retains the captured query result.</p>}
            </>
          )}
          </Inspector></div>
          <p className="hint mt-4">Stored rows, not a fresh query. A bounded capture is not total programme exposure.</p>
        </section>

        <aside className="rounded-lg border p-4 sm:p-5" style={card} aria-label="Evidence snapshot">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Evidence snapshot</p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-strong)" }}>Unapproved analysis</h2>
          <div className="record-status mt-3"><span>Graph capture</span><span>Not an intervention approval</span></div>
          <ul className="measure-list mt-3">{["Inventory", "Substitutes", "Timing", "Missing dependencies"].map((check) => <li key={check}>{check}</li>)}</ul>
          {rows && <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            {rows.graphCommit ? `Pinned graph commit: ${rows.graphCommit}` : "Graph HEAD captured without a pinned commit. This is not yet a reproducible versioned decision record."}
          </p>}
          <button className={`${control} mt-4`} style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
            disabled={busy || !rows} onClick={() => void execute(async (gen) => {
              if (!rows) return;
              const result = await api.graphWitness({ runId: rows.runId });
              if (guard.isCurrent(gen)) setWitness(result);
            })}>Export evidence snapshot</button>
          {witness && (
            <div className="mt-4 space-y-3 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
              <p className="mono break-all text-xs" style={{ color: "var(--text-faint)" }}>hash {witness.hash}</p>
              <div className="flex flex-wrap gap-3 text-sm" style={{ color: "var(--cursor)" }}>
                <a className="underline" href={`/witness/${witness.hash}`}>Open share link</a>
                <a className="underline" href={`data:application/json,${encodeURIComponent(JSON.stringify(witness, null, 2))}`} download={`witness-${witness.pack.scenarioId}.json`}>Download JSON</a>
                <button className="underline" onClick={() => void execute(async (gen) => {
                  const url = `${window.location.origin}/witness/${witness.hash}`;
                  if (navigator.clipboard) {
                    await navigator.clipboard.writeText(url);
                    if (guard.isCurrent(gen)) setCopyNote("Link copied");
                  } else if (guard.isCurrent(gen)) setCopyNote(url);
                })}>Copy link</button>
              </div>
              {copyNote && <p role="status" className="break-all text-xs">{copyNote}</p>}
              <p className="text-xs leading-relaxed">Hash linkage is not an authenticated signature. Public demo links must not contain customer-sensitive data.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="receipt-strip"><p className="hint">Stay with the captured evidence, or inspect its mechanics.</p><Inspector label="Open query & version workbench" title="Query, replay and simulation">
        {active && <pre className="mono mt-4 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>{active.cypher}</pre>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={control} style={card} disabled={busy || active?.graph !== "supply_chain_deep" || health !== true || !session.authenticated || !session.roles.some((role) => role === "analyst" || role === "reviewer")} onClick={() => void execute(async (gen) => {
            const result = await api.graphSimulate({
              graph: "supply_chain_deep",
              writes: ["MATCH (p:Platform {archetype:'Loitering munition'}) SET p.sim_closed = true"],
              readCypher: "MATCH (p:Platform {archetype:'Loitering munition'}) WHERE p.sim_closed = true RETURN p.name",
            });
            if (guard.isCurrent(gen)) setSimNote(`Temporary marker demonstration: ${result.beforeCount} → ${result.afterCount} rows. Change left unsubmitted; this does not model lost production.`);
          })}>Demo temporary branch</button>
        </div>
        {simNote && <p className="mt-3 text-sm">{simNote}</p>}
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>Catalogue-only, pinned reads use isolated graph clients. Simulation requires SSO and cannot submit changes. Daemon-side abandoned-change reclamation and independent operational validation remain outstanding.</p>
      </Inspector></div>
    </section>
  );
}
