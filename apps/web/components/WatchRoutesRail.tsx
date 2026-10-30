"use client";

import type { ComponentProps } from "react";
import RiskList from "./RiskList";

type RiskListProps = ComponentProps<typeof RiskList>;

/** Left rail: the corridor list. Extracted from app/watch/page.tsx — state
 *  stays with the page; this is render only. */
export default function WatchRoutesRail({ rows, selectedId, onSelect, onHover, fresh, compact, citations }: {
  rows: RiskListProps["rows"];
  selectedId: string | null;
  onSelect: RiskListProps["onSelect"];
  onHover: RiskListProps["onHover"];
  fresh: string;
  compact: boolean;
  citations: RiskListProps["citations"];
}) {
  return (
    <aside aria-label="Corridors" className="stage-in spot-dim order-3 xl:sticky xl:top-4 xl:order-1 xl:self-start" style={{ ["--stage" as string]: 1 }}>
      <section className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Routes
            <span className="ml-2" style={{ color: "var(--text-body)" }}>
              {fresh}
            </span>
          </p>
          {!compact && (
            <span className="mono text-xs" style={{ color: "var(--text-faint)" }}>
              {rows.length}
            </span>
          )}
        </div>
        <RiskList
          rows={rows}
          selectedId={selectedId}
          onSelect={onSelect}
          onHover={onHover}
          fresh={fresh}
          compact={compact}
          citations={citations}
        />
      </section>
    </aside>
  );
}
