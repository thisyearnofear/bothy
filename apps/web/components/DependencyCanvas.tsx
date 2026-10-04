"use client";

import type { GraphRun } from "../lib/api";
import {
  BOUNDED_FINAL_LABEL,
  CHAIN_STAGES,
  cellText,
  chainEdges,
  chainNodeId,
  exposureNames,
  isChainRun,
  isExposureRun,
} from "../lib/atlas";

export interface InspectSelection {
  row: number;
  column: string;
}

const value = (row: Record<string, unknown>, column: string) => cellText(row, column) ?? "Not recorded";

function Edge({ bounded }: { bounded: boolean }) {
  return (
    <div className="dep-edge" aria-hidden="true">
      <span className="dep-edge-label">{bounded ? "bounded" : "CONTAINS"}</span>
      <svg viewBox="0 0 60 18" preserveAspectRatio="none">
        <line x1="0" y1="9" x2="50" y2="9" stroke="var(--rule)" strokeWidth="2" strokeDasharray={bounded ? "4 5" : undefined} />
        <path d="M50 4 L58 9 L50 14 Z" fill="var(--rule)" />
      </svg>
    </div>
  );
}

function Turn() {
  return (
    <div className="dep-turn" aria-hidden="true">
      <svg viewBox="0 0 400 28" preserveAspectRatio="none">
        <path d="M350 0 L350 14 L50 14 L50 24" fill="none" stroke="var(--rule)" strokeWidth="1.5" />
        <path d="M45 20 L50 27 L55 20 Z" fill="var(--rule)" />
      </svg>
      <span className="dep-edge-label">CONTAINS</span>
    </div>
  );
}

function ChainStageRows({ run, row, rowIndex, selected, onSelect }: {
  run: GraphRun;
  row: Record<string, unknown>;
  rowIndex: number;
  selected: InspectSelection | null;
  onSelect: (selection: InspectSelection) => void;
}) {
  const edges = chainEdges(row);
  const hasEdge = (from: string) => edges.find((edge) => edge.fromStage === from);
  const turn = hasEdge("Assembly");
  const final = hasEdge("Material");
  const stage = (index: number) => {
    const [label, column] = CHAIN_STAGES[index];
    const present = cellText(row, column);
    const isSelected = selected?.row === rowIndex && selected.column === column;
    return (
      <button
        key={chainNodeId(run.runId, rowIndex, column)}
        type="button"
        className="dep-node"
        data-column={column}
        data-selected={isSelected || undefined}
        aria-pressed={isSelected}
        aria-label={`${label}: ${value(row, column)}`}
        onClick={() => onSelect({ row: rowIndex, column })}
      >
        <span className="dep-node-stage">{index + 1} · {label}</span>
        <span className="dep-node-value">{present ?? "Not recorded"}</span>
      </button>
    );
  };
  return (
    <>
      <div className="dep-row" role="list" aria-label="Dependency stages, part one">
        {[0, 1, 2, 3].map((index) => {
          const [label] = CHAIN_STAGES[index];
          const edge = index < 3 ? hasEdge(label) : undefined;
          return (
            <div key={CHAIN_STAGES[index][1]} className="dep-cell" role="listitem">
              {stage(index)}
              {edge && <Edge bounded={edge.bounded} />}
            </div>
          );
        })}
      </div>
      {turn && <Turn />}
      <div className="dep-row" role="list" aria-label="Dependency stages, part two">
        {[4, 5, 6, 7].map((index) => {
          const [label] = CHAIN_STAGES[index];
          const edge = index < 7 ? hasEdge(label) : undefined;
          return (
            <div key={CHAIN_STAGES[index][1]} className="dep-cell" role="listitem">
              {stage(index)}
              {edge && <Edge bounded={edge.bounded} />}
            </div>
          );
        })}
      </div>
      {final && (
        <p className="dep-final">
          Final material segment: <strong>{BOUNDED_FINAL_LABEL}</strong>
        </p>
      )}
      <ol className="dep-relations" aria-label="Captured relationships">
        {edges.map((edge) => (
          <li key={`${edge.fromStage}-${edge.toStage}`} className="mono">
            {edge.fromStage} → {edge.toStage} · {edge.bounded ? BOUNDED_FINAL_LABEL : "CONTAINS"}
          </li>
        ))}
      </ol>
    </>
  );
}

