import type { IncidentRecord, RouteInfo, ScenarioId } from "../../../../packages/shared/src/types";

export interface SeedEvent {
  id: string; scenario: string; kind: "warning" | "forecast" | "road" | "incident";
  routeId: string | null; at: string; source: string; headline: string; detail: string; payload: Record<string, unknown>;
}
export interface ScenarioSeed { id: ScenarioId; title: string; subtitle: string; start: string; now: string; fullEnd: string; outcomeAt?: string; outcome?: string; }
export interface SeedBundle { scenarios: ScenarioSeed[]; routes: Record<string, RouteInfo[]>; events: SeedEvent[]; incidents: IncidentRecord[]; }

const t = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const td = (y: number, mo: number, d: number, h: number, m: number) => new Date(Date.UTC(y, mo - 1, d, h, m, 0)).toISOString();

// --- LIVE routes (Lake District) ---------------------------------------------------
const LIVE: RouteInfo[] = [
  { id: "r-A5094", name: "A5094 Seathwaite-Sty Head", region: "Borrowdale", lat: 54.49, lng: -3.18, coords: [[-3.1832, 54.4893], [-3.203, 54.46], [-3.28, 54.448]], lengthKm: 9.8, maxGradientPct: 12, maxElevationM: 393, exposure: 0.72, ploughed: false, hazards: ["snow", "ice"], actor: "Cumbria County Council - Winter Duty Officer" },
  { id: "r-B5311", name: "B5311 Wasdale Head Road", region: "Wasdale", lat: 54.45, lng: -2.89, coords: [[-3.0039, 54.4668], [-2.94, 54.43], [-2.78, 54.4744]], lengthKm: 18.4, maxGradientPct: 14, maxElevationM: 420, exposure: 0.95, ploughed: false, hazards: ["snow", "ice", "wind"], actor: "Cumbria County Council - Winter Duty Officer" },
  { id: "r-A66", name: "A66 Kirkby-in-Furness", region: "Lindale", lat: 54.38, lng: -3.0, coords: [[-3.1, 54.42], [-2.95, 54.41], [-2.85, 54.4]], lengthKm: 22.1, maxGradientPct: 3, maxElevationM: 120, exposure: 0.22, ploughed: true, hazards: ["ice", "flood"], actor: "Highways England (A66) Duty Officer" },
  { id: "r-B5285", name: "B5285 Coniston-Torver", region: "Coniston", lat: 54.42, lng: -2.86, coords: [[-2.96, 54.43], [-2.85, 54.44], [-2.78, 54.44]], lengthKm: 13.0, maxGradientPct: 7, maxElevationM: 210, exposure: 0.5, ploughed: false, hazards: ["snow", "ice"], actor: "Cumbria County Council - Winter Duty Officer" },
];

// --- BACKTEST routes (A66 Stainmore corridor) -------------------------------------
const BACK: RouteInfo[] = [
  { id: "r-A66", name: "A66 Brough-Bowes (Stainmore)", region: "Stainmore", lat: 54.55, lng: -2.44, coords: [[-2.705, 54.519], [-2.6, 54.545], [-2.49, 54.56], [-2.45, 54.582], [-2.36, 54.508], [-2.2, 54.52]], lengthKm: 34, maxGradientPct: 6, maxElevationM: 405, exposure: 0.85, ploughed: true, hazards: ["snow", "ice", "wind"], actor: "National Highways (A66) - Duty Officer" },
  { id: "r-B6276", name: "B6276 (Lartington-Barnard Castle)", region: "Teesdale", lat: 54.55, lng: -2.0, coords: [[-2.04, 54.55], [-2.0, 54.546], [-1.95, 54.54]], lengthKm: 8, maxGradientPct: 4, maxElevationM: 220, exposure: 0.5, ploughed: false, hazards: ["ice"], actor: "Durham County Council - Highways Officer" },
  { id: "r-A685", name: "A685 (Brough-Appleby)", region: "Eden Valley", lat: 54.55, lng: -2.5, coords: [[-2.52, 54.52], [-2.5, 54.55], [-2.5, 54.58]], lengthKm: 14, maxGradientPct: 3, maxElevationM: 190, exposure: 0.45, ploughed: true, hazards: ["ice"], actor: "Cumbria County Council - Winter Duty Officer" },
];

