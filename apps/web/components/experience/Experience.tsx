"use client";

import { useEffect, useMemo, useState } from "react";
import type { DefenseSession } from "../../lib/api";
import { briefStage } from "../../lib/briefStage";
import GraphPanel, { type InvestigationPresentation } from "../GraphPanel";
import DefenseBriefPanel from "../DefenseBriefPanel";
import EvidenceDrawer from "../EvidenceDrawer";
import Inspector from "../Inspector";
import { BOUNDED_FINAL_LABEL, CHAIN_STAGES, cellDisplay, chainEdges } from "../../lib/atlas";
import { canVisitPhase, stageLeaves, validateSelection, EXPERIENCE_PHASES, type ExperiencePhase, type ExperienceSelection } from "../../lib/experience";
import type { SpecimenStage } from "../../lib/experienceScene";
import ExperienceCanvas from "./ExperienceCanvas";
import styles from "./experience.module.css";

const MAX_SAMPLES = 10;

const PHASE_LABELS: Record<ExperiencePhase, string> = {
  arrival: "Arrival",
  question: "Question",
  dependency: "Dependency",
  evidence: "Evidence",
  handoff: "Handoff",
};

interface TerrainMeta {
  attributionUrl?: string;
  datasetUrl?: string;
  sourceUrl?: string;
  tile?: { zoom: number; x: number; y: number };
}

export default function Experience({ initialSession }: { initialSession?: DefenseSession }) {
  return (
    <GraphPanel
      initialSession={initialSession}
      initialScenarioId="gallium-chain"
      presentation={(state) => <ExperienceView {...state} />}
    />
  );
}

