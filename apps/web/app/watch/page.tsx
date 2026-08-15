"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { type MapBeat, type RouteOnMap } from "../../components/MapView";
import Timeline, { type Series } from "../../components/Timeline";
import RiskList, { type RiskRow } from "../../components/RiskList";
import Detail from "../../components/Detail";
import Intro, { INTRO_KEY } from "../../components/Intro";
import { api } from "../../lib/api";
import { inflections, leadTimeLabel, ms, pointAt, riskColor, snapshotAt } from "../../lib/derive";
import type {
  Assessment,
  AuditEntry,
  LiveWeatherResponse,
  RiskLabel,
  RiskSnapshot,
  RouteInfo,
  ScenarioId,
  ScenarioInfo,
  ToolCall,
} from "../../../../packages/shared/src/types";

export default function Watch() {
  const [scenario, setScenario] = useState<ScenarioInfo | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, RiskSnapshot[]>>({});
  const [t, setT] = useState(0);
  const [range, setRange] = useState({ start: 0, end: 0, horizon: 0, outcome: undefined as number | undefined });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Record<string, Assessment>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [playing, setPlaying] = useState(false);
  const [running, setRunning] = useState(false);
  const [traceLines, setTraceLines] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [llm, setLlm] = useState<{ id: string; label: string; model: string }[]>([]);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherResponse | null>(null);
  const [refreshingWeather, setRefreshingWeather] = useState(false);
  // cold open: once per session, unless ?demo=1 (pitch mode) or already seen via the landing
  const [showIntro, setShowIntro] = useState(false);

  const startReplay = useCallback(() => {
    setT((cur) => (cur > range.start + 1000 ? range.start : cur));
    setPlaying(true);
  }, [range.start]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const seen = (() => {
      try {
        return sessionStorage.getItem(INTRO_KEY) === "1";
      } catch {
        return true;
      }
    })();
    if (!q.get("demo") && !seen && q.get("replay") !== "1") setShowIntro(true);
    if (q.get("replay") === "1") {
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {
        /* noop */
      }
    }
  }, []);

  const refreshAudit = useCallback((id: ScenarioId) => {
    api.audit(id).then(setAudit).catch(() => {});
  }, []);

  // money shot: the decision rail is populated at first paint — scripted engine is instant,
  // the manual "Run agent" press is the live-LLM beat.
  const assessmentKey = (scenarioId: ScenarioId, routeId: string) => `${scenarioId}:${routeId}`;
  const assessed = useRef<Set<string>>(new Set());
  const autoAssess = useCallback((id: ScenarioId, routeId: string) => {
    const key = assessmentKey(id, routeId);
    if (assessed.current.has(key)) return;
    assessed.current.add(key);
    api
      .assess(id, { routeId, engine: "scripted" })
      .then((result) => setAssessments((prev) => ({ ...prev, [key]: result })))
      .catch(() => assessed.current.delete(key));
  }, []);

  const load = async (id: ScenarioId) => {
    setError(null);
    setLoading(true);
    setAssessments({});
    setAudit([]);
    setPlaying(false);
    try {
      const { scenario, routes } = await api.scenario(id);
      const tls = await Promise.all(routes.map((r: RouteInfo) => api.timeline(id, r.id)));
      const snap: Record<string, RiskSnapshot[]> = {};
      routes.forEach((r: RouteInfo, i: number) => (snap[r.id] = tls[i]));
      const horizon = ms(scenario.now);
      const end = scenario.outcomeAt ? ms(scenario.fullEnd) : horizon;
      setScenario(scenario);
      setRoutes(routes);
      if (id === "live") {
        api.liveWeather().then(setLiveWeather).catch(() => setLiveWeather(null));
      } else {
        setLiveWeather(null);
      }
      setSnapshots(snap);
      setRange({ start: ms(scenario.start), end, horizon, outcome: scenario.outcomeAt ? ms(scenario.outcomeAt) : undefined });
      setT(horizon);
      const top = [...routes].sort(
        (a, b) => (snapshotAt(snap[b.id], horizon)?.score ?? 0) - (snapshotAt(snap[a.id], horizon)?.score ?? 0)
      )[0];
      setSelectedId(top?.id ?? null);
      assessed.current.clear();
      if (top) autoAssess(id, top.id);
      refreshAudit(id);
      // ?replay=1 deep-link: the day plays itself on arrival
      if (new URLSearchParams(window.location.search).get("replay") === "1") {
        setT(ms(scenario.start));
        setPlaying(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api
      .scenarios()
      .then((s) => s.map((s) => s.id))
      .then((ids) => ids[0] ?? ("live" as ScenarioId))
      .then(load)
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    api.llm().then((r) => setLlm(r.providers)).catch(() => {});
  }, []);

  // replay: advances the cursor start->end; reduced-motion falls back to beat stepping (no tween)
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      step(1);
      return;
    }
    const stepMs = Math.max(1, (range.end - range.start) / 250);
    const id = setInterval(() => {
      setT((prev) => {
        if (prev + stepMs >= range.end) {
          setPlaying(false);
          return range.end;
        }
        return prev + stepMs;
      });
    }, 80);
    return () => clearInterval(id);
  }, [playing, range.end, range.start]);

  const rows = useMemo<RiskRow[]>(
    () =>
      routes
        .map((r) => {
          const s = snapshotAt(snapshots[r.id] ?? [], t);
          const label = (s?.label ?? "LOW") as RiskLabel;
          return { routeId: r.id, name: r.name, score: s?.score ?? 0, label, color: riskColor(label) };
        })
        .sort((a, b) => b.score - a.score),
    [routes, snapshots, t]
  );

  const series: Series[] = useMemo(
    () =>
      routes.map((r) => ({
        id: r.id,
        color: riskColor((snapshotAt(snapshots[r.id] ?? [], range.horizon)?.label ?? "LOW") as RiskLabel),
        points: (snapshots[r.id] ?? []).map((s) => [ms(s.at), s.score] as [number, number]),
      })),
    [routes, snapshots, range.horizon]
  );

  const snaps = useMemo(() => {
    const map = new Map<number, { t: number; label: string; delta: number }>();
    routes.forEach((r) =>
      inflections(snapshots[r.id] ?? []).forEach((n) => {
        if (!map.has(n.atMs)) map.set(n.atMs, { t: n.atMs, label: n.signal, delta: n.delta });
      })
    );
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [routes, snapshots]);

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
      }))
    );
  }, [routes, snapshots, range.start, range.end]);

  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const selectedLiveWeather = liveWeather?.routes.find((weather) => weather.routeId === selectedId) ?? null;
  const selectedAssessment = scenario && selectedId ? assessments[assessmentKey(scenario.id, selectedId)] ?? null : null;
  const selSnap = selected ? snapshotAt(snapshots[selected.id] ?? [], t) : undefined;
  const selHorizon = selected ? snapshotAt(snapshots[selected.id] ?? [], range.horizon) : undefined;
  const selColor = selHorizon ? riskColor(selHorizon.label) : "var(--text-faint)";

  // "the point it became inevitable": the earliest moment from which the selected
  // route stays HIGH (>=0.75) through the agent's horizon. Computed, never asserted.
  const inevitableMs = useMemo(() => {
    if (!selected) return undefined;
    const tl = (snapshots[selected.id] ?? []).filter((s) => ms(s.at) <= range.horizon);
    for (let i = 0; i < tl.length; i++) {
      if (tl.slice(i).every((s) => s.score >= 0.75)) return ms(tl[i].at);
    }
    return undefined;
  }, [selected, snapshots, range.horizon]);

  // money shot: a warm one-sentence causal story for the selected route — headline first, numbers after
  const headline = useMemo(() => {
    if (!selected || !selHorizon) return null;
    const story = selHorizon.citations
      .slice(-3)
      .map((c) => c.text.toLowerCase())
      .join("; ");
    return `${selected.name} is ${selHorizon.label}: ${story.charAt(0).toUpperCase() + story.slice(1)}.`;
  }, [selected, selHorizon]);

  const step = (dir: 1 | -1) => {
    if (!snaps.length) return;
    const times = [...snaps.map((s) => s.t), ...(inevitableMs != null ? [inevitableMs] : [])].sort((a, b) => a - b);
    const k = dir === 1 ? times.find((x) => x > t) : [...times].reverse().find((x) => x < t);
    if (k != null) setT(k);
  };

  // keep the rail populated when the officer switches route mid-review
  useEffect(() => {
    if (scenario && selectedId) autoAssess(scenario.id, selectedId);
  }, [scenario, selectedId, autoAssess]);

  const run = async () => {
    if (!scenario || !selected) return;
    setRunning(true);
    setTraceLines([]);
    const key = assessmentKey(scenario.id, selected.id);
    try {
      const result = await api.assessStream(
        scenario.id,
        { routeId: selected.id, engine: llm.length ? "llm" : "scripted" },
        (tc) => setTraceLines((prev) => [...prev, tc])
      );
      setAssessments((prev) => ({ ...prev, [key]: result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };
  const decide = async (d: "approved" | "rejected") => {
    if (!selectedAssessment || !scenario) return;
    try {
      const result = await api.decide(selectedAssessment.id, d);
      setAssessments((prev) => ({ ...prev, [assessmentKey(scenario.id, result.routeId)]: result }));
      refreshAudit(scenario.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // The lead time is computed from the illustrative replay timestamps.
  const revealText =
    scenario?.outcomeAt && scenario.outcome
      ? `reported closure · modeled lead time ${leadTimeLabel(scenario.now, scenario.outcomeAt)}`
      : undefined;

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] p-3 sm:p-4 lg:p-5">
      {showIntro && (
        <Intro
          onEnter={() => setShowIntro(false)}
          onReplay={() => {
            setShowIntro(false);
            startReplay();
          }}
        />
      )}

      <header
        className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3"
        style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
      >
        <div className="min-w-0">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Bothy · the watch room
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-strong)" }}>
              {scenario?.title ?? (loading ? "Loading…" : "Bothy")}
            </h1>
            {scenario && (
              <span className="mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                {scenario.id === "backtest" ? "illustrative replay" : "operator view"}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Watch room controls">
          <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--rule)" }}>
            {(["live", "backtest"] as const).map((id) => (
              <button
                key={id}
                onClick={() => load(id)}
                className="rounded-md px-3 py-1.5 text-sm transition-colors"
                style={
                  scenario?.id === id
                    ? { background: "var(--rule)", color: "var(--text-strong)" }
                    : { color: "var(--text-body)" }
                }
              >
                {id === "live" ? "Live" : "Backtest"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96]"
            style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
          >
            {playing ? "Pause replay" : "Replay day"}
          </button>
          {scenario?.id === "live" && (
            <button
              onClick={() => {
                setRefreshingWeather(true);
                api
                  .refreshLiveWeather()
                  .then(setLiveWeather)
                  .catch((e) => setError(e instanceof Error ? e.message : String(e))) // last good snapshot retained
                  .finally(() => setRefreshingWeather(false));
              }}
              disabled={refreshingWeather}
              className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96] disabled:opacity-50"
              style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
            >
              {refreshingWeather ? "Refreshing…" : "Refresh live context"}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded border p-2 text-sm"
          style={{ borderColor: "oklch(64% 0.21 25)", background: "oklch(64% 0.21 25 / 0.1)", color: "oklch(80% 0.06 25)" }}
        >
          {error}
        </div>
      )}

      {loading && !scenario ? (
        <div className="grid h-[60vh] place-items-center text-sm" style={{ color: "var(--text-faint)" }}>
          Loading scenario…
        </div>
      ) : routes.length === 0 ? (
        <div className="grid h-[60vh] place-items-center text-sm" style={{ color: "var(--text-faint)" }}>
          No scenario loaded — is the agent running?
        </div>
      ) : (
        <>
          {headline && (
            <section className="mb-4 rounded-lg border px-4 py-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
              <p className="mono mb-1 text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                Current decision picture
              </p>
              <p className="max-w-5xl text-base leading-relaxed" style={{ color: "var(--text-body)" }}>
                <span className="font-semibold" style={{ color: selHorizon ? riskColor(selHorizon.label) : undefined }}>
                  {selHorizon?.label}
                </span>{" "}
                <span className="mono tnum">{selHorizon?.score.toFixed(2)}</span> — {headline}
              </p>
            </section>
          )}

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.55fr)_minmax(300px,0.98fr)]">
            <aside className="order-2 xl:sticky xl:top-4 xl:order-1 xl:self-start">
              <section className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                      Route priority
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>
                      Rank at <span className="mono">{at(t)}</span>
                    </p>
                  </div>
                  <span className="mono text-xs" style={{ color: "var(--text-faint)" }}>
                    {rows.length} routes
                  </span>
                </div>
                <RiskList rows={rows} selectedId={selectedId} onSelect={setSelectedId} fresh={at(t)} />
              </section>
            </aside>

            <section className="order-1 min-w-0 space-y-4 xl:order-2">
              <section
                className="relative h-[420px] overflow-hidden rounded-lg border sm:h-[52vh] xl:h-[min(58vh,680px)]"
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
                  onSelect={setSelectedId}
                  cursorMs={t}
                  startMs={range.start}
                  endMs={range.end}
                  beats={mapBeats}
                  revealed={range.outcome != null && t >= range.outcome}
                />
                {selected && selHorizon && (
                  <div
                    className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
                  >
                    <p className="mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                      selected corridor
                    </p>
                    <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                      {selected.name}
                    </p>
                    <p className="mono mt-1 text-xs" style={{ color: selColor }}>
                      {selHorizon.label} {selHorizon.score.toFixed(2)}
                    </p>
                  </div>
                )}
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
                      style={{ color: selectedLiveWeather.acquisitionMode === "demo-fallback" ? "oklch(80% 0.14 85)" : "var(--cursor)" }}
                    >
                      {selectedLiveWeather.acquisitionMode === "demo-fallback" ? "live context unavailable" : "live weather context"}
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
                    {selectedLiveWeather.note}
                    {liveWeather?.ingestedAt && <> · frozen snapshot ingested {new Date(liveWeather.ingestedAt).toLocaleString()}</>}
                  </p>
                </section>
              )}

              <section aria-label="Decision replay timeline">
                <Timeline
                  startMs={range.start}
                  endMs={range.end}
                  horizonMs={range.horizon}
                  t={t}
                  onSeek={setT}
                  onPrevStep={() => step(-1)}
                  onNextStep={() => step(1)}
                  series={series}
                  snaps={snaps}
                  inevitableMs={inevitableMs}
                  revealMs={range.outcome}
                  revealText={revealText}
                />
                {scenario?.outcomeAt && scenario.outcome && (
                  <p className="mt-2 px-1 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
                    {scenario.outcome}
                  </p>
                )}
              </section>
            </section>

            <aside className="order-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:self-start">
              <section className="rounded-lg border p-4" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
                <Detail
                  route={selected}
                  horizon={selHorizon}
                  horizonTime={at(range.horizon)}
                  color={selColor}
                  cursorSignals={selSnap?.citations.length ?? 0}
                  cursorTime={at(t)}
                  assessment={selectedAssessment}
                  audit={audit}
                  running={running}
                  traceLines={traceLines}
                  llmAvailable={llm.length > 0}
                  onRun={run}
                  onApprove={() => decide("approved")}
                  onReject={() => decide("rejected")}
                />
              </section>
            </aside>
          </div>

          <footer className="mono mt-4 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs" style={{ color: "var(--text-faint)" }}>
            <span>providers: {llm.length ? llm.map((p) => p.id).join(", ") : "scripted only"}</span>
            {scenario?.outcomeAt && (
              <span>
                horizon <span className="tnum">{at(range.horizon)}</span>
              </span>
            )}
          </footer>
        </>
      )}
    </main>
  );
}

const at = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
