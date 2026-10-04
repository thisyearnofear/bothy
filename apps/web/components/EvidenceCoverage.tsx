"use client";

import { useEffect, useState } from "react";
import type { DefenseBrief, GraphRun } from "../lib/api";
import {
  COVERAGE_COLUMNS,
  coverageCell,
  coverageRows,
  ownerSummary,
  type CoverageColumn,
} from "../lib/atlas";
import type { InspectSelection } from "./DependencyCanvas";

interface UnknownCell {
  row: number;
  column: CoverageColumn;
  label: string;
}

export default function EvidenceCoverage({ run, brief, selected, onSelect, onPrepareVerification }: {
  run: GraphRun;
  brief: DefenseBrief | null;
  selected: InspectSelection | null;
  onSelect: (selection: InspectSelection) => void;
  onPrepareVerification: () => void;
}) {
  const [unknown, setUnknown] = useState<UnknownCell | null>(null);
  useEffect(() => { setUnknown(null); }, [selected]);
  const rows = coverageRows(run);
  const summary = ownerSummary(brief);

  return (
    <section className="cov" aria-label="Evidence coverage">
      <p className="eyebrow">Coverage · categorical states, not scores</p>
      <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-strong)" }}>What the capture establishes — and what it does not</h2>

      <div className="cov-scroll" tabIndex={0} role="region" aria-label="Coverage matrix">
        <table className="cov-table">
          <thead>
            <tr>
              <th scope="col">Captured row</th>
              {COVERAGE_COLUMNS.map((column) => <th key={column} scope="col">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <th scope="row" className="mono">Row {index + 1}</th>
                {COVERAGE_COLUMNS.map((column) => {
                  const cell = coverageCell(run, row, column);
                  const isSelected = column === "Dependency evidence" && selected?.row === index;
                  return (
                    <td key={column}>
                      <button
                        type="button"
                        className="cov-cell"
                        data-state={cell.kind}
                        data-selected={isSelected || undefined}
                        aria-pressed={isSelected}
                        aria-label={`Row ${index + 1}, ${column}: ${cell.label}`}
                        onClick={() => {
                          if (cell.inspectColumn) {
                            setUnknown(null);
                            onSelect({ row: index, column: cell.inspectColumn });
                          } else {
                            setUnknown({ row: index, column, label: cell.label });
                          }
                        }}
                      >
                        {cell.label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={COVERAGE_COLUMNS.length + 1} className="text-sm">No captured rows yet. Run the exposure question to populate coverage.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {run.rows.length > rows.length && (
        <p className="hint mt-2">Showing first {rows.length} captured rows of {run.rows.length} — a captured sample, never a total-impact count.</p>
      )}

      <ul className="cov-legend" aria-label="Coverage legend">
        <li><span className="cov-swatch" data-state="captured" />Captured — returned by the query</li>
        <li><span className="cov-swatch" data-state="unknown" />Not established / not recorded</li>
        <li><span className="cov-swatch" data-state="selected" />Selected row</li>
        <li><span className="cov-swatch" data-state="responsibility" />Responsibility — case level</li>
      </ul>

      {unknown && (
        <div className="cov-drawer" role="status">
          <p className="text-sm">
            <strong>Row {unknown.row + 1} · {unknown.column}:</strong> {unknown.label}.{" "}
            {unknown.column === "Owner finding"
              ? "Owner findings live at case level and are never attributed back to a captured row."
              : unknown.column === "Dependency evidence"
                ? "The captured row did not return the dependency values needed to show evidence — a gap in this capture, not proof there is nothing there."
                : "The captured schema returns no structured per-item facts for this field; it needs verification, not inference."}
          </p>
          <button type="button" className="btn mt-3" onClick={onPrepareVerification}>
            Prepare verification brief
          </button>
        </div>
      )}

      <p className="hint mt-3">
        Exposure, not confirmed stoppage · synthetic/public data. Approval or completion of the case
        does not close any cell above.
      </p>
      {summary && <p className="cov-owner" role="status">{summary}. Not independently verified operational effectiveness.</p>}
    </section>
  );
}
