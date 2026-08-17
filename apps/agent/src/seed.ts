import { readFile } from "node:fs/promises";
import { q } from "./db";
import { buildBundle } from "./engine/seedData";
import { buildTimeline } from "./engine/risk";
import { pseudoEmbed } from "../../../packages/shared/src/lib";
import type { SignalEvent } from "../../../packages/shared/src/types";

async function main() {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  // Catalogue refresh only — assessments, audit_log, external_observations, and op-* signals stay.
  await q(schema);
  await q("DELETE FROM risk_snapshots");
  await q("DELETE FROM incidents");
  await q("DELETE FROM signal_events WHERE id NOT LIKE 'op-%'");
  await q("DELETE FROM routes");
  await q("DELETE FROM scenarios");

  const bundle = buildBundle();

  for (const s of bundle.scenarios) {
    await q(
      `INSERT INTO scenarios (id, title, subtitle, start, now, full_end, outcome_at, outcome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.id, s.title, s.subtitle, s.start, s.now, s.fullEnd, s.outcomeAt ?? null, s.outcome ?? null]
    );
  }

  for (const sc of bundle.scenarios) {
    for (const r of bundle.routes[sc.id] ?? []) {
      const line = r.coords.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
      await q(
        `INSERT INTO routes (id, scenario, name, region, geom, length_km, max_gradient, max_elev_m,
           exposure, ploughed, hazards, actor, lat, lng)
         VALUES ($1,$2,$3,$4, ST_GeomFromText($5, 4326), $6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          r.id,
          sc.id,
          r.name,
          r.region,
          `LINESTRING(${line})`,
          r.lengthKm,
          r.maxGradientPct,
          r.maxElevationM,
          r.exposure,
          r.ploughed,
          r.hazards,
          r.actor,
          r.lat,
          r.lng,
        ]
      );
    }
  }

  for (const e of bundle.events) {
    await q(
      `INSERT INTO signal_events (id, scenario, kind, route_id, at, source, headline, detail, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [e.id, e.scenario, e.kind, e.routeId, e.at, e.source, e.headline, e.detail, JSON.stringify(e.payload)]
    );
  }

  for (const i of bundle.incidents) {
    await q(
      `INSERT INTO incidents (id, scenario, at, route_id, lat, lng, hazard, severity, narrative, source, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [i.id, i.scenario, i.at, i.routeId, i.lat, i.lng, i.hazard, i.severity, i.narrative, i.source, pseudoEmbed(i.narrative, 64)]
    );
  }

  // Operator road reports (op-*) survive seed — fold them into live timelines.
  const { rows: opRows } = await q(`SELECT * FROM signal_events WHERE scenario = 'live' AND id LIKE 'op-%' ORDER BY at`);
  const opEvents = opRows.map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: x.id as string,
      scenario: "live",
      kind: x.kind,
      routeId: (x.route_id as string) ?? null,
      at: new Date(x.at as string).toISOString(),
      source: x.source as string,
      headline: x.headline as string,
      detail: x.detail as string,
      payload: (x.payload as Record<string, unknown>) ?? {},
    };
  }) as unknown as SignalEvent[];

  for (const sc of bundle.scenarios) {
    const seeded = bundle.events.filter((e) => e.scenario === sc.id) as unknown as SignalEvent[];
    const events = sc.id === "live" ? [...seeded, ...opEvents] : seeded;
    const incidents = bundle.incidents.filter((i) => i.scenario === sc.id);
    const rid: string[] = [];
    const ats: string[] = [];
    const scs: number[] = [];
    const lbl: string[] = [];
    const cit: string[] = [];
    for (const r of bundle.routes[sc.id] ?? []) {
      for (const snap of buildTimeline(r, events, incidents, sc.start, sc.now, 30)) {
        rid.push(snap.routeId);
        ats.push(snap.at);
        scs.push(snap.score);
        lbl.push(snap.label);
        cit.push(JSON.stringify(snap.citations));
      }
    }
    if (rid.length) {
      await q(
        `INSERT INTO risk_snapshots (route_id, scenario, at, score, label, citations)
         SELECT * FROM unnest($1::text[], $2::text[], $3::timestamptz[], $4::real[], $5::text[], $6::jsonb[])`,
        [rid, Array(rid.length).fill(sc.id), ats, scs, lbl, cit]
      );
    }
  }

  await q(
    `INSERT INTO audit_log (scenario, actor, action, detail) VALUES ('live','seed', 'seed', 'Catalogue refreshed; assessments, weather snapshots, and op-* road reports retained')`
  );

  console.log("Seeded:", bundle.scenarios.map((s) => s.id).join(", "), opEvents.length ? `(+${opEvents.length} operator reports)` : "");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
