"use client";

import type { ReactNode } from "react";
import { storyBySlug } from "../lib/stories";
import { beatLabel, storySlugForScenario } from "../lib/atlas";
import type { GraphRun } from "../lib/api";
import LensTabs from "./LensTabs";

export default function InvestigationTimeline({ scenarioId, run, activeBeatIndex, onBeatChange, versionsPanel }: {
  scenarioId: string;
  run: GraphRun | null;
  activeBeatIndex: number;
  onBeatChange: (index: number) => void;
  versionsPanel?: ReactNode;
}) {
  const story = storyBySlug(storySlugForScenario(scenarioId) ?? "");
  const beats = story?.beats ?? [];
  const index = Math.min(Math.max(activeBeatIndex, 0), Math.max(beats.length - 1, 0));
  const beat = beats[index];

  return (
    <section className="atl-timeline" aria-label="Investigation timeline">
      <LensTabs
        label="Timeline mode"
        items={[
          {
            id: "events",
            label: "Public events",
            content: story && beat ? (
              <>
                <input
                  type="range"
                  className="bothy-range w-full"
                  min={0}
                  max={beats.length - 1}
                  step={1}
                  value={index}
                  aria-label="Public event"
                  aria-valuetext={beatLabel(beat, index, beats.length)}
                  onChange={(e) => onBeatChange(Number(e.target.value))}
                />
                <ol className="mt-3 flex flex-wrap gap-2" aria-label="Public events">
                  {beats.map((item, i) => (
                    <li key={`${item.date}-${i}`}>
                      <button
                        type="button"
                        className="btn"
                        data-active={i === index || undefined}
                        aria-current={i === index ? "true" : undefined}
                        onClick={() => onBeatChange(i)}
                      >
                        {item.act ? "Current task" : item.label}
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="mt-4">
                  <p className="eyebrow">{beat.act ? "Current task" : beat.label} · {beat.heading}</p>
                  {beat.event && (
                    <p className="mt-2 text-sm">
                      {beat.event.text}{" "}
                      <a className="underline" href={beat.event.source.url} target="_blank" rel="noreferrer">
                        {beat.event.source.name} ↗
                      </a>
                    </p>
                  )}
                  {!beat.event && <p className="mt-2 text-sm">{beat.briefing ?? beat.narration}</p>}
                  <p className="hint mt-3">
                    Historical public context; the current capture does not change when scrubbing dates.
                    Scenario data remains synthetic.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm">No public events are authored for this scenario.</p>
            ),
          },
          {
            id: "versions",
            label: "Graph versions",
            content: (
              <>
                <p className="hint">Load, replay and compare pinned graph versions of the reviewed query.</p>
                {versionsPanel ?? <p className="mt-3 text-sm">Version controls are unavailable.</p>}
                {!run && <p className="hint mt-3">Run the question first if you want a capture to compare against.</p>}
              </>
            ),
          },
        ]}
      />
    </section>
  );
}
