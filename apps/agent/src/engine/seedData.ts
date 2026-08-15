import type { IncidentRecord, RouteInfo, ScenarioId } from "../../../../packages/shared/src/types";

export interface SeedEvent {
  id: string; scenario: string; kind: "warning" | "forecast" | "road" | "incident";
  routeId: string | null; at: string; source: string; headline: string; detail: string; payload: Record<string, unknown>;
}
export interface ScenarioSeed { id: ScenarioId; title: string; subtitle: string; start: string; now: string; fullEnd: string; outcomeAt?: string; outcome?: string; }
export interface SeedBundle { scenarios: ScenarioSeed[]; routes: RouteInfo[]; events: SeedEvent[]; incidents: IncidentRecord[]; }

const t = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const td = (y: number, mo: number, d: number, h: number, m: number) => new Date(Date.UTC(y, mo - 1, d, h, m, 0)).toISOString();

const R: Record<string, RouteInfo> = {
  "r-A5094": { id: "r-A5094", name: "A5094 Seathwaite-Sty Head", region: "Borrowdale", lat: 54.49, lng: -3.18, coords: [[-3.1832, 54.4893], [-3.203, 54.46], [-3.28, 54.448]], lengthKm: 9.8, maxGradientPct: 12, maxElevationM: 393, exposure: 0.72, ploughed: false, hazards: ["snow", "ice"], actor: "Cumbria County Council - Winter Duty Officer" },
  "r-B5311": { id: "r-B5311", name: "B5311 Wasdale Head Road", region: "Wasdale", lat: 54.45, lng: -2.89, coords: [[-3.0039, 54.4668], [-2.94, 54.43], [-2.78, 54.4744]], lengthKm: 18.4, maxGradientPct: 14, maxElevationM: 420, exposure: 0.95, ploughed: false, hazards: ["snow", "ice", "wind"], actor: "Cumbria County Council - Winter Duty Officer" },
  "r-A66": { id: "r-A66", name: "A66 Kirkby-in-Furness", region: "Lindale", lat: 54.38, lng: -3.0, coords: [[-3.1, 54.42], [-2.95, 54.41], [-2.85, 54.4]], lengthKm: 22.1, maxGradientPct: 3, maxElevationM: 120, exposure: 0.22, ploughed: true, hazards: ["ice", "flood"], actor: "Highways England (A66) Duty Officer" },
  "r-B5285": { id: "r-B5285", name: "B5285 Coniston-Torver", region: "Coniston", lat: 54.42, lng: -2.86, coords: [[-2.96, 54.43], [-2.85, 54.44], [-2.78, 54.44]], lengthKm: 13.0, maxGradientPct: 7, maxElevationM: 210, exposure: 0.5, ploughed: false, hazards: ["snow", "ice"], actor: "Cumbria County Council - Winter Duty Officer" },
};
const routes = () => Object.values(R);

