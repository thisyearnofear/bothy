import { q } from "./db";
import type {
  AuditEntry,
  IncidentRecord,
  RouteInfo,
  ScenarioId,
  SignalEvent,
} from "../../../packages/shared/src/types";

type Row = Record<string, unknown>;
const iso = (v: unknown) => new Date(v as string).toISOString();

function toRoute(r: Row): RouteInfo {
  return {
    id: r.id as string,
    name: r.name as string,
    region: r.region as string,
    lat: r.lat as number,
    lng: r.lng as number,
    coords: routeLineString(r.geom as unknown),
    lengthKm: r.length_km as number,
    maxGradientPct: r.max_gradient as number,
    maxElevationM: r.max_elev_m as number,
    exposure: r.exposure as number,
    ploughed: r.ploughed as boolean,
    hazards: (r.hazards as string[]) as RouteInfo["hazards"],
    actor: r.actor as string,
  };
}

function routeLineString(geom: unknown): [number, number][] {
  const s = String(geom);
  const m = s.match(/LINESTRING\((.+)\)/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((p) => p.trim().split(/\s+/).map(Number) as [number, number])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

function toSignalEvent(r: Row): SignalEvent {
  return {
    id: r.id as string,
    scenario: r.scenario as ScenarioId,
    kind: r.kind as SignalEvent["kind"],
    routeId: (r.route_id as string) ?? null,
    at: iso(r.at),
    source: r.source as string,
    headline: r.headline as string,
    detail: r.detail as string,
    payload: (r.payload as Record<string, unknown>) ?? {},
  };
}

function toIncident(r: Row): IncidentRecord {
  return {
    id: r.id as string,
    scenario: r.scenario as ScenarioId,
    at: iso(r.at),
    routeId: r.route_id as string,
    lat: r.lat as number,
    lng: r.lng as number,
    hazard: r.hazard as IncidentRecord["hazard"],
    severity: r.severity as IncidentRecord["severity"],
    narrative: r.narrative as string,
    source: r.source as string,
  };
}

export async function getScenario(id: ScenarioId) {
  const { rows } = await q(`SELECT * FROM scenarios WHERE id = $1`, [id]);
  if (!rows.length) return null;
  const r = rows[0] as Row;
  return {
    id: r.id as ScenarioId,
    title: r.title as string,
    subtitle: r.subtitle as string,
    start: iso(r.start),
    now: iso(r.now),
    fullEnd: iso(r.full_end),
    outcomeAt: r.outcome_at ? iso(r.outcome_at) : undefined,
    outcome: (r.outcome as string) ?? undefined,
  };
}

export type ScenarioMeta = NonNullable<Awaited<ReturnType<typeof getScenario>>>;

export async function listScenarios(): Promise<ScenarioMeta[]> {
  const { rows } = await q(`SELECT * FROM scenarios ORDER BY start`);
  return rows.map((r) => toScenarioRow(r as Row));
}

function toScenarioRow(r: Row) {
  return {
    id: r.id as ScenarioId,
    title: r.title as string,
    subtitle: r.subtitle as string,
    start: iso(r.start),
    now: iso(r.now),
    fullEnd: iso(r.full_end),
    outcomeAt: r.outcome_at ? iso(r.outcome_at) : undefined,
    outcome: (r.outcome as string) ?? undefined,
  };
}

export async function listRoutes(scenario: string): Promise<RouteInfo[]> {
  const { rows } = await q(`SELECT *, ST_AsText(geom) AS geom FROM routes WHERE scenario = $1`, [scenario]);
  return rows.map((r) => toRoute(r as Row));
}

export async function getRoute(scenario: string, id: string): Promise<RouteInfo | null> {
  const { rows } = await q(`SELECT *, ST_AsText(geom) AS geom FROM routes WHERE scenario = $1 AND id = $2`, [scenario, id]);
  return rows.length ? toRoute(rows[0] as Row) : null;
}

export async function listEvents(scenario: string): Promise<SignalEvent[]> {
  const { rows } = await q(`SELECT * FROM signal_events WHERE scenario = $1 ORDER BY at`, [scenario]);
  return rows.map((r) => toSignalEvent(r as Row));
}

export async function listIncidents(scenario: string): Promise<IncidentRecord[]> {
  const { rows } = await q(`SELECT * FROM incidents WHERE scenario = $1 ORDER BY at`, [scenario]);
  return rows.map((r) => toIncident(r as Row));
}

export type AssessmentRow = {
  id: string;
  scenario: ScenarioId;
  routeId: string;
  at: string;
  score: number;
  label: string;
  confidence: number;
  causalChain: string[];
  evidence: unknown;
  draft: string;
  responsibleActor: string;
  priority: string;
  status: string;
  decisionNote: string | null;
  decidedAt: string | null;
  engine: string;
  toolTrace: unknown;
  phases: string[];
};

export async function saveAssessment(a: AssessmentRow) {
  await q(
    `INSERT INTO assessments (id, scenario, route_id, at, score, label, confidence,
       causal_chain, evidence, draft, responsible_actor, priority, status, engine, tool_trace, phases)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13,$14,$15)`,
    [
      a.id, a.scenario, a.routeId, a.at, a.score, a.label, a.confidence,
      JSON.stringify(a.causalChain), JSON.stringify(a.evidence ?? []), a.draft, a.responsibleActor,
      a.priority, a.engine, JSON.stringify(a.toolTrace ?? []), JSON.stringify(a.phases ?? []),
    ]
  );
  return a;
}

export async function getAssessment(id: string): Promise<AssessmentRow | null> {
  const { rows } = await q(`SELECT * FROM assessments WHERE id = $1`, [id]);
  if (!rows.length) return null;
  return toAssessment(rows[0] as Row);
}

export async function listAssessments(scenario: string): Promise<AssessmentRow[]> {
  const { rows } = await q(`SELECT * FROM assessments WHERE scenario = $1 ORDER BY at DESC`, [scenario]);
  return rows.map((r) => toAssessment(r as Row));
}

function toAssessment(r: Row): AssessmentRow {
  return {
    id: r.id as string,
    scenario: r.scenario as ScenarioId,
    routeId: r.route_id as string,
    at: iso(r.at),
    score: r.score as number,
    label: r.label as string,
    confidence: r.confidence as number,
    causalChain: (r.causal_chain as string[]) ?? [],
    evidence: r.evidence ?? [],
    draft: r.draft as string,
    responsibleActor: r.responsible_actor as string,
    priority: r.priority as string,
    status: r.status as string,
    decisionNote: (r.decision_note as string) ?? null,
    decidedAt: r.decided_at ? iso(r.decided_at) : null,
    engine: r.engine as string,
    toolTrace: r.tool_trace ?? [],
    phases: (r.phases as string[]) ?? [],
  };
}

export async function updateDecision(id: string, status: "approved" | "rejected", note?: string) {
  await q(
    `UPDATE assessments SET status = $2, decision_note = $3, decided_at = now() WHERE id = $1`,
    [id, status, note ?? null]
  );
  return getAssessment(id);
}

export async function logAudit(scenario: string, actor: string, action: string, detail: string) {
  await q(`INSERT INTO audit_log (scenario, actor, action, detail) VALUES ($1,$2,$3,$4)`, [
    scenario,
    actor,
    action,
    detail,
  ]);
}

export interface Subscription {
  id: number;
  routeId: string;
  scenario: string;
  email: string;
  channel: string;
  minLabel: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v.trim());
}

export async function createSubscription(routeId: string, email: string, scenario = "live"): Promise<Subscription> {
  const clean = email.trim().toLowerCase();
  const { rows } = await q(
    `INSERT INTO subscriptions (route_id, scenario, email, confirmed_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (route_id, scenario, email)
     DO UPDATE SET unsubscribed_at = NULL, confirmed_at = COALESCE(subscriptions.confirmed_at, now())
     RETURNING id, route_id, scenario, email, channel, min_label`,
    [routeId, scenario, clean]
  );
  const r = rows[0] as Row;
  return { id: r.id as number, routeId: r.route_id as string, scenario: r.scenario as string, email: r.email as string, channel: r.channel as string, minLabel: r.min_label as string };
}

export async function listSubscriptions(scenario: string, routeId?: string): Promise<Subscription[]> {
  const { rows } = routeId
    ? await q(`SELECT id, route_id, scenario, email, channel, min_label FROM subscriptions WHERE scenario = $1 AND route_id = $2 AND unsubscribed_at IS NULL`, [scenario, routeId])
    : await q(`SELECT id, route_id, scenario, email, channel, min_label FROM subscriptions WHERE scenario = $1 AND unsubscribed_at IS NULL`, [scenario]);
  return rows.map((x) => {
    const r = x as Row;
    return { id: r.id as number, routeId: r.route_id as string, scenario: r.scenario as string, email: r.email as string, channel: r.channel as string, minLabel: r.min_label as string };
  });
}

export async function countSubscriptions(): Promise<number> {
  const { rows } = await q(`SELECT COUNT(*)::int AS n FROM subscriptions WHERE unsubscribed_at IS NULL`);
  return (rows[0] as Row).n as number;
}

const LABEL_RANK: Record<string, number> = { LOW: 0, MODERATE: 1, ELEVATED: 2, HIGH: 3 };

/** Queue notifications for subscribers whose threshold the assessment meets. */
export async function notifySubscribers(a: AssessmentRow): Promise<number> {
  if ((LABEL_RANK[a.label] ?? 0) < LABEL_RANK.ELEVATED) return 0;
  const subs = await listSubscriptions(a.scenario, a.routeId);
  let queued = 0;
  for (const s of subs) {
    if ((LABEL_RANK[a.label] ?? 0) < (LABEL_RANK[s.minLabel] ?? LABEL_RANK.ELEVATED)) continue;
    const { rowCount } = await q(
      `INSERT INTO notifications (subscription_id, assessment_id, route_id, scenario, label, channel, target)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (subscription_id, assessment_id) DO NOTHING`,
      [s.id, a.id, a.routeId, a.scenario, a.label, s.channel, s.email]
    );
    if ((rowCount ?? 0) > 0) queued++;
  }
  if (queued) await logAudit(a.scenario, "bothy-agent", "notify_queued", `${a.routeId} ${a.label}: ${queued} subscriber(s) queued for ${a.id}`);
  return queued;
}

export async function listNotifications(assessmentId: string) {
  const { rows } = await q(`SELECT id, route_id, scenario, label, channel, target, status, created_at, sent_at FROM notifications WHERE assessment_id = $1 ORDER BY id`, [assessmentId]);
  return rows;
}


export async function listAudit(scenario: string): Promise<AuditEntry[]> {
  const { rows } = await q(`SELECT * FROM audit_log WHERE scenario = $1 ORDER BY at DESC LIMIT 200`, [
    scenario,
  ]);
  return rows.map((r) => {
    const x = r as Row;
    return {
      id: String(x.id),
      at: iso(x.at),
      scenario: x.scenario as ScenarioId,
      actor: x.actor as string,
      action: x.action as string,
      detail: x.detail as string,
    };
  });
}

export async function listRiskSnapshots(scenario: string, routeId: string) {
  const { rows } = await q(
    `SELECT * FROM risk_snapshots WHERE scenario = $1 AND route_id = $2 ORDER BY at`,
    [scenario, routeId]
  );
  return rows.map((r) => {
    const x = r as Row;
    return {
      routeId: x.route_id as string,
      at: iso(x.at),
      score: x.score as number,
      label: x.label as string,
      citations: x.citations as unknown,
    };
  });
}

export async function updateScenarioClock(
  id: ScenarioId,
  clock: { start: string; now: string; fullEnd: string; subtitle: string }
) {
  await q(`UPDATE scenarios SET start = $2, now = $3, full_end = $4, subtitle = $5 WHERE id = $1`, [
    id,
    clock.start,
    clock.now,
    clock.fullEnd,
    clock.subtitle,
  ]);
}

export async function updateSignalEvent(
  scenario: ScenarioId,
  id: string,
  at: string,
  payload: Record<string, unknown>
) {
  await q(`UPDATE signal_events SET at = $3, payload = $4 WHERE scenario = $1 AND id = $2`, [
    scenario,
    id,
    at,
    JSON.stringify(payload),
  ]);
}

export async function insertSignalEvent(event: {
  id: string;
  scenario: ScenarioId;
  kind: string;
  routeId: string | null;
  at: string;
  source: string;
  headline: string;
  detail: string;
  payload: Record<string, unknown>;
}) {
  await q(
    `INSERT INTO signal_events (id, scenario, kind, route_id, at, source, headline, detail, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      event.id,
      event.scenario,
      event.kind,
      event.routeId,
      event.at,
      event.source,
      event.headline,
      event.detail,
      JSON.stringify(event.payload),
    ]
  );
  return listEvents(event.scenario).then((events) => events.find((e) => e.id === event.id) ?? null);
}

export async function replaceRiskSnapshots(
  scenario: ScenarioId,
  snaps: { routeId: string; at: string; score: number; label: string; citations: unknown }[]
) {
  await q(`DELETE FROM risk_snapshots WHERE scenario = $1`, [scenario]);
  if (!snaps.length) return;
  const rid = snaps.map((s) => s.routeId);
  const ats = snaps.map((s) => s.at);
  const scs = snaps.map((s) => s.score);
  const lbl = snaps.map((s) => s.label);
  const cit = snaps.map((s) => JSON.stringify(s.citations));
  await q(
    `INSERT INTO risk_snapshots (route_id, scenario, at, score, label, citations)
     SELECT * FROM unnest($1::text[], $2::text[], $3::timestamptz[], $4::real[], $5::text[], $6::jsonb[])`,
    [rid, Array(rid.length).fill(scenario), ats, scs, lbl, cit]
  );
}



type LiveWeatherSnapshot = import("../../../packages/shared/src/types").LiveWeatherResponse;
type LiveWeatherRoute = import("../../../packages/shared/src/types").LiveWeatherRoute;

type ObservationPayload = {
  response: Omit<LiveWeatherSnapshot, "routes" | "snapshotId" | "ingestedAt">;
  route: LiveWeatherRoute;
};

/**
 * Persist a complete externally-fetched weather snapshot outside signal_events.
 * The snapshot is context for operators only; it is never joined into scoring.
 */
export async function saveLiveWeatherSnapshot(response: LiveWeatherSnapshot): Promise<LiveWeatherSnapshot> {
  const snapshotId = `weather-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const ingestedAt = new Date().toISOString();
  const header: Omit<LiveWeatherSnapshot, "routes" | "snapshotId" | "ingestedAt"> = {
    provider: response.provider,
    providerUrl: response.providerUrl,
    fetchedAt: response.fetchedAt,
    cacheTtlSeconds: response.cacheTtlSeconds,
    scoreBoundary: response.scoreBoundary,
  };

  for (const route of response.routes) {
    await q(
      `INSERT INTO external_observations
        (snapshot_id, scenario, route_id, provider, source_url, observed_at, fetched_at, ingested_at, category, payload)
       VALUES ($1, 'live', $2, $3, $4, $5, $6, $7, 'weather', $8)`,
      [
        snapshotId,
        route.routeId,
        response.provider,
        route.sourceUrl,
        route.observedAt ?? null,
        route.fetchedAt ?? response.fetchedAt,
        ingestedAt,
        JSON.stringify({ response: header, route } satisfies ObservationPayload),
      ]
    );
  }

  return {
    ...response,
    snapshotId,
    ingestedAt,
    routes: response.routes.map((route) => ({
      ...route,
      mode: "persisted" as const,
      // acquisition mode survives persistence — a failed fetch can never
      // masquerade as a live observation once frozen.
      acquisitionMode: route.mode === "persisted" ? route.acquisitionMode : route.mode,
      note: `${route.note} Persisted as frozen operator context; score unchanged.`,
    })),
  };
}

/** Return the newest complete operator snapshot; this function never fetches a provider. */
export async function getLatestLiveWeatherSnapshot(): Promise<LiveWeatherSnapshot | null> {
  const { rows: snapshots } = await q(
    `SELECT snapshot_id
       FROM external_observations
      WHERE scenario = 'live' AND category = 'weather'
      ORDER BY ingested_at DESC, id DESC
      LIMIT 1`
  );
  if (!snapshots.length) return null;

  const snapshotId = (snapshots[0] as Row).snapshot_id as string;
  const { rows } = await q(
    `SELECT *
       FROM external_observations
      WHERE snapshot_id = $1 AND scenario = 'live' AND category = 'weather'
      ORDER BY id`,
    [snapshotId]
  );
  if (!rows.length) return null;

  const first = rows[0] as Row;
  const firstPayload = first.payload as ObservationPayload;
  const header = firstPayload.response;
  return {
    ...header,
    snapshotId,
    ingestedAt: iso(first.ingested_at),
    routes: rows.map((raw) => {
      const observation = raw as Row;
      const payload = observation.payload as ObservationPayload;
      return {
        ...payload.route,
        mode: "persisted" as const,
        acquisitionMode:
          payload.route.mode === "persisted"
            ? payload.route.acquisitionMode
            : (payload.route.mode as NonNullable<LiveWeatherRoute["acquisitionMode"]>),
        observedAt: observation.observed_at ? iso(observation.observed_at) : undefined,
        fetchedAt: observation.fetched_at ? iso(observation.fetched_at) : undefined,
        note: `${payload.route.note} Loaded from frozen operator snapshot; score unchanged.`,
      };
    }),
  };
}
