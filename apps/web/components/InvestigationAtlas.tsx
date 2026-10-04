"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DefenseBrief, DefenseSession, GraphRun, GraphScenario } from "../lib/api";
import { exposureSummary } from "../lib/exposureSummary";
import { storyBySlug } from "../lib/stories";
import { storySlugForScenario } from "../lib/atlas";
import EvidenceDrawer from "./EvidenceDrawer";
import DependencyCanvas, { type InspectSelection } from "./DependencyCanvas";
import EvidenceCoverage from "./EvidenceCoverage";
import InvestigationRail from "./InvestigationRail";
import InvestigationTimeline from "./InvestigationTimeline";
import GeographicAtlas from "./GeographicAtlas";
import RunTrace from "./RunTrace";
import Inspector from "./Inspector";

export default function InvestigationAtlas({ run, busy, scenario, session, brief, onPrepareVerification, onRequestChain, versionsPanel }: {
  run: GraphRun | null;
  busy: boolean;
  scenario: GraphScenario | undefined;
  session: DefenseSession;
  brief: DefenseBrief | null;
  onPrepareVerification: () => void;
  onRequestChain?: () => void;
  versionsPanel?: ReactNode;
}) {
  const [selected, setSelected] = useState<InspectSelection | null>(null);
  const [sample, setSample] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [context, setContext] = useState<string | null>(null);
  const drawer = useRef<HTMLDivElement>(null);

  const runId = run?.runId ?? "none";
  const scenarioId = run?.scenarioId ?? scenario?.id ?? "";
  useEffect(() => {
    setSelected(null);
    setSample(0);
    setContext(null);
  }, [runId]);

  useEffect(() => {
    setBeatIndex(0);
    setContext(null);
  }, [scenarioId]);

  useEffect(() => {
    if (selected && drawer.current) {
      drawer.current.focus();
      drawer.current.scrollIntoView({ behavior: "auto", block: "nearest" });
    }
  }, [selected]);

  const inspect = (selection: InspectSelection) => {
    setSelected(selection);
    if (run?.scenarioId === "gallium-chain") setSample(selection.row);
  };

  const chooseSample = (index: number) => {
    setSample(index);
    setSelected(null);
  };

  const focus = (target: string) => {
    const el = document.getElementById(target);
    el?.scrollIntoView({ behavior: "auto", block: "start" });
    if (el instanceof HTMLElement) {
      const focusable = el.tabIndex >= 0 ? el : el.querySelector<HTMLElement>("button, a, select, input, [tabindex]");
      focusable?.focus({ preventScroll: true });
    }
  };

  const story = storyBySlug(storySlugForScenario(scenarioId) ?? "");
  const beat = story?.beats[Math.min(beatIndex, Math.max((story?.beats.length ?? 1) - 1, 0))];
  const summary = run ? exposureSummary(run) : null;
  const selectedRow = run && selected ? run.rows[selected.row] : null;

  return (
    <div className="atlas" aria-label="Investigation atlas">
      <InvestigationRail run={run} busy={busy} brief={brief} session={session} onFocus={focus} />

      <div className="atlas-main">
        {run ? (
          <DependencyCanvas
            run={run}
            sample={sample}
            onSample={chooseSample}
            selected={selected}
            onSelect={inspect}
            onRequestChain={onRequestChain}
          />
        ) : (
          <section className="dep-canvas" id="investigation-canvas" aria-label="Captured dependency">
            <p className="eyebrow">Captured dependency</p>
            <p className="mt-2 text-sm">
              {busy
                ? "Querying the reviewed graph question…"
                : "Choose an exposure question above and run the analysis. Captured relationships appear here — nothing is drawn from assumptions."}
            </p>
          </section>
        )}

        <section className="rounded-lg border px-4 py-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-label="Exposure summary" aria-live="polite">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>Exposure, not confirmed stoppage</p>
            <h2 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>{summary?.heading ?? "Start with one dependency question."}</h2>
          </div>
          {run && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
              Captured {new Date(run.capturedAt).toLocaleString()}
              {run.graphCommit ? ` · revision ${run.graphCommit.slice(0, 8)}` : " · revision not pinned"}.
              {busy && " Showing the previous capture while the operation completes."}
            </p>
          )}
          {run && <p className="hint mt-1">{run.sourceBoundary}</p>}
        </section>

        {summary && (
          <section className="rounded-lg border p-4" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-label="Verification gaps">
            <p className="context-note">{summary.explanation}</p>
            <h3 className="mt-3 text-sm font-semibold">What still needs verification</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{summary.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
            <p className="hint mt-3">Next: cited brief → owner checks inventory, substitutes and timing.</p>
          </section>
        )}

        <InvestigationTimeline
          scenarioId={scenarioId}
          run={run}
          activeBeatIndex={beatIndex}
          onBeatChange={setBeatIndex}
          versionsPanel={versionsPanel}
        />
        <GeographicAtlas
          scenarioId={scenarioId}
          beat={beat}
          selectedContext={context}
          onSelectContext={setContext}
        />
      </div>

      <aside className="atlas-side">
        {selected && selectedRow && run && (
          <EvidenceDrawer ref={drawer} run={run} selection={selected} />
        )}

        <Inspector label="Inspect captured run" title="Captured run — replay of stored results">
          <RunTrace run={run} busy={busy} />
        </Inspector>
      </aside>

      {run && (
        <div className="atlas-coverage">
          <EvidenceCoverage
            key={run.runId}
            run={run}
            brief={brief}
            selected={selected}
            onSelect={inspect}
            onPrepareVerification={onPrepareVerification}
          />
        </div>
      )}
    </div>
  );
}
