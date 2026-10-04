"use client";

import { forwardRef } from "react";
import type { GraphRun } from "../lib/api";
import { cellDisplay } from "../lib/atlas";

interface Props {
  run: GraphRun;
  selection: { row: number; column: string } | null;
  heading?: string;
}

const EvidenceDrawer = forwardRef<HTMLDivElement, Props>(function EvidenceDrawer({ run, selection, heading }, ref) {
  if (!selection) return null;
  const row = run.rows[selection.row];
  if (!row) return null;
  return (
    <div ref={ref} tabIndex={-1} className="evidence-drawer" aria-label={heading ?? `Captured evidence row ${selection.row + 1}, ${selection.column}`}>
      <p role="status" className="text-sm font-semibold">{heading ?? `Selected captured row ${selection.row + 1}: ${selection.column}`}</p>
      <dl className="mt-3 space-y-2">
        {run.columns.map((column) => (
          <div key={column} className="break-words text-sm">
            <dt className="font-semibold">{column}{column === selection.column ? " (selected)" : ""}</dt>
            <dd>{cellDisplay(row, column)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm">This is the stored capture, not a new graph query.</p>
    </div>
  );
});

export default EvidenceDrawer;
