import type { IncidentRecord, RouteInfo, ScenarioId } from "../../../../packages/shared/src/types";

export interface SeedEvent {
  id: string; scenario: string; kind: "warning" | "forecast" | "road" | "incident" | "traffic";
  routeId: string | null; at: string; source: string; headline: string; detail: string; payload: Record<string, unknown>;
}
export interface ScenarioSeed { id: ScenarioId; title: string; subtitle: string; start: string; now: string; fullEnd: string; outcomeAt?: string; outcome?: string; }
export interface SeedBundle { scenarios: ScenarioSeed[]; routes: Record<string, RouteInfo[]>; events: SeedEvent[]; incidents: IncidentRecord[]; }

const td = (y: number, mo: number, d: number, h: number, m: number) => new Date(Date.UTC(y, mo - 1, d, h, m, 0)).toISOString();

function atToday(h: number, m: number, wall: Date) {
  const d = new Date(wall);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function midnight(wall: Date) {
  const d = new Date(wall);
  d.setHours(0, 0, 0, 0);
  return d;
}

function clockLabel(wall: Date) {
  return `${String(wall.getHours()).padStart(2, "0")}:${String(wall.getMinutes()).padStart(2, "0")}`;
}

/** Live desk clock: today 00:00 → wall time. Signals are today's clock, not a frozen 14:30. */
export function liveDay(wall = new Date()) {
  const start = midnight(wall).toISOString();
  const now = wall.toISOString();
  const t = (h: number, m: number) => atToday(h, m, wall);
  const E = (id: string, kind: SeedEvent["kind"], routeId: string | null, at: string, source: string, headline: string, detail: string, payload: Record<string, unknown>): SeedEvent =>
    ({ id, scenario: "live", kind, routeId, at, source, headline, detail, payload });
  const events: SeedEvent[] = [
    E("W1", "warning", null, t(3, 10), "Met Office (Weather DataHub)", "AMBER warning - snow & severe blizzards", "Persistent snow, gusts to 70mph. Risk on exposed upland roads.", { level: "amber", hazards: ["snow", "wind"], validFrom: t(3, 10), validTo: t(20, 0) }),
    E("W2", "warning", null, t(7, 45), "Met Office Weather Warning", "YELLOW snow warning in force", "Further 5-10cm accumulation, icy patches on upland routes.", { level: "yellow", hazards: ["snow"], validFrom: t(7, 45), validTo: t(18, 0) }),
    E("F1", "forecast", null, t(6, 0), "Met Office forecast", "Overnight low -4C, 8cm fresh snow", "Ice on unsalted surfaces, snow lying to low levels.", { snowCm: 8, minTempC: -4 }),
    E("R1", "road", "r-A66", t(5, 30), "Cumbria CC road feed", "Plough & salt complete - A66", "Route treated and mostly clear, patrol out.", { roadKind: "plough-complete" }),
    E("R2", "road", "r-B5311", t(8, 20), "Cumbria CC / traffic feed", "B5311 blocked by deep drifts at Wasdale Head", "No plough scheduled today; traffic unable to pass.", { roadKind: "closure" }),
    E("R3", "road", "r-A5094", t(11, 5), "Highways patrol report", "Frost & icing on A5094, poor visibility", "Black ice at Sty Head; drivers struggling on gradient.", { roadKind: "report" }),
    E("I1", "incident", "r-A5094", t(12, 15), "MR incident log", "Walker assisted on Sty Head", "Minor - slipped on ice, no serious injury.", { severity: "minor" }),
  ];
  return {
    start,
    now,
    fullEnd: now,
    subtitle: `Today · desk at ${clockLabel(wall)} · signals since midnight`,
    events,
    routes: LIVE,
    incidents: [{ id: "inc-2018", scenario: "live" as const, at: td(2018, 1, 14, 19, 40), routeId: "r-B5311", lat: 54.48, lng: -2.79, hazard: "snow" as const, severity: "serious" as const, narrative: "Jan 2018 blizzard: three vehicles stranded near Wasdale Head Inn; MR snow recovery (demo).", source: "MR incident archive (demo)" }],
  };
}

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
  const day = liveDay();
  return {
    scenarios: [{ id: "live", title: "Live - Lake District, Winter Watch", subtitle: day.subtitle, start: day.start, now: day.now, fullEnd: day.fullEnd }],
    routes: { live: day.routes },
    events: day.events,
    incidents: day.incidents,
  };
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
    // Roadmap §3: traffic-speed collapse — a new timeline beat that arrives
    // before the closure report. Speeds fall on the pass before anyone files a
    // closure, sharpening the lead-time story ("speeds fell at 18:40; closure
    // reported 23:40").
    E("T1", "traffic", "r-A66", td(2026, 2, 12, 18, 40), "National Highways sensor feed (DfT)", "A66 Stainmore - speeds collapsed", "Illustrative traffic-speed drop: average speed fell from 60 km/h to 18 km/h (70% drop) as snow accumulated, ~5h before the reported closure.", { speedKph: 18, dropPct: 0.7, normalKph: 60 }),
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

// --- FLOOD routes (roadmap §2: Environment Agency river-gauge scenario) -----------
// Same SignalEvent contract, different wedge. River-gauge levels (forecast-
// shaped) precede flood warnings (warning) and road closures (road) on flood-
// prone routes. One "same ledger, different wedge" scenario converts the
// generalization claim into evidence.
const FLOOD: RouteInfo[] = [
  { id: "r-A6108", name: "A6108 (Appleby-Brough, Eden crossing)", region: "Eden Valley", lat: 54.58, lng: -2.49, coords: [[-2.52, 54.57], [-2.49, 54.58], [-2.45, 54.59], [-2.42, 54.58]], lengthKm: 11, maxGradientPct: 2, maxElevationM: 130, exposure: 0.78, ploughed: false, hazards: ["flood"], actor: "Cumbria County Council - Flood Duty Officer" },
  { id: "r-B6277", name: "B6277 (Osmotherley flood plain)", region: "Tees Valley", lat: 54.49, lng: -1.18, coords: [[-1.22, 54.49], [-1.18, 54.48], [-1.14, 54.49]], lengthKm: 8, maxGradientPct: 3, maxElevationM: 95, exposure: 0.88, ploughed: false, hazards: ["flood", "wind"], actor: "North Yorkshire CC - Flood Duty Officer" },
  { id: "r-A685", name: "A685 (Brough-Kirkby Stephen, river bend)", region: "Eden Valley", lat: 54.54, lng: -2.38, coords: [[-2.42, 54.54], [-2.38, 54.55], [-2.34, 54.53]], lengthKm: 9, maxGradientPct: 2, maxElevationM: 110, exposure: 0.55, ploughed: true, hazards: ["flood"], actor: "Cumbria County Council - Flood Duty Officer" },
];

function floodBundle(): SeedBundle {
  // Illustrative Environment Agency-style flood scenario. River-gauge readings
  // (free EA API, report-shaped) drop into the same SignalEvent ledger as the
  // winter wedge. The agent sees rising levels before the flood warning, then
  // the warning, then the road closure — the same detect→retrieve→reason→
  // recommend→act loop over a different hazard.
  const start = td(2026, 2, 12, 0, 0);
  const now = td(2026, 2, 12, 16, 0);
  const E = (id: string, kind: SeedEvent["kind"], routeId: string | null, at: string, source: string, headline: string, detail: string, payload: Record<string, unknown>): SeedEvent => ({ id, scenario: "flood", kind, routeId, at, source, headline, detail, payload });
  const events: SeedEvent[] = [
    // river-gauge readings — forecast-shaped, precede the flood warning
    E("FG1", "forecast", "r-A6108", td(2026, 2, 12, 4, 0), "Environment Agency river gauge (Kirkby Stephen)", "River Eden rising — 2.4m at Kirkby Stephen gauge", "Gauge reading above the 2.0m flood threshold; level rising steadily since 03:00.", { levelM: 2.4, trend: "rising" }),
    E("FG2", "forecast", "r-A6108", td(2026, 2, 12, 8, 30), "Environment Agency river gauge (Kirkby Stephen)", "River Eden 3.1m — well above threshold", "Gauge at 3.1m and still rising; overtopping likely at the Appleby crossing.", { levelM: 3.1, trend: "rising" }),
    E("FG3", "forecast", "r-B6277", td(2026, 2, 12, 9, 15), "Environment Agency river gauge (Osmotherley)", "River Leven 2.6m — flood plain filling", "Gauge above threshold; surface water reported on the flood plain.", { levelM: 2.6, trend: "rising" }),
    // flood warning — the warning-kind signal, same as a Met Office snow warning
    E("FW1", "warning", null, td(2026, 2, 12, 10, 0), "Environment Agency flood warning", "FLOOD WARNING — River Eden at Appleby", "Flooding is expected for the A6108 Eden crossing. Immediate action required.", { level: "amber", hazards: ["flood"], validFrom: td(2026, 2, 12, 10, 0), validTo: td(2026, 2, 12, 22, 0) }),
    // road closures — the road-kind signal, same ledger
    E("FR1", "road", "r-A6108", td(2026, 2, 12, 12, 30), "Cumbria CC flood response", "A6108 closed at Appleby — Eden overtopping", "Road impassable; flood water covering both carriageways at the river crossing.", { roadKind: "closure" }),
    E("FR2", "road", "r-B6277", td(2026, 2, 12, 13, 0), "North Yorkshire CC flood response", "B6277 flooded — Osmotherley plain", "Surface water across the flood plain; road closed to all traffic.", { roadKind: "closure" }),
    E("FR3", "road", "r-A685", td(2026, 2, 12, 14, 15), "Cumbria CC flood response", "A685 river bend — standing water, single track", "Passable with care; flood water at the river bend, reduced to one lane.", { roadKind: "disruption" }),
    // incident — same kind as the winter wedge
    E("FI1", "incident", "r-A6108", td(2026, 2, 12, 11, 45), "Cumbria Fire & Rescue", "Vehicle in floodwater at Appleby crossing", "One vehicle stranded in floodwater; occupants self-rescued, no injuries.", { severity: "serious" }),
  ];
  return {
    scenarios: [{
      id: "flood",
      title: "Flood — Eden Valley, Environment Agency scenario",
      subtitle: "Roadmap §2: same ledger, different wedge — river gauges → flood warning → road closure",
      start,
      now,
      fullEnd: now,
    }],
    routes: { flood: FLOOD },
    events,
    incidents: [{ id: "inc-flood-2024", scenario: "flood" as const, at: td(2024, 1, 20, 10, 0), routeId: "r-A6108", lat: 54.58, lng: -2.49, hazard: "flood" as const, severity: "serious" as const, narrative: "Jan 2024 Storm Henk: A6108 Appleby crossing overtopped, vehicle stranded in floodwater (illustrative EA-style demo).", source: "EA flood archive (demo)" }],
  };
}

/** Demo data for a synthetic live scenario, an illustrative A66 replay, and a
 *  flood generalization scenario (roadmap §2). */
export function buildBundle(): SeedBundle {
  const live = liveBundle();
  const back = backBundle();
  const flood = floodBundle();
  return {
    scenarios: [...live.scenarios, ...back.scenarios, ...flood.scenarios],
    routes: { live: live.routes.live, backtest: back.routes.backtest, flood: flood.routes.flood },
    events: [...live.events, ...back.events, ...flood.events],
    incidents: [...live.incidents, ...back.incidents, ...flood.incidents],
  };
}
