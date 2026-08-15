"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { type MapBeat, type RouteOnMap } from "../components/MapView";
import Timeline, { type Series } from "../components/Timeline";
import RiskList, { type RiskRow } from "../components/RiskList";
import Detail from "../components/Detail";
import { api } from "../lib/api";
import { inflections, leadTimeLabel, ms, pointAt, riskColor, snapshotAt } from "../lib/derive";
import type {
  Assessment,
  AuditEntry,
  RiskLabel,
  RiskSnapshot,
  RouteInfo,
  ScenarioId,
  ScenarioInfo,
} from "../../../packages/shared/src/types";

export default function Home() {
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [llm, setLlm] = useState<{ id: string; label: string; model: string }[]>([]);

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
  const selectedAssessment = scenario && selectedId ? assessments[assessmentKey(scenario.id, selectedId)] ?? null : null;
  const selSnap = selected ? snapshotAt(snapshots[selected.id] ?? [], t) : undefined;
  const selHorizon = selected ? snapshotAt(snapshots[selected.id] ?? [], range.horizon) : undefined;
  const selColor = selHorizon ? riskColor(selHorizon.label) : "var(--text-faint)";

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
    const times = snaps.map((s) => s.t);
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
    try {
      const result = await api.assess(scenario.id, { routeId: selected.id, force: true });
      setAssessments((prev) => ({ ...prev, [assessmentKey(scenario.id, selected.id)]: result }));
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
    <main className="min-h-screen p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Bothy · Winter Watch
          </p>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-strong)" }}>
            {scenario?.title ?? (loading ? "Loading…" : "Bothy")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {(["live", "backtest"] as const).map((id) => (
            <button
              key={id}
              onClick={() => load(id)}
              className="rounded-lg border px-3 py-1 text-sm transition-colors"
              style={
                scenario?.id === id
                  ? { borderColor: "var(--text-strong)", color: "var(--text-strong)" }
                  : { borderColor: "var(--rule)", color: "var(--text-body)" }
              }
            >
              {id === "live" ? "Live" : "Backtest"}
            </button>
          ))}
          <button
            onClick={() => setPlaying((p) => !p)}
            className="rounded-lg border px-3 py-1 text-sm transition-transform active:scale-[0.96]"
            style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
          >
            {playing ? "Pause" : "Replay day"}
          </button>
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
            <p className="mb-3 max-w-3xl text-base leading-relaxed" style={{ color: "var(--text-body)" }}>
              <span className="font-semibold" style={{ color: selHorizon ? riskColor(selHorizon.label) : undefined }}>
                {selHorizon?.label}
              </span>{" "}
              <span className="mono tnum">{selHorizon?.score.toFixed(2)}</span> — {headline}
            </p>
          )}

          {/* the scrubber is the mechanism — it gets the full width, above the fold */}
          <div className="mb-4">
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
              revealMs={range.outcome}
              revealText={revealText}
            />
            {scenario?.outcomeAt && scenario.outcome && (
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
                {scenario.outcome}
              </p>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
            <aside className="order-2 space-y-4 lg:order-1">
              <RiskList rows={rows} selectedId={selectedId} onSelect={setSelectedId} fresh={at(t)} />
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
                llmAvailable={llm.length > 0}
                onRun={run}
                onApprove={() => decide("approved")}
                onReject={() => decide("rejected")}
              />
            </aside>

            <section
              className="order-1 relative h-[56vh] overflow-hidden rounded-lg border lg:order-2"
              style={{ borderColor: "var(--rule)" }}
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
            </section>
          </div>

          <footer className="mono mt-4 flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-faint)" }}>
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
