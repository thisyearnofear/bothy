"use client";

import { useMemo } from "react";
import MapView, { type MapBeat, type RouteOnMap } from "./MapView";
import Timeline, { type Beat, type Series } from "./Timeline";
import { A66_OUTCOME_SOURCE } from "../lib/cases";
import { inflections, KIND_LABEL, ms, pointAt, riskColor, snapshotAt } from "../lib/derive";
import type {
  LiveWeatherResponse,
  RiskLabel,
  RiskSnapshot,
  RouteInfo,
  ScenarioInfo,
} from "../../../packages/shared/src/types";

/** Centre stage: map + selection overlay + severity legend, the live-weather
 *  strip, and the replay timeline. Extracted from app/watch/page.tsx — state
 *  stays with the page; this is render only. */
export default function WatchMapStage({
  scenario,
  routes,
  snapshots,
  t,
  range,
  revealed,
  selectedId,
  hoverId,
  onSelect,
  selected,
  overlaySnap,
  overlayColor,
  compact,
  liveWeather,
  snaps,
  inevitableMs,
  revealText,
  playing,
  onSeek,
  onPrevStep,
  onNextStep,
  onTogglePlay,
}: {
  scenario: ScenarioInfo | null;
  routes: RouteInfo[];
  snapshots: Record<string, RiskSnapshot[]>;
  t: number;
  range: { start: number; end: number; horizon: number; outcome?: number };
  revealed: boolean;
  selectedId: string | null;
  hoverId: string | null;
  onSelect: (id: string) => void;
  selected: RouteInfo | null;
  overlaySnap: RiskSnapshot | undefined;
  overlayColor: string;
  compact: boolean;
  liveWeather: LiveWeatherResponse | null;
  snaps: Beat[];
  inevitableMs?: number;
  revealText?: string;
  playing: boolean;
  onSeek: (ms: number) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onTogglePlay: () => void;
}) {
  const series: Series[] = useMemo(
    () =>
      routes.map((r) => ({
        id: r.id,
        color: riskColor((snapshotAt(snapshots[r.id] ?? [], range.horizon)?.label ?? "LOW") as RiskLabel),
        points: (snapshots[r.id] ?? []).map((s) => [ms(s.at), s.score] as [number, number]),
      })),
    [routes, snapshots, range.horizon]
  );

  // beats pinned onto the map: each signal lands at the point along its route the day had reached
  const mapBeats = useMemo<MapBeat[]>(() => {
    const span = range.end - range.start || 1;
    return routes.flatMap((r) =>
      inflections(snapshots[r.id] ?? []).map((n) => ({
        id: `${r.id}:${n.atMs}`,
        routeId: r.id,
        atMs: n.atMs,
        lngLat: pointAt(r.coords, (n.atMs - range.start) / span),
        text: n.signal,
        delta: n.delta,
        kind: KIND_LABEL[n.kind],
        source: n.source,
      }))
    );
  }, [routes, snapshots, range.start, range.end]);

  const selectedLiveWeather = liveWeather?.routes.find((weather) => weather.routeId === selectedId) ?? null;

  return (
    <section className="stage-in spot-dim order-1 min-w-0 space-y-4 xl:order-2" style={{ ["--stage" as string]: 0 }}>
      <section
        className="relative h-[300px] overflow-hidden rounded-lg border sm:h-[58vh] xl:h-[min(66vh,760px)]"
        style={{ borderColor: "var(--rule)" }}
        aria-label="Route risk map"
      >
        <MapView
          key={scenario?.id}
          routes={routes.map<RouteOnMap>((r) => {
            const s = snapshotAt(snapshots[r.id] ?? [], t);
            const label = (s?.label ?? "LOW") as RiskLabel;
            return { route: r, color: riskColor(label), score: s?.score ?? 0, label };
          })}
          selectedId={selectedId}
          hoverId={hoverId}
          onSelect={onSelect}
          cursorMs={t}
          startMs={range.start}
          endMs={range.end}
          beats={mapBeats}
          revealed={revealed}
          revealMs={range.outcome}
        />
        {selected && overlaySnap && !compact && (
          <div
            className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
          >
            <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-strong)" }}>
              {selected.name}
            </p>
            <p className="mono mt-1 text-xs" style={{ color: overlayColor }}>
              {overlaySnap.label} {overlaySnap.score.toFixed(2)}
            </p>
          </div>
        )}
        {/* severity legend — colour + label, never colour alone. The time
            lives in the timeline bubble; the corridor + score live in the
            headline and the rail — no need to repeat them on the map. */}
        <div
          className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5"
          style={{ borderColor: "var(--rule)", background: "color-mix(in oklch, var(--panel) 85%, transparent)" }}
        >
          <span className="mono text-xs" style={{ color: "var(--text-faint)" }}>
            risk
          </span>
          {(["LOW", "MODERATE", "ELEVATED", "HIGH"] as const).map((l) => (
            <span key={l} className="flex items-center gap-1 text-xs" style={{ color: "var(--text-body)" }}>
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: riskColor(l) }}
              />
              {l}
            </span>
          ))}
        </div>
      </section>

      {scenario?.id === "live" && selectedLiveWeather && (
        <section
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
          style={
            selectedLiveWeather.acquisitionMode === "demo-fallback"
              ? { borderColor: "oklch(80% 0.14 85)", background: "var(--panel)", color: "var(--text-body)" }
              : { borderColor: "var(--rule)", background: "var(--panel)", color: "var(--text-body)" }
          }
        >
          <div>
            <span
              className="mono mr-2 uppercase tracking-wider"
              style={{ color: selectedLiveWeather.acquisitionMode === "demo-fallback" ? "oklch(82% 0.14 85)" : "var(--cursor)" }}
            >
              {selectedLiveWeather.acquisitionMode === "demo-fallback" ? "live context unavailable" : "not in the score"}
            </span>
            <strong>{selectedLiveWeather.condition}</strong>
            {selectedLiveWeather.temperatureC != null && <> · {selectedLiveWeather.temperatureC.toFixed(1)}°C</>}
            {selectedLiveWeather.windGustKph != null && <> · gusts {Math.round(selectedLiveWeather.windGustKph)} km/h</>}
            {selectedLiveWeather.snowfallCm != null && selectedLiveWeather.snowfallCm > 0 && <> · snow {selectedLiveWeather.snowfallCm.toFixed(1)} cm</>}
          </div>
          <a href={selectedLiveWeather.sourceUrl} target="_blank" rel="noreferrer" className="mono underline" style={{ color: "var(--text-faint)" }}>
            {selectedLiveWeather.source} · {selectedLiveWeather.mode}
            {selectedLiveWeather.acquisitionMode ? ` · ${selectedLiveWeather.acquisitionMode}` : ""}
          </a>
          <p className="basis-full" style={{ color: "var(--text-faint)" }}>
            Open-Meteo frozen snapshot — operator-fetched API, never score evidence
            {liveWeather?.ingestedAt && <> · ingested {new Date(liveWeather.ingestedAt).toLocaleString()}</>}
          </p>
        </section>
      )}

      <section
        className="stage-in spot-dim"
        style={{ ["--stage" as string]: 2 }}
        aria-label="Decision replay timeline"
      >
        <Timeline
          startMs={range.start}
          endMs={range.end}
          horizonMs={range.horizon}
          t={t}
          onSeek={onSeek}
          onPrevStep={onPrevStep}
          onNextStep={onNextStep}
          series={series}
          snaps={snaps}
          inevitableMs={inevitableMs}
          revealMs={range.outcome}
          revealText={revealText}
          playing={playing}
          onTogglePlay={onTogglePlay}
        />
        {scenario?.id === "backtest" && (
          <p className="mt-2 px-1 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            <span className="mono uppercase tracking-wider" style={{ color: "var(--cursor)" }}>
              sourced news · beyond the hatch
            </span>
            {" — "}
            Reported facts are sourced; modeled signals and timing are labelled so the decision trail stays honest.
            {scenario.outcome ? ` ${scenario.outcome}` : ""}{" "}
            <a
              href={A66_OUTCOME_SOURCE.url}
              target="_blank"
              rel="noreferrer"
              className="underline"
              style={{ color: "var(--cursor)" }}
            >
              {A66_OUTCOME_SOURCE.name}, {A66_OUTCOME_SOURCE.date}
            </a>
          </p>
        )}
      </section>
    </section>
  );
}