export default function DependencyCanvas({ run, sample, onSample, selected, onSelect, onRequestChain }: {
  run: GraphRun;
  sample: number;
  onSample: (index: number) => void;
  selected: InspectSelection | null;
  onSelect: (selection: InspectSelection) => void;
  onRequestChain?: () => void;
}) {
  if (isChainRun(run)) {
    const rows = run.rows;
    const index = Math.min(Math.max(sample, 0), Math.max(rows.length - 1, 0));
    const row = rows[index];
    return (
      <section className="dep-canvas" id="investigation-canvas" aria-label="Captured dependency chain">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Captured dependency · synthetic model</p>
            <h2 className="story-serif mt-2">A small material. A long dependency.</h2>
          </div>
          {rows.length > 0 && (
            <label className="text-sm">
              Captured sample
              <select
                className="mt-2 block w-full max-w-full rounded-lg border px-3 py-2"
                style={{ background: "var(--panel)", borderColor: "var(--rule)" }}
                value={index}
                onChange={(e) => onSample(Number(e.target.value))}
                aria-label="Captured sample path"
              >
                {rows.map((item, i) => (
                  <option key={i} value={i}>Path {i + 1}: {value(item, "c.family")}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {row ? (
          <>
            <div className="dep-flow mt-5">
              <ChainStageRows run={run} row={row} rowIndex={index} selected={selected} onSelect={onSelect} />
            </div>
            <p className="hint mt-4" role="status">
              Captured path {index + 1} of {rows.length}. Stages joined by CONTAINS only where both
              endpoints were returned; the final material segment spans 1–4 edges —{" "}
              {BOUNDED_FINAL_LABEL}. Query limit: 10 paths; this is not total exposure.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm">No chain rows captured. This does not establish no exposure.</p>
        )}
      </section>
    );
  }

  if (isExposureRun(run)) {
    const names = exposureNames(run);
    return (
      <section className="dep-canvas" id="investigation-canvas" aria-label="Captured platform names">
        <p className="eyebrow">Captured names · not a path</p>
        {names.length ? (
          <>
            <h2 className="story-serif mt-2">Names captured; paths not returned by this query.</h2>
            <ul className="dep-names mt-4">
              {run.rows.map((row, index) => {
                const name = cellText(row, "p.name");
                if (!name) return null;
                const isSelected = selected?.row === index;
                return (
                  <li key={`${run.runId}-${index}`}>
                    <button
                      type="button"
                      className="dep-node dep-name"
                      data-column="p.name"
                      data-selected={isSelected || undefined}
                      aria-pressed={isSelected}
                      aria-label={`Observed platform name: ${name}`}
                      onClick={() => onSelect({ row: index, column: "p.name" })}
                    >
                      <span className="dep-node-value">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="hint mt-4">
              These names are returned rows, not dependency paths, and none is identified with the
              sampled chains elsewhere on this page.
            </p>
            {onRequestChain && (
              <button type="button" className="btn mt-3" onClick={onRequestChain}>
                Investigate a captured dependency chain separately →
              </button>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm">No matching rows captured. This is not evidence of no exposure.</p>
        )}
      </section>
    );
  }

  return (
    <section className="dep-canvas" id="investigation-canvas" aria-label="Captured rows overview">
      <p className="eyebrow">Captured rows</p>
      {run.rows.length ? (
        <ul className="dep-names mt-4">
          {run.rows.slice(0, 10).map((row, index) => {
            const label = run.columns.map((column) => cellText(row, column)).find(Boolean) ?? `Row ${index + 1}`;
            const isSelected = selected?.row === index;
            return (
              <li key={`${run.runId}-${index}`}>
                <button
                  type="button"
                  className="dep-node dep-name"
                  data-column={run.columns[0]}
                  data-selected={isSelected || undefined}
                  aria-pressed={isSelected}
                  aria-label={`Captured row ${index + 1}: ${label}`}
                  onClick={() => onSelect({ row: index, column: run.columns[0] ?? "" })}
                >
                  <span className="dep-node-value">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm">No matching rows captured. This is not evidence of no exposure.</p>
      )}
      {run.rows.length > 10 && <p className="hint mt-3">Showing first 10 captured rows of {run.rows.length}.</p>}
    </section>
  );
}