function ExperienceView({ run, busy, error, scenario, catalogue, health, session, brief, analyze, retry, onBriefChange }: InvestigationPresentation) {
  const [phase, setPhase] = useState<ExperiencePhase>("arrival");
  const [sample, setSample] = useState(0);
  const [selection, setSelection] = useState<ExperienceSelection | null>(null);
  const [skipAnim, setSkipAnim] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [terrainMeta, setTerrainMeta] = useState<TerrainMeta | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/experience/terrain/terrain-source.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((meta: TerrainMeta | null) => { if (alive) setTerrainMeta(meta); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setSample(0);
    setSelection(null);
    if (run) setPhase("dependency");
  }, [run?.runId]);

  useEffect(() => { setSelection(null); }, [sample]);

  const row = run && sample < run.rows.length ? run.rows[sample] : null;
  const edges = useMemo(() => (row ? chainEdges(row) : []), [row]);
  const valid = validateSelection(run, selection);
  const leaves = useMemo(() => stageLeaves(run, sample), [run, sample]);
  const specimen: SpecimenStage[] | null = useMemo(() => {
    if (!run || !row) return null;
    return CHAIN_STAGES.map(([label, column], index) => {
      const leaf = leaves.find((l) => l.index === index);
      return { column, label, value: leaf ? leaf.value : null };
    });
  }, [run, row, leaves]);

  const isChain = scenario?.id === "gallium-chain";
  const captureReady = isChain && health === true && catalogue === "ready" && !busy;
  const motionReduced = reduced || skipAnim;

  const select = (column: string) => {
    if (!run || !row || !run.columns.includes(column)) return;
    const value = row[column];
    if (value == null || (typeof value === "string" && !value.trim())) return;
    setSelection({ runId: run.runId, row: sample, column });
    setPhase("evidence");
  };

  const visit = (next: ExperiencePhase) => {
    if (canVisitPhase(next, run, valid)) setPhase(next);
  };

  const continueHref = `/defense?scenario=gallium-chain${brief ? `&brief=${encodeURIComponent(brief.id)}` : ""}`;

  return (
    <div className={styles.root} data-phase={phase}>
      <ExperienceCanvas
        phase={phase}
        specimen={specimen}
        highlight={valid?.column ?? null}
        onPick={select}
        reducedMotion={motionReduced}
      />

      <div className={styles.overlay}>
        <div>
          {phase === "arrival" && (
            <section className={styles.panel} aria-label="Experience introduction">
              <h1>Shelter for uncertain decisions.</h1>
              <p className={styles.lede}>Trace a dependency. Inspect the evidence. Own the next check.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={() => setPhase("question")}>
                  Explore the gallium case
                </button>
                <a className={styles.link} href="/defense">Open workspace</a>
              </div>
            </section>
          )}

          {phase === "question" && (
            <section className={styles.panel} aria-label="Exposure question">
              <h2>A small material. A long dependency.</h2>
              <p className={styles.lede}>{scenario?.title ?? "Explain an illustrative gallium dependency"}</p>
              {error && <p role="alert" className={styles.gaps}>{error} <button type="button" className={styles.link} onClick={retry}>Retry</button></p>}
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} disabled={!captureReady} onClick={analyze}>
                  {busy ? "Working…" : "Capture dependency"}
                </button>
                <button type="button" className={styles.btn} onClick={() => setPhase("arrival")}>Back</button>
                <label className={styles.link}>
                  <input type="checkbox" checked={skipAnim} onChange={(e) => setSkipAnim(e.target.checked)} /> Skip animation
                </label>
              </div>
              {health === false && <p className={styles.gaps}>Graph service unavailable — capture is disabled, no substitute data is shown. <button type="button" className={styles.link} onClick={retry}>Retry</button></p>}
              {catalogue === "loading" && <p className={styles.gaps}>Loading question catalogue…</p>}
              {(catalogue === "unavailable" || catalogue === "empty") && health !== false && (
                <p className={styles.gaps}>Question catalogue {catalogue === "empty" ? "is empty" : "unavailable"} — the gallium question cannot run. <button type="button" className={styles.link} onClick={retry}>Retry</button></p>
              )}
              {catalogue === "ready" && scenario && !isChain && (
                <p className={styles.gaps}>The gallium chain question is not in this catalogue; nothing else will run here.</p>
              )}
            </section>
          )}

          {phase === "dependency" && run && run.rows.length === 0 && (
            <section className={styles.panel} aria-label="Captured dependency">
              <h2>No chain rows captured</h2>
              <p className={styles.lede}>No chain rows captured; this does not establish no exposure.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} disabled={!captureReady} onClick={analyze}>Capture again</button>
                <button type="button" className={styles.btn} onClick={() => setPhase("question")}>Back to question</button>
              </div>
            </section>
          )}

          {phase === "dependency" && run && row && (
            <section className={styles.panel} aria-label="Captured dependency">
              <h2>Illustrative specimen · captured synthetic hierarchy</h2>
              <p className={styles.lede}>
                {CHAIN_STAGES.every(([, column]) => run.columns.includes(column))
                  ? "Eight returned stages — a field-book folio, leaf order encodes stage order only."
                  : "Returned hierarchy — some fields were not part of this capture. Leaf order encodes stage order only."}
              </p>
              <p className={styles.bound}>Captured {run.count} row{run.count === 1 ? "" : "s"} of a LIMIT 10 query.</p>
              {run.rows.length > 1 && (
                <label className={styles.link}>
                  Sample{" "}
                  <select value={sample} onChange={(e) => setSample(Number(e.target.value))}>
                    {run.rows.slice(0, MAX_SAMPLES).map((_, i) => (
                      <option key={i} value={i}>Captured row {i + 1}</option>
                    ))}
                  </select>
                </label>
              )}
              <ol className={styles.stageList}>
                {CHAIN_STAGES.map(([label, column], index) => {
                  const present = leaves.some((l) => l.index === index);
                  return (
                    <li key={column}>
                      <button
                        type="button"
                        className={styles.stage}
                        disabled={!present}
                        aria-pressed={valid?.column === column}
                        aria-label={`${label}: ${present ? cellDisplay(row, column) : "Not returned"}`}
                        onClick={() => select(column)}
                      >
                        <span className={styles.stageKey}>{label}</span>
                        <span>{present ? cellDisplay(row, column) : "Not returned"}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className={styles.bound}>
                {BOUNDED_FINAL_LABEL} · {edges.filter((e) => !e.bounded).length} direct containment edges returned.
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.btn} onClick={() => setPhase("question")}>Back to question</button>
                {busy && <span role="status" className={styles.link}>Working…</span>}
              </div>
            </section>
          )}

          {phase === "evidence" && run && valid && (
            <section className={styles.panel} aria-label="Captured evidence">
              <h2>Captured evidence</h2>
              <EvidenceDrawer run={run} selection={valid} />
              <p className={styles.bound}>{run.sourceBoundary} · Captured {new Date(run.capturedAt).toLocaleString()} · revision {(run.graphCommit ?? "uncommitted").slice(0, 7)}</p>
              <p className={styles.gaps}>Programme mapping, inventory, qualified alternatives and delivery timing remain unverified.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={() => setPhase("handoff")}>Prepare verification</button>
                <button type="button" className={styles.btn} onClick={() => setPhase("dependency")}>Back to dependency</button>
              </div>
            </section>
          )}

          {run && (
            <div hidden={phase !== "handoff"}>
              <section id="investigation-brief" tabIndex={-1} className={styles.panel} aria-label="Human handoff">
                <h2>Own the next check.</h2>
                {!session.authenticated && !brief && (
                  <p className={styles.gaps}>Drafting and review require a verified session. No brief has been created.</p>
                )}
                {brief && <p className={styles.gaps}>{briefStage(brief, true)}</p>}
                <DefenseBriefPanel key={run.runId} run={run} session={session} savedCase={false} onBriefChange={onBriefChange} />
                <div className={styles.actions}>
                  <a className={styles.btn} href={continueHref}>Continue in workspace</a>
                  <button type="button" className={styles.btn} onClick={() => setPhase("evidence")}>Back to evidence</button>
                </div>
              </section>
            </div>
          )}
        </div>

        <nav className={styles.nav} aria-label="Experience phases">
          {EXPERIENCE_PHASES.map((item) => (
            <button
              key={item}
              type="button"
              disabled={!canVisitPhase(item, run, valid)}
              aria-current={phase === item ? "step" : undefined}
              onClick={() => visit(item)}
            >
              {PHASE_LABELS[item]}
            </button>
          ))}
        </nav>
      </div>

      <div className={styles.caption}>
        <p>
          Scottish elevation study · 2× vertical exaggeration · brand atmosphere, not supplier geography.
          Illustrative shelter symbol, not a mapped building.
        </p>
        <Inspector label="Terrain attribution" title="Frozen terrain source — local metadata">
          <p className="text-sm">Mapzen Terrain Tiles. Produced using Copernicus data and information funded by the European Union — EU-DEM layers. SRTM and GMTED2010 data courtesy of the U.S. Geological Survey. ETOPO1: DOC/NOAA/NESDIS/NCEI.</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="font-semibold">Source tile</dt>
              <dd>{terrainMeta?.sourceUrl
                ? <a className="underline" href={terrainMeta.sourceUrl} rel="noreferrer">{terrainMeta.sourceUrl}</a>
                : "/experience/terrain/terrain-source.json"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Dataset</dt>
              <dd>{terrainMeta?.datasetUrl
                ? <a className="underline" href={terrainMeta.datasetUrl} rel="noreferrer">{terrainMeta.datasetUrl}</a>
                : "AWS Terrain Tiles (Terrarium encoding)"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Attribution</dt>
              <dd>{terrainMeta?.attributionUrl
                ? <a className="underline" href={terrainMeta.attributionUrl} rel="noreferrer">{terrainMeta.attributionUrl}</a>
                : "Joerd tile sources"}</dd>
            </div>
          </dl>
        </Inspector>
      </div>
    </div>
  );
}
