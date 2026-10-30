"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Beat } from "../../components/Timeline";
import type { RiskRow } from "../../components/RiskList";
import Detail from "../../components/Detail";
import DeskCoach, { DESK_KEY } from "../../components/DeskCoach";
import IntakeLegend from "../../components/IntakeLegend";
import NextDoors from "../../components/NextDoors";
import RoadIngest from "../../components/RoadIngest";
import Inspector from "../../components/Inspector";
import ReliabilityPanel, { type ChainHealth } from "../../components/ReliabilityPanel";
import WatchMyRoad from "../../components/WatchMyRoad";
import WatchBackdrop from "../../components/WatchBackdrop";
import WatchLoading from "../../components/WatchLoading";
import WatchRoutesRail from "../../components/WatchRoutesRail";
import WatchFooter from "../../components/WatchFooter";
import WatchErrorBanner from "../../components/WatchErrorBanner";
import WatchEmptyState from "../../components/WatchEmptyState";
import WatchStoryStrip from "../../components/WatchStoryStrip";
import WatchMapStage from "../../components/WatchMapStage";
import { CaseSwitch } from "../../components/CaseList";
import { caseFromSearch, caseUrl, type CaseId } from "../../lib/cases";
import { api, isAbortError } from "../../lib/api";
import { causalHeadline, firstCrossed, inflections, KIND_LABEL, leadTimeLabel, ms, riskColor, riskTextColor, snapshotAt, sourceShort } from "../../lib/derive";
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
  const [llmHealth, setLlmHealth] = useState<ChainHealth | null>(null);
  const [rehearsing, setRehearsing] = useState(false);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherResponse | null>(null);
  const [refreshingWeather, setRefreshingWeather] = useState(false);
  const [deskOpen, setDeskOpen] = useState(true);
  const [tape, setTape] = useState(false);
  const [coach, setCoach] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [subsCount, setSubsCount] = useState(0);

  const loadCtl = useRef<AbortController | null>(null);
  const assessCtl = useRef(new AbortController());
  const runCtl = useRef<AbortController | null>(null);
  const weatherCtl = useRef<AbortController | null>(null);
  // The last case the room tried to open — error/empty states retry against it.
  const lastCase = useRef<CaseId>("live");
  // Chain health is scenario-independent, so the probe lives outside
  // assessCtl — a case load must not cancel it. The rehearsal does write
  // per-case assessments, so it is aborted on case switch like the others.
  const probeCtl = useRef<AbortController | null>(null);
  const rehearseCtl = useRef<AbortController | null>(null);

  const abortBackground = useCallback(() => {
    assessCtl.current.abort();
    assessCtl.current = new AbortController();
    runCtl.current?.abort();
    runCtl.current = null;
    weatherCtl.current?.abort();
    weatherCtl.current = null;
    rehearseCtl.current?.abort();
    rehearseCtl.current = null;
    setRunning(false);
    setRehearsing(false);
    setRefreshingWeather(false);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("replay") === "1") {
      setTape(true);
      setDeskOpen(false);
    }
    try {
      if (q.get("replay") !== "1" && sessionStorage.getItem(DESK_KEY) !== "1") setCoach(true);
    } catch {
      if (q.get("replay") !== "1") setCoach(true);
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
    async (id: CaseId, opts?: { tape?: boolean; tMs?: number; selectedId?: string }) => {
      loadCtl.current?.abort();
      const ac = new AbortController();
      loadCtl.current = ac;
      abortBackground();
      assessed.current.clear();

      setError(null);
      setLoading(true);
      lastCase.current = id;
      setScenario(null);
      setRoutes([]);
      setAssessments({});
      setAudit([]);
      setPlaying(false);
      const fromUrl = caseFromSearch(window.location.search);
      const tape = opts?.tape ?? (id === "backtest" && fromUrl.tape);
      const tMs = opts?.tMs ?? fromUrl.tMs;
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
        const start = ms(scenario.start);
        const horizon = ms(scenario.now);
        const end = scenario.outcomeAt ? ms(scenario.fullEnd) : horizon;
        const top = [...routes].sort(
          (a, b) => (snapshotAt(snap[b.id], horizon)?.score ?? 0) - (snapshotAt(snap[a.id], horizon)?.score ?? 0)
        )[0];
        const cursor = tMs != null && tMs >= start && tMs <= end ? tMs : tape ? start : horizon;
        let listed: Assessment[] = [];
        try {
          listed = await api.assessments(id, ac.signal);
        } catch (e) {
          if (isAbortError(e) || ac.signal.aborted) return;
        }
        if (ac.signal.aborted) return;
        const prior: Record<string, Assessment> = {};
        for (const a of listed) {
          const key = assessmentKey(id, a.routeId);
          if (prior[key]) continue;
          prior[key] = a;
          assessed.current.add(key);
        }
        startTransition(() => {
          setScenario(scenario);
          setRoutes(routes);
          if (id !== "live") setLiveWeather(null);
          setSnapshots(snap);
          setRange({ start, end, horizon, outcome: scenario.outcomeAt ? ms(scenario.outcomeAt) : undefined });
          setT(cursor);
          setSelectedId(opts?.selectedId && routes.some((r) => r.id === opts.selectedId) ? opts.selectedId : (top?.id ?? null));
          setAssessments(prior);
          setPlaying(tape && cursor <= start);
          setLoading(false);
        });
        if (top) autoAssess(id, top.id);
        refreshAudit(id);
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
        const { id, tape, tMs } = caseFromSearch(window.location.search);
        const chosen = list.some((s) => s.id === id) ? id : (list[0]?.id ?? "live");
        return load(chosen, { tape: tape && chosen === "backtest", tMs });
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

  useEffect(() => {
    if (!scenario) return;
    const id = window.setTimeout(() => {
      window.history.replaceState(null, "", caseUrl(scenario.id, tape, t));
    }, 400);
    return () => window.clearTimeout(id);
  }, [scenario, tape, t]);

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

  // timeline beats: kind + source so arriving reports read as a feed, not anonymous ticks
  const snaps = useMemo<Beat[]>(() => {
    const map = new Map<number, { t: number; label: string; delta: number }>();
    routes.forEach((r) =>
      inflections(snapshots[r.id] ?? []).forEach((n) => {
        if (!map.has(n.atMs)) {
          map.set(n.atMs, {
            t: n.atMs,
            label: `${KIND_LABEL[n.kind]} · ${sourceShort(n.source, 18)}`,
            delta: n.delta,
          });
        }
      })
    );
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [routes, snapshots]);

  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const selectedAssessment = scenario && selectedId ? assessments[assessmentKey(scenario.id, selectedId)] ?? null : null;

  // Room posture — the Night Watch: the room is *quiet* until a corridor is a
  // real decision (ELEVATED/HIGH at the scrub cursor), then it wakes. This is
  // the brief rendered as behaviour ("runs quietly, surfaces on a real call").
  const wakeRows = rows.filter((r) => r.label === "ELEVATED" || r.label === "HIGH");
  const awake = wakeRows.length > 0;
  const wakeCount = wakeRows.length;

  // Lead-time hero: when a sourced outcome exists, "flagged X before the closure"
  // is the impact number a judge remembers. Data-true from the route's own tape.
  const leadText = useMemo<string | undefined>(() => {
    if (!scenario?.outcomeAt || !selected) return undefined;
    const first = firstCrossed(snapshots[selected.id] ?? [], ms(scenario.start));
    if (!first || ms(first.at) > ms(scenario.outcomeAt)) return undefined;
    return leadTimeLabel(first.at, scenario.outcomeAt);
  }, [scenario, selected, snapshots]);
  const selSnap = selected ? snapshotAt(snapshots[selected.id] ?? [], t) : undefined;
  const selHorizon = selected ? snapshotAt(snapshots[selected.id] ?? [], range.horizon) : undefined;
  const selColor = selHorizon ? riskTextColor(selHorizon.label) : "var(--text-faint)";

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

  const overlaySnap = selSnap ?? selHorizon;
  const overlayColor = overlaySnap ? riskTextColor(overlaySnap.label) : "var(--text-faint)";

  // money shot: a causal sentence from the heaviest reports + terrain, numbers beside it
  const headline = selected && overlaySnap ? causalHeadline(selected, overlaySnap) : null;

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

  const togglePlay = useCallback(() => {
    if (range.end <= range.start) return;
    // Playing from the end of the tape restarts it — otherwise a cursor parked
    // at fullEnd (the flood case opens there) makes play a no-op that reads as
    // a stuck control.
    if (!playing && t >= range.end) setT(range.start);
    setPlaying((p) => !p);
  }, [playing, range.end, range.start, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName ?? "";
      const textLike =
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (tag === "INPUT" && (el as HTMLInputElement).type !== "range") ||
        Boolean(el?.isContentEditable);
      if (textLike) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (tag === "INPUT") return; // the rail steps beats itself
        e.preventDefault();
        step(e.key === "ArrowRight" ? 1 : -1);
      } else if (e.key === " ") {
        if (tag === "BUTTON" || tag === "A") return; // native activation owns space there
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // keep the rail populated when the officer switches route mid-review
  useEffect(() => {
    if (scenario && selectedId) autoAssess(scenario.id, selectedId);
  }, [scenario, selectedId, autoAssess]);

  // Roadmap §1: probe the provider chain once when the room opens, so the
  // reliability surface is populated at first paint. The probe survives case
  // switches (health is not per-case), so it owns its controller.
  const probeChain = useCallback(() => {
    probeCtl.current?.abort();
    const ac = new AbortController();
    probeCtl.current = ac;
    const { signal } = ac;
    api
      .llmHealth(signal)
      .then((h) => {
        if (!signal.aborted) setLlmHealth(h);
      })
      .catch((e) => {
        if (isAbortError(e)) return;
      });
  }, []);

  useEffect(() => {
    probeChain();
    return () => probeCtl.current?.abort();
  }, [probeChain]);

  // Community pulse: how many neighbours are on watch across the room. Puts a
  // live, honest user count on screen (Good Neighbor proof + video evidence).
  useEffect(() => {
    const ac = new AbortController();
    api
      .subscriptionCount(ac.signal)
      .then(({ count }) => {
        if (!ac.signal.aborted) setSubsCount(count);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [scenario?.id]);

  // Roadmap §1: rehearse the scripted fallback — force engine "llm" with
  // rehearseFallback, which skips the provider chain and runs the scripted
  // brain, proving the failsafe produces a valid assessment.
  const rehearseFallback = async () => {
    if (!scenario || !selected) return;
    setRehearsing(true);
    setError(null);
    const ac = new AbortController();
    rehearseCtl.current = ac;
    const key = assessmentKey(scenario.id, selected.id);
    try {
      const result = await api.rehearseFallback(scenario.id, { routeId: selected.id }, ac.signal);
      if (!ac.signal.aborted) {
        setAssessments((prev) => ({ ...prev, [key]: result }));
        setTraceLines((result.toolTrace as ToolCall[]) ?? []);
      }
    } catch (e) {
      if (isAbortError(e)) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (rehearseCtl.current === ac) {
        rehearseCtl.current = null;
        setRehearsing(false);
      }
    }
  };

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
  const decide = async (d: "approved" | "rejected", officer: string) => {
    dismissCoach();
    if (!selectedAssessment || !scenario || !officer.trim()) return;
    const { signal } = assessCtl.current;
    try {
      const result = await api.decide(selectedAssessment.id, d, { actor: officer.trim() }, signal);
      if (signal.aborted) return;
      setAssessments((prev) => ({ ...prev, [assessmentKey(scenario.id, result.routeId)]: result }));
      refreshAudit(scenario.id);
      setDeskOpen(true);
    } catch (e) {
      if (isAbortError(e) || signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const landRoad = async (input: {
    routeId: string;
    roadKind: string;
    headline: string;
    source: string;
    actor: string;
  }) => {
    if (!scenario || scenario.id !== "live") return;
    setIngesting(true);
    setError(null);
    try {
      await api.ingestRoad(input);
      assessed.current.delete(assessmentKey("live", input.routeId));
      await load("live", { tape: false, selectedId: input.routeId });
      const fresh = await api.assess("live", { routeId: input.routeId, engine: "scripted", force: true });
      assessed.current.add(assessmentKey("live", input.routeId));
      setAssessments((prev) => ({ ...prev, [assessmentKey("live", input.routeId)]: fresh }));
      refreshAudit("live");
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    } finally {
      setIngesting(false);
    }
  };

  // The lead time is computed from the illustrative replay timestamps.
  const revealText =
    scenario?.outcomeAt && scenario.outcome
      ? `reported closure · modeled lead time ${leadTimeLabel(scenario.now, scenario.outcomeAt)}`
      : undefined;

  // Three cases share the watch room. The swap button cycles to the next wedge:
  // live → backtest → flood → live, so the generalization proof is one click away.
  const swapTarget: { id: CaseId; tape: boolean; label: string } =
    scenario?.id === "live"
      ? { id: "backtest", tape: true, label: "Rewind the A66" }
      : scenario?.id === "backtest"
        ? { id: "flood", tape: false, label: "Open the flood wedge" }
        : { id: "live", tape: false, label: "Sit the Lake District desk" };

  // Scenario data arrives asynchronously, so keep the swap honest and direct rather
  // than animating an unchanged workspace before its new evidence is available.
  const compact = tape && !deskOpen;
  const revealed = range.outcome != null && t >= range.outcome;
  const signed = selectedAssessment != null && selectedAssessment.status !== "pending";
  const tapeEnded = tape && !playing && range.end > 0 && t >= range.end;
  const showStory = !compact || !playing;
  const nextBeat: "tape-end" | "signed" | null = signed ? "signed" : tapeEnded ? "tape-end" : null;
  const pendingOther = rows.find((r) => {
    if (r.routeId === selectedId || !scenario) return false;
    const a = assessments[`${scenario.id}:${r.routeId}`];
    return !a || a.status === "pending";
  });

  return (
    <>
      <WatchBackdrop caseId={scenario?.id ?? (tape ? "backtest" : "live")} />
      <main className={`relative z-10 mx-auto min-h-screen max-w-[1800px] p-3 sm:p-4 lg:p-6 xl:p-8${running ? " reasoning-spotlight" : ""}${awake && !running ? " awake-spotlight" : ""}`}>
      <a
        href="#decision-case"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:border focus:px-3 focus:py-2 focus:text-sm"
        style={{ borderColor: "var(--cursor)", background: "var(--panel)", color: "var(--text-strong)" }}
      >
        Skip to the decision case
      </a>
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
              {scenario ? (scenario.id === "backtest" ? "A66 Brough–Bowes" : scenario.id === "flood" ? "Eden Valley flood" : "Lake District") : loading ? "Opening…" : "Bothy"}
            </h1>
            {scenario && (
              <span className="mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                {scenario.id === "backtest" ? "illustrative replay" : scenario.id === "flood" ? "seeded flood replay · not live" : "operator view"}
              </span>
            )}
          </div>
          {scenario?.id === "flood" && <div className="record-status mt-2"><span>Seeded training signals</span><span>Not live gauges</span><span>Not validated prevention</span></div>}
          {!compact && scenario?.subtitle && (
            <p className="context-note mt-2">{scenario.subtitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Watch room controls">
          <Link href="/defense" className="rounded-lg border px-3 py-1.5 text-sm underline" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
            Defence workspace
          </Link>
          {awake ? (
            <span
              className="mono rounded-lg border px-2.5 py-1 text-xs uppercase tracking-wider"
              style={{ borderColor: "oklch(64% 0.21 25)", color: "oklch(80% 0.06 25)", background: "oklch(64% 0.21 25 / 0.12)" }}
            >
              {wakeCount} corridor{wakeCount === 1 ? "" : "s"} need{wakeCount === 1 ? "s" : ""} a hand
            </span>
          ) : (
            <span
              className="mono resting rounded-lg border px-2.5 py-1 text-xs uppercase tracking-wider"
              style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}
            >
              all quiet · watching {rows.length} corridors
            </span>
          )}
          {subsCount > 0 && (
            <span className="mono rounded-lg border px-2.5 py-1 text-xs uppercase tracking-wider" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
              {subsCount} neighbour{subsCount === 1 ? "" : "s"} on watch
            </span>
          )}
          {!compact && (
            <CaseSwitch
              current={scenario?.id ?? null}
              compact={compact}
              onSwitch={(id) => {
                void load(id, { tape: false });
              }}
            />
          )}
          {scenario?.id === "live" && !compact && (
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
          {tape && !deskOpen && !playing && (
            <button
              onClick={() => setDeskOpen(true)}
              className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
            >
              Open desk
            </button>
          )}
          {tape && deskOpen && (
            <button
              onClick={() => setDeskOpen(false)}
              className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
            >
              Cinema view
            </button>
          )}
        </div>
      </header>

      {error && <WatchErrorBanner error={error} onRetry={() => void load(lastCase.current)} />}

      {loading && routes.length === 0 ? (
        <WatchLoading embedded />
      ) : routes.length === 0 ? (
        <WatchEmptyState onRetry={() => void load(lastCase.current)} />
      ) : (
        <>
          {coach && !tape && (
            <DeskCoach
              tape={tape}
              backtest={scenario?.id === "backtest"}
              compact={compact}
              onDismiss={dismissCoach}
            />
          )}
          <IntakeLegend caseId={scenario?.id ?? null} compact={compact} />
          {scenario?.id === "live" && !compact && (
            <ReliabilityPanel
              health={llmHealth}
              rehearsing={rehearsing}
              onProbe={probeChain}
              onRehearse={() => void rehearseFallback()}
            />
          )}
          {scenario?.id === "live" && !compact && (
            <div className="mb-4"><Inspector label="Add road evidence" title="Operator road report"><RoadIngest routes={routes} selectedId={selectedId} busy={ingesting} onSubmit={landRoad} /></Inspector></div>
          )}
          {selected && !compact && (
            <WatchMyRoad routeId={selected.id} routeName={selected.name} scenario={scenario?.id ?? "live"} />
          )}
          {nextBeat && (
            <NextDoors
              beat={nextBeat}
              compact={compact}
              otherHill={swapTarget.label}
              pendingName={nextBeat === "signed" ? pendingOther?.name : undefined}
              onRewind={() => {
                setPlaying(false);
                setT(range.start);
              }}
              onSign={
                nextBeat === "tape-end"
                  ? () => {
                      setDeskOpen(true);
                      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                      requestAnimationFrame(() => {
                        document.getElementById("decision-case")?.scrollIntoView({
                          block: "nearest",
                          behavior: reduced ? "auto" : "smooth",
                        });
                        document.getElementById("approve-gate")?.focus();
                      });
                    }
                  : undefined
              }
              onOtherHill={() => {
                void load(swapTarget.id, { tape: swapTarget.tape });
              }}
              onNextCorridor={pendingOther ? () => setSelectedId(pendingOther.routeId) : undefined}
            />
          )}
          {showStory && selected && headline && overlaySnap && (
            <WatchStoryStrip name={selected.name} snap={overlaySnap} color={overlayColor} headline={headline} />
          )}

          <div
            key={scenario?.id}
            className={`grid items-start gap-4 ${compact ? "xl:grid-cols-[minmax(160px,0.46fr)_minmax(0,2fr)_minmax(240px,0.78fr)]" : "xl:grid-cols-[minmax(220px,0.66fr)_minmax(0,1.8fr)_minmax(300px,0.88fr)]"}`}
          >
          {/* Mobile below xl: map -> decision -> routes, so the call-to-action
              sits one swipe under the instrument instead of after two tall rails.
              Desktop xl keeps priority | map+replay | decision (docs/design.md). */}
            <WatchRoutesRail
              rows={rows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onHover={setHoverId}
              fresh={at(t)}
              compact={compact}
              citations={selSnap?.citations}
            />

            <WatchMapStage
              scenario={scenario}
              routes={routes}
              snapshots={snapshots}
              t={t}
              range={range}
              revealed={revealed}
              selectedId={selectedId}
              hoverId={hoverId}
              onSelect={setSelectedId}
              selected={selected}
              overlaySnap={overlaySnap}
              overlayColor={overlayColor}
              compact={compact}
              liveWeather={liveWeather}
              snaps={snaps}
              inevitableMs={inevitableMs}
              revealText={revealText}
              playing={playing}
              onSeek={seek}
              onPrevStep={() => step(-1)}
              onNextStep={() => step(1)}
              onTogglePlay={togglePlay}
            />

            <aside
              aria-label="Decision case"
              className="stage-in order-2 xl:order-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:self-start"
              style={{ ["--stage" as string]: 3 }}
            >
              <section id="decision-case" className="rounded-lg border p-4" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
                <Detail
                  route={selected}
                  horizon={selHorizon}
                  horizonTime={at(range.horizon)}
                  color={selColor}
                  cursorCitations={selSnap?.citations ?? []}
                  cursorTime={at(t)}
                  assessment={selectedAssessment}
                  audit={audit}
                  running={running}
                  traceLines={traceLines}
                  llmAvailable={llm.length > 0}
                  compact={compact}
                  awake={awake}
                  lead={leadText}
                  onRun={run}
                  onApprove={(officer) => void decide("approved", officer)}
                  onReject={(officer) => void decide("rejected", officer)}
                />
              </section>
            </aside>
          </div>

          <WatchFooter scenarioId={scenario?.id} compact={compact} providers={llm} />
        </>
      )}
    </main>
    </>
  );
}

const at = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