function liveBundle(): SeedBundle {
  const start = t(0, 0), now = t(14, 30);
  const E = (id: string, kind: SeedEvent["kind"], routeId: string | null, at: string, source: string, headline: string, detail: string, payload: Record<string, unknown>): SeedEvent => ({ id, scenario: "live", kind, routeId, at, source, headline, detail, payload });
  const events: SeedEvent[] = [
    E("W1", "warning", null, t(3, 10), "Met Office (Weather DataHub)", "AMBER warning - snow & severe blizzards", "Persistent snow, gusts to 70mph. Risk on exposed upland roads.", { level: "amber", hazards: ["snow", "wind"], validFrom: t(3, 10), validTo: t(20, 0) }),
    E("W2", "warning", null, t(7, 45), "Met Office Weather Warning", "YELLOW snow warning in force", "Further 5-10cm accumulation, icy patches on upland routes.", { level: "yellow", hazards: ["snow"], validFrom: t(7, 45), validTo: t(18, 0) }),
    E("F1", "forecast", null, t(6, 0), "Met Office forecast", "Overnight low -4C, 8cm fresh snow", "Ice on unsalted surfaces, snow lying to low levels.", { snowCm: 8, minTempC: -4 }),
    E("R1", "road", "r-A66", t(5, 30), "Cumbria CC road feed", "Plough & salt complete - A66", "Route treated and mostly clear, patrol out.", { roadKind: "plough-complete" }),
    E("R2", "road", "r-B5311", t(8, 20), "Cumbria CC / traffic feed", "B5311 blocked by deep drifts at Wasdale Head", "No plough scheduled today; traffic unable to pass.", { roadKind: "closure" }),
    E("R3", "road", "r-A5094", t(11, 5), "Highways patrol report", "Frost & icing on A5094, poor visibility", "Black ice at Sty Head; drivers struggling on gradient.", { roadKind: "report" }),
    E("I1", "incident", "r-A5094", t(12, 15), "MR incident log", "Walker assisted on Sty Head", "Minor - slipped on ice, no serious injury.", { severity: "minor" }),
  ];
  return { scenarios: [{ id: "live", title: "Live - Lake District, Winter Watch", subtitle: "Today · signals arriving over the last 14 hours", start, now, fullEnd: now }], routes: { live: LIVE }, events, incidents: [{ id: "inc-2018", scenario: "live", at: td(2018, 1, 14, 19, 40), routeId: "r-B5311", lat: 54.48, lng: -2.79, hazard: "snow", severity: "serious", narrative: "Jan 2018 blizzard: three vehicles stranded near Wasdale Head Inn; MR snow recovery (demo).", source: "MR incident archive (demo)" }] };
}

function backBundle(): SeedBundle {
  // ITV News reported that snow closed the A66 between Brough and Bowes on
  // 13 Feb 2026, with recovery support for stranded heavy vehicles. The replay
  // timeline, pre-closure signals, and model lead time below are illustrative.
  const start = td(2026, 2, 11, 0, 0);
  const now = td(2026, 2, 12, 21, 30);
  const E = (id: string, kind: SeedEvent["kind"], routeId: string | null, at: string, source: string, headline: string, detail: string, payload: Record<string, unknown>): SeedEvent => ({ id, scenario: "backtest", kind, routeId, at, source, headline, detail, payload });
  const events: SeedEvent[] = [
    E("W1", "warning", null, td(2026, 2, 11, 18, 0), "Illustrative Met Office-style demo signal", "YELLOW - snow & ice, north England", "Illustrative precursor signal for replay; not a historical warning record.", { level: "yellow", hazards: ["snow", "ice"], validFrom: td(2026, 2, 12, 4, 0), validTo: td(2026, 2, 13, 17, 0) }),
    E("F1", "forecast", null, td(2026, 2, 12, 9, 0), "Illustrative forecast input", "Snow and sub-zero temperatures on Stainmore", "Illustrative forecast values for the risk-model demonstration; not a historical forecast record.", { snowCm: 18, minTempC: -7 }),
    E("R1", "road", "r-A66", td(2026, 2, 12, 19, 30), "Illustrative highway-operations signal", "A66 Stainmore - drifting snow", "Illustrative pre-closure road signal used to demonstrate the replay.", { roadKind: "disruption" }),
    E("R2", "road", "r-A66", td(2026, 2, 12, 23, 40), "ITV News, 13 Feb 2026", "Reported A66 closure due to snow", "The A66 was reported closed in both directions between Brough and Bowes because of heavy snow. Display time is illustrative.", { roadKind: "closure" }),
    E("R3", "road", "r-A66", td(2026, 2, 13, 14, 0), "ITV News, 13 Feb 2026", "Reported A66 reopening", "The route was later reported reopened. Display time is illustrative.", { roadKind: "report" }),
  ];
  return {
    scenarios: [{
      id: "backtest",
      title: "Backtest - A66 Brough-Bowes, 12-13 Feb 2026",
      subtitle: "Illustrative replay based on a reported A66 snow closure; agent sees modeled pre-closure signals only",
      start, now,
      fullEnd: td(2026, 2, 13, 18, 0),
      outcomeAt: td(2026, 2, 12, 23, 40),
      outcome: "Reported outcome: the A66 closed between Brough and Bowes because of snow and recovery crews assisted stranded heavy vehicles (ITV News, 13 Feb 2026). Replay times, precursor signals, and the modeled lead time are illustrative.",
    }],
    routes: { backtest: BACK },
    events,
    incidents: [{ id: "inc-stainmore", scenario: "backtest", at: td(2020, 2, 17, 6, 0), routeId: "r-A66", lat: 54.56, lng: -2.44, hazard: "snow", severity: "serious", narrative: "Illustrative historic snow-disruption pattern used for risk scoring; not a historical incident record.", source: "Demo data" }],
  };
}

/** Demo data for a synthetic live scenario and an illustrative A66 replay. */
export function buildBundle(): SeedBundle {
  const live = liveBundle();
  const back = backBundle();
  return {
    scenarios: [...live.scenarios, ...back.scenarios],
    routes: { live: live.routes.live, backtest: back.routes.backtest },
    events: [...live.events, ...back.events],
    incidents: [...live.incidents, ...back.incidents],
  };
}
