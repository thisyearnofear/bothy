"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MapView, { type MapBeat, type RouteOnMap } from "../../components/MapView";
import Timeline, { type Series } from "../../components/Timeline";
import RiskList, { type RiskRow } from "../../components/RiskList";
import Detail from "../../components/Detail";
import DeskCoach, { DESK_KEY } from "../../components/DeskCoach";
import WatchLoading from "../../components/WatchLoading";
import { CaseSwitch } from "../../components/CaseList";
import { caseFromSearch, caseUrl, type CaseId } from "../../lib/cases";
import { api, isAbortError } from "../../lib/api";
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
  const [hoverId, setHoverId] = useState<string | null>(null);
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
  const [deskOpen, setDeskOpen] = useState(true);
  const [tape, setTape] = useState(false);
  const [coach, setCoach] = useState(false);

  const loadCtl = useRef<AbortController | null>(null);
  const assessCtl = useRef(new AbortController());
  const runCtl = useRef<AbortController | null>(null);
  const weatherCtl = useRef<AbortController | null>(null);

  const abortBackground = useCallback(() => {
    assessCtl.current.abort();
    assessCtl.current = new AbortController();
    runCtl.current?.abort();
    runCtl.current = null;
    weatherCtl.current?.abort();
    weatherCtl.current = null;
    setRunning(false);
    setRefreshingWeather(false);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("replay") === "1") {
      setTape(true);
      setDeskOpen(false);
    }
    try {
      if (sessionStorage.getItem(DESK_KEY) !== "1") setCoach(true);
    } catch {
      setCoach(true);
    }
  }, []);

  const refreshAudit = useCallback((id: ScenarioId) => {
    const { signal } = assessCtl.current;
    api
      .audit(id, signal)
      .then((entries) => {
        if (!signal.aborted) setAudit(entries);
      })
      .catch((e) => {
        if (isAbortError(e)) return;
      });
  }, []);

  // money shot: the decision rail is populated at first paint — scripted engine is instant,
  // the manual "Run agent" press is the live-LLM beat.
  const assessmentKey = (scenarioId: ScenarioId, routeId: string) => `${scenarioId}:${routeId}`;
  const assessed = useRef<Set<string>>(new Set());
  const autoAssess = useCallback((id: ScenarioId, routeId: string) => {
    const key = assessmentKey(id, routeId);
    if (assessed.current.has(key)) return;
    assessed.current.add(key);
    const { signal } = assessCtl.current;
    api
      .assess(id, { routeId, engine: "scripted" }, signal)
      .then((result) => {
        if (!signal.aborted) setAssessments((prev) => ({ ...prev, [key]: result }));
      })
      .catch((e) => {
        assessed.current.delete(key);
        if (isAbortError(e)) return;
      });
  }, []);

  const load = useCallback(
    async (id: CaseId, opts?: { tape?: boolean }) => {
      loadCtl.current?.abort();
      const ac = new AbortController();
      loadCtl.current = ac;
      abortBackground();
      assessed.current.clear();

      setError(null);
      setLoading(true);
      setScenario(null);
      setRoutes([]);
      setAssessments({});
      setAudit([]);
      setPlaying(false);
      const tape = opts?.tape ?? (id === "backtest" && new URLSearchParams(window.location.search).get("replay") === "1");
      if (tape) {
        setTape(true);
        setDeskOpen(false);
      } else if (id !== "backtest") {
        setTape(false);
        setDeskOpen(true);
      }
      try {
        const { scenario, routes } = await api.scenario(id, ac.signal);
        const tls = await Promise.all(routes.map((r: RouteInfo) => api.timeline(id, r.id, ac.signal)));
        if (ac.signal.aborted) return;
        const snap: Record<string, RiskSnapshot[]> = {};
        routes.forEach((r: RouteInfo, i: number) => (snap[r.id] = tls[i]));
        const horizon = ms(scenario.now);
        const end = scenario.outcomeAt ? ms(scenario.fullEnd) : horizon;
        const top = [...routes].sort(
          (a, b) => (snapshotAt(snap[b.id], horizon)?.score ?? 0) - (snapshotAt(snap[a.id], horizon)?.score ?? 0)
        )[0];
        startTransition(() => {
          setScenario(scenario);
          setRoutes(routes);
          if (id !== "live") setLiveWeather(null);
          setSnapshots(snap);
          setRange({ start: ms(scenario.start), end, horizon, outcome: scenario.outcomeAt ? ms(scenario.outcomeAt) : undefined });
          setT(tape ? ms(scenario.start) : horizon);
          setSelectedId(top?.id ?? null);
          setPlaying(tape);
          setLoading(false);
        });
        window.history.replaceState(null, "", caseUrl(id, tape, window.location.search));
        if (id === "live") {
          api
            .liveWeather(ac.signal)
            .then((weather) => {
              if (!ac.signal.aborted) setLiveWeather(weather);
            })
            .catch((e) => {
              if (isAbortError(e) || ac.signal.aborted) return;
              setLiveWeather(null);
            });
        }
        if (top) autoAssess(id, top.id);
        refreshAudit(id);
      } catch (e) {
        if (isAbortError(e) || ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [autoAssess, refreshAudit, abortBackground]
  );

  useEffect(() => {
    const ac = new AbortController();
    api
      .scenarios(ac.signal)
      .then((list) => {
        if (ac.signal.aborted) return;
        const { id, tape } = caseFromSearch(window.location.search);
        const chosen = list.some((s) => s.id === id) ? id : (list[0]?.id ?? "live");
        return load(chosen, { tape: tape && chosen === "backtest" });
      })
      .catch((e) => {
        if (isAbortError(e) || ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    api
      .llm(ac.signal)
      .then((r) => {
        if (!ac.signal.aborted) setLlm(r.providers);
      })
      .catch((e) => {
        if (isAbortError(e)) return;
      });
    return () => {
      ac.abort();
      loadCtl.current?.abort();
      assessCtl.current.abort();
      runCtl.current?.abort();
      weatherCtl.current?.abort();
    };
  }, [load]);

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

  // timeline beats: short annotations only ("closure reported +0.30") — the map
  // popup carries the full citation; turning points stay terse (design.md)
  const shortSignal = (signal: string) => {
    const text = signal.split(" · ").slice(1).join(" · ");
    const cut = text.split(/[,;(]/)[0].trim();
    return cut.length > 26 ? `${cut.slice(0, 24).trimEnd()}…` : cut;
  };

  const snaps = useMemo(() => {
    const map = new Map<number, { t: number; label: string; delta: number }>();
    routes.forEach((r) =>
      inflections(snapshots[r.id] ?? []).forEach((n) => {
        if (!map.has(n.atMs)) map.set(n.atMs, { t: n.atMs, label: shortSignal(n.signal), delta: n.delta });
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
    const bits = selHorizon.citations.slice(-3).map((c) => c.text.split(/[—,(]/)[0].trim().toLowerCase());
    return bits.filter(Boolean).join(" · ");
  }, [selected, selHorizon]);

  const dismissCoach = useCallback(() => {
    setCoach(false);
    try {
      sessionStorage.setItem(DESK_KEY, "1");
    } catch {
      /* private mode — fine */
    }
  }, []);

  const seek = (ms: number) => {
    setT(ms);
    dismissCoach();
  };

  const step = (dir: 1 | -1) => {
    if (!snaps.length) return;
    const times = [...snaps.map((s) => s.t), ...(inevitableMs != null ? [inevitableMs] : [])].sort((a, b) => a - b);
    const k = dir === 1 ? times.find((x) => x > t) : [...times].reverse().find((x) => x < t);
    if (k != null) {
      setT(k);
      dismissCoach();
    }
  };

  // keep the rail populated when the officer switches route mid-review
  useEffect(() => {
    if (scenario && selectedId) autoAssess(scenario.id, selectedId);
  }, [scenario, selectedId, autoAssess]);

  const run = async () => {
    if (!scenario || !selected) return;
    runCtl.current?.abort();
    const ac = new AbortController();
    runCtl.current = ac;
    setRunning(true);
    setTraceLines([]);
    const key = assessmentKey(scenario.id, selected.id);
    try {
      const result = await api.assessStream(
        scenario.id,
        { routeId: selected.id, engine: llm.length ? "llm" : "scripted" },
        (tc) => {
          if (!ac.signal.aborted) setTraceLines((prev) => [...prev, tc]);
        },
        ac.signal
      );
      if (ac.signal.aborted) return;
      setAssessments((prev) => ({ ...prev, [key]: result }));
    } catch (e) {
      if (isAbortError(e) || ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!ac.signal.aborted) setRunning(false);
    }
  };
  const decide = async (d: "approved" | "rejected") => {
    dismissCoach();
    if (!selectedAssessment || !scenario) return;
    const { signal } = assessCtl.current;
    try {
      const result = await api.decide(selectedAssessment.id, d, undefined, signal);
      if (signal.aborted) return;
      setAssessments((prev) => ({ ...prev, [assessmentKey(scenario.id, result.routeId)]: result }));
      refreshAudit(scenario.id);
    } catch (e) {
      if (isAbortError(e) || signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // The lead time is computed from the illustrative replay timestamps.
  const revealText =
    scenario?.outcomeAt && scenario.outcome
      ? `reported closure · modeled lead time ${leadTimeLabel(scenario.now, scenario.outcomeAt)}`
      : undefined;

  // Scenario data arrives asynchronously, so keep the swap honest and direct rather
  // than animating an unchanged workspace before its new evidence is available.
  const compact = tape && !deskOpen;
  const revealed = range.outcome != null && t >= range.outcome;

  return (
    <main className={`mx-auto min-h-screen max-w-[1800px] p-3 sm:p-4 lg:p-5${running ? " reasoning-spotlight" : ""}`}>
      <header
        className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3"
        style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
      >
        <div className="min-w-0">
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            <Link href="/" transitionTypes={["nav-back"]} className="hover:underline" style={{ color: "inherit" }}>
              Bothy
            </Link>
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>
              {scenario ? (scenario.id === "backtest" ? "A66 Brough–Bowes" : "Lake District") : loading ? "Opening…" : "Bothy"}
            </h1>
            {scenario && (
              <span className="mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                {scenario.id === "backtest" ? "illustrative replay" : "operator view"}
              </span>
            )}
          </div>
          {!compact && scenario?.subtitle && (
            <p className="mt-0.5 text-sm" style={{ color: "var(--text-faint)" }}>
              {scenario.subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Watch room controls">
          <CaseSwitch
            current={scenario?.id ?? null}
            compact={compact}
            onSwitch={(id) => {
              void load(id, { tape: false });
            }}
          />
          {scenario?.id === "live" && (
            <button
              onClick={() => {
                weatherCtl.current?.abort();
                const ac = new AbortController();
                weatherCtl.current = ac;
                setRefreshingWeather(true);
                api
                  .refreshLiveWeather(ac.signal)
                  .then((weather) => {
                    if (!ac.signal.aborted) setLiveWeather(weather);
                  })
                  .catch((e) => {
                    if (isAbortError(e) || ac.signal.aborted) return;
                    setError(e instanceof Error ? e.message : String(e)); // last good snapshot retained
                  })
                  .finally(() => {
                    if (!ac.signal.aborted) setRefreshingWeather(false);
                  });
              }}
              disabled={refreshingWeather}
              className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96] disabled:opacity-50"
              style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
            >
              {refreshingWeather ? "Refreshing…" : "Refresh live context"}
            </button>
          )}
          {tape && (
            <button
              onClick={() => setDeskOpen((v) => !v)}
              className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
            >
              {deskOpen ? "Demo desk" : "Full desk"}
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

      {loading && routes.length === 0 ? (
        <WatchLoading embedded />
      ) : routes.length === 0 ? (
        <div className="grid h-[60vh] place-items-center">
          <div
            className="max-w-md rounded-lg border px-6 py-5 text-center"
            style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
          >
            <p className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>
              The watch room is empty.
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
              No scenario answered — is the agent running? Nothing is being watched, and nothing will be decided, until
              it returns.
            </p>
          </div>
        </div>
      ) : (
        <>
          {coach && (
            <DeskCoach
              tape={tape}
              backtest={scenario?.id === "backtest"}
              compact={compact}
              onDismiss={dismissCoach}
            />
          )}
          {!compact && headline && selHorizon && (
            <section
              className="stage-in mb-4 rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--rule)", background: "var(--panel)", ["--stage" as string]: 0 }}
            >
              <p className="max-w-5xl text-base leading-relaxed" style={{ color: "var(--text-body)" }}>
                <span className="font-semibold" style={{ color: riskColor(selHorizon.label) }}>
                  {selHorizon.label}
                </span>{" "}
                <span className="mono tnum">{selHorizon.score.toFixed(2)}</span>
                {headline ? ` — ${headline}` : ""}
              </p>
            </section>
          )}

          <div
            key={scenario?.id}
            className={`grid items-start gap-4 ${compact ? "xl:grid-cols-[minmax(160px,0.46fr)_minmax(0,2fr)_minmax(240px,0.78fr)]" : "xl:grid-cols-[minmax(220px,0.66fr)_minmax(0,1.8fr)_minmax(300px,0.88fr)]"}`}
          >
            <aside className="stage-in spot-dim order-2 xl:sticky xl:top-4 xl:order-1 xl:self-start" style={{ ["--stage" as string]: 1 }}>
              <section className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                    Routes
                    <span className="ml-2" style={{ color: "var(--text-body)" }}>
                      {at(t)}
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
                  onSelect={setSelectedId}
                  onHover={setHoverId}
                  fresh={at(t)}
                  compact={compact}
                  citations={selSnap?.citations}
                />
              </section>
            </aside>

            <section className="stage-in spot-dim order-1 min-w-0 space-y-4 xl:order-2" style={{ ["--stage" as string]: 0 }}>
              <section
                className="relative h-[470px] overflow-hidden rounded-lg border sm:h-[58vh] xl:h-[min(66vh,760px)]"
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
                  onSelect={setSelectedId}
                  cursorMs={t}
                  startMs={range.start}
                  endMs={range.end}
                  beats={mapBeats}
                  revealed={revealed}
                />
                {selected && selHorizon && (
                  <div
                    className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
                  >
                    <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                      {selected.name}
                    </p>
                    <p className="mono mt-1 text-xs" style={{ color: selColor }}>
                      {selHorizon.label} {selHorizon.score.toFixed(2)}
                    </p>
                  </div>
                )}
                {/* severity legend — colour + label, never colour alone */}
                <div
                  className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5"
                  style={{ borderColor: "var(--rule)", background: "color-mix(in oklch, var(--panel) 85%, transparent)" }}
                >
                  <span className="mono text-xs" style={{ color: "var(--text-faint)" }}>
                    risk at <span style={{ color: "var(--cursor)" }}>{at(t)}</span>
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
                  onSeek={seek}
                  onPrevStep={() => step(-1)}
                  onNextStep={() => step(1)}
                  series={series}
                  snaps={snaps}
                  inevitableMs={inevitableMs}
                  revealMs={range.outcome}
                  revealText={revealText}
                  playing={playing}
                  onTogglePlay={() => setPlaying((p) => !p)}
                />
                {(!compact || revealed) && scenario?.outcomeAt && scenario.outcome && (
                  <p className="mt-2 px-1 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
                    {scenario.outcome}
                  </p>
                )}
              </section>
            </section>

            <aside
              className="stage-in order-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:self-start"
              style={{ ["--stage" as string]: 3 }}
            >
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
                  compact={compact}
                  onRun={run}
                  onApprove={() => decide("approved")}
                  onReject={() => decide("rejected")}
                />
              </section>
            </aside>
          </div>

          <footer className="mono mt-4 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs" style={{ color: "var(--text-faint)" }}>
            <span>
              {scenario?.id === "live"
                ? `live context · map © OpenStreetMap`
                : "illustrative replay · modeled signals · map © OpenStreetMap"}
              {!compact && (llm.length ? ` · ${llm.map((p) => p.id).join(", ")}` : " · scripted")}
            </span>
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