function liveBundle(): SeedBundle {
  const start = t(0, 0), now = t(14, 30);
  const E = (id: string, kind: SeedEvent["kind"], routeId: string | null, at: string, source: string, headline: string, detail: string, payload: Record<string, unknown>) => ({ id, scenario: "live", kind, routeId, at, source, headline, detail, payload });
  const events: SeedEvent[] = [
    E("W1", "warning", null, t(3, 10), "Met Office (Weather DataHub)", "AMBER warning - snow & severe blizzards", "Persistent snow, gusts to 70mph. Risk on exposed upland roads.", { level: "amber", hazards: ["snow", "wind"], validFrom: t(3, 10), validTo: t(20, 0) }),
    E("W2", "warning", null, t(7, 45), "Met Office Weather Warning", "YELLOW snow warning in force", "Further 5-10cm accumulation, icy patches on upland routes.", { level: "yellow", hazards: ["snow"], validFrom: t(7, 45), validTo: t(18, 0) }),
    E("F1", "forecast", null, t(6, 0), "Met Office forecast", "Overnight low -4C, 8cm fresh snow", "Ice on unsalted surfaces, snow lying to low levels.", { snowCm: 8, minTempC: -4 }),
    E("R1", "road", "r-A66", t(5, 30), "Cumbria CC road feed", "Plough & salt complete - A66", "Route treated and mostly clear, patrol out.", { roadKind: "plough-complete" }),
    E("R2", "road", "r-B5311", t(8, 20), "Cumbria CC / traffic feed", "B5311 blocked by deep drifts at Wasdale Head", "No plough scheduled today; traffic unable to pass.", { roadKind: "closure" }),
    E("R3", "road", "r-A5094", t(11, 5), "Highways patrol report", "Frost & icing on A5094, poor visibility", "Black ice at Sty Head; drivers struggling on gradient.", { roadKind: "report" }),
    E("I1", "incident", "r-A5094", t(12, 15), "MR incident log", "Walker assisted on Sty Head", "Minor - slipped on ice, no serious injury.", { severity: "minor" }),
  ];
  return { scenarios: [{ id: "live", title: "Live - Lake District, Winter Watch", subtitle: "Today · signals arriving over the last 14 hours", start, now, fullEnd: now }], routes: routes(), events, incidents: [{ id: "inc-2018", scenario: "live", at: td(2018, 1, 14, 19, 40), routeId: "r-B5311", lat: 54.48, lng: -2.79, hazard: "snow", severity: "serious", narrative: "January 2018 blizzard: 3 vehicles stranded near Wasdale Head Inn; MR snow recovery (demo).", source: "MR incident archive (demo reconstruction)" }] };
}

function backBundle(): SeedBundle {
  const start = td(2018, 1, 14, 0, 0), now = td(2018, 1, 14, 17, 30);
  const E = (id: string, kind: SeedEvent["kind"], routeId: string | null, at: string, source: string, headline: string, detail: string, payload: Record<string, unknown>) => ({ id, scenario: "backtest", kind, routeId, at, source, headline, detail, payload });
  const events: SeedEvent[] = [
    E("W1", "warning", null, td(2018, 1, 14, 8, 0), "Met Office DataFlow", "AMBER - blizzard conditions, wind & snow", "Severe blizzards, gusts to 65mph, drifting snow.", { level: "amber", hazards: ["snow", "wind"], validFrom: td(2018, 1, 14, 9, 0), validTo: td(2018, 1, 14, 22, 0) }),
    E("F1", "forecast", null, td(2018, 1, 14, 10, 0), "Met Office forecast", "10-15cm snow by 18:00, low -6C", "Heavy snow showers, drifting on exposed roads.", { snowCm: 15, minTempC: -6 }),
    E("R2", "road", "r-B5311", td(2018, 1, 14, 13, 0), "Cumbria CC road feed", "B5311 - snow drifts forming, plough requested", "Vehicle stuck on ascent; drift 0.5m deep.", { roadKind: "disruption" }),
    E("R3", "incident", "r-B5311", td(2018, 1, 14, 19, 45), "MR incident log", "3 vehicles stranded near Wasdale Head Inn", "MR snow recovery to 3 cars; no serious injuries.", { severity: "serious" }),
  ];
  return { scenarios: [{ id: "backtest", title: "Backtest - 14 Jan 2018, Wasdale", subtitle: "Demo reconstruction · agent limited to pre-incident data", start, now, fullEnd: td(2018, 1, 14, 21, 0), outcomeAt: td(2018, 1, 14, 19, 45), outcome: "REAL OUTCOME: 3 vehicles stranded 19:45; closure 20:37. Agent flagged HIGH at 17:30 - 2h 15m before first MR call." }], routes: routes(), events, incidents: [{ id: "inc-history", scenario: "backtest", at: td(2013, 2, 2, 16, 20), routeId: "r-B5311", lat: 54.48, lng: -2.79, hazard: "snow", severity: "serious", narrative: "Feb 2013: two cars abandoned in drifts on B5311 near Wasdale Head; on-foot recovery.", source: "MR incident archive (demo reconstruction)" }] };
}

export function buildBundle(): SeedBundle {
  const live = liveBundle(), back = backBundle();
  return { scenarios: [...live.scenarios, ...back.scenarios], routes: live.routes, events: [...live.events, ...back.events], incidents: [...live.incidents, ...back.incidents] };
}
