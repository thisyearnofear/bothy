import type { SignalEvent } from "../../../../packages/shared/src/types";
import { liveDay } from "./seedData";
import { buildTimeline } from "./risk";
import {
  getScenario,
  listEvents,
  listIncidents,
  listRoutes,
  replaceRiskSnapshots,
  updateScenarioClock,
  updateSignalEvent,
} from "../repo";

let lastAdvance = 0;
const ADVANCE_MS = 30_000;

/** Rebuild live risk snapshots from every DB signal (catalogue + operator). */
export async function rebuildLiveSnapshots(start: string, now: string) {
  const [routes, events, incidents] = await Promise.all([
    listRoutes("live"),
    listEvents("live"),
    listIncidents("live"),
  ]);
  const snaps = routes.flatMap((r) =>
    buildTimeline(r, events as SignalEvent[], incidents, start, now, 30)
  );
  await replaceRiskSnapshots("live", snaps);
}

/** Keep the live desk on wall-clock today. Catalogue signals rebase; operator reports and the ledger do not. */
export async function advanceLiveHorizon(force = false) {
  const now = Date.now();
  if (!force && now - lastAdvance < ADVANCE_MS) return;
  const meta = await getScenario("live");
  if (!meta) return;

  const day = liveDay();
  const drift = Math.abs(Date.parse(meta.now) - Date.parse(day.now));
  const rolled = new Date(meta.start).toDateString() !== new Date(day.start).toDateString();
  if (!force && !rolled && drift < ADVANCE_MS) {
    lastAdvance = now;
    return;
  }

  lastAdvance = now;
  await updateScenarioClock("live", {
    start: day.start,
    now: day.now,
    fullEnd: day.fullEnd,
    subtitle: day.subtitle,
  });
  // Rebase authored catalogue times only — op-* reports stay at the wall time they landed.
  for (const e of day.events) {
    await updateSignalEvent("live", e.id, e.at, e.payload);
  }
  await rebuildLiveSnapshots(day.start, day.now);
}
