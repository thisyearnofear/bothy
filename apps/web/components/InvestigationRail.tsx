"use client";

import type { DefenseBrief, DefenseSession, GraphRun } from "../lib/api";
import { railStations } from "../lib/atlas";

const HUMAN_STATIONS = new Set(["brief", "review", "followup"]);

export default function InvestigationRail({ run, busy, brief, session, onFocus }: {
  run: GraphRun | null;
  busy: boolean;
  brief: DefenseBrief | null;
  session: DefenseSession;
  onFocus: (target: string) => void;
}) {
  const stations = railStations({ run, busy, brief, session });
  const nextIndex = stations.findIndex((station) => !station.done);

  return (
    <nav className="rail" aria-label="Investigation progress">
      <p className="rail-head">Deterministic evidence workflow</p>
      <p className="rail-sub">No cloud inference on this page</p>
      <ol className="rail-list">
        {stations.map((station, index) => {
          const isNext = index === nextIndex;
          const human = HUMAN_STATIONS.has(station.id);
          return (
            <li key={station.id}>
              <button
                type="button"
                className="rail-stop"
                data-done={station.done || undefined}
                data-next={isNext ? (human ? "human" : "tool") : undefined}
                aria-current={isNext ? "step" : undefined}
                onClick={() => onFocus(station.target)}
              >
                <span className="rail-dot" aria-hidden="true" />
                <span className="rail-text">
                  <span className="rail-label">{station.label}</span>
                  <span className="rail-state">{station.state}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
