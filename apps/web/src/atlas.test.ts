import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BOUNDED_FINAL_LABEL,
  CHAIN_STAGES,
  cellDisplay,
  cellText,
  chainEdges,
  chainNodeId,
  coverageCell,
  coverageRows,
  diffSummary,
  exposureNames,
  geoContextNote,
  geoContextsForScenario,
  ownerSummary,
  railStations,
  representativeColumn,
  storySlugForScenario,
} from "../lib/atlas";
import DependencyCanvas from "../components/DependencyCanvas";
import EvidenceCoverage from "../components/EvidenceCoverage";
import InvestigationRail from "../components/InvestigationRail";
import InvestigationTimeline from "../components/InvestigationTimeline";
import GeographicAtlas from "../components/GeographicAtlas";
import type { DefenseBrief, DefenseSession, GraphRun } from "../lib/api";

const session: DefenseSession = { configured: true, authenticated: true, roles: ["analyst"], subject: "analyst-1" };

const chainRun = (rows: Record<string, unknown>[]): GraphRun => ({
  runId: "chainrun", scenarioId: "gallium-chain", graph: "fixture", cypher: "fixture",
  queryHash: "fixture", graphCommit: "abc123", capturedAt: "2026-10-03T00:00:00Z",
  sourceBoundary: "Synthetic fixture",
  columns: ["p.name", "s.name", "ss.name", "a.name", "sa.name", "c.name", "c.family", "m.name", "g.name"],
  rows, count: rows.length, ms: 1,
});

const CHAIN_ROW = {
  "p.name": "Infantry fighting vehicle IFV-24A",
  "s.name": "IFV-24A / Fire control",
  "ss.name": "Thermal sight",
  "a.name": "IR imager",
  "sa.name": "Laser rangefinder SA-LAS012",
  "c.name": "Laser diode (GaAs) #018",
  "c.family": "GaAs emitter",
  "m.name": "GaAs substrate wafer",
  "g.name": "Primary gallium",
};

const exposureRun = (rows: Record<string, unknown>[]): GraphRun => ({
  runId: "exprun", scenarioId: "gallium-exposure", graph: "fixture", cypher: "fixture",
  queryHash: "fixture", graphCommit: "abc123", capturedAt: "2026-10-03T00:00:00Z",
  sourceBoundary: "Synthetic fixture", columns: ["p.name"], rows, count: rows.length, ms: 1,
});

const brief = (over: Partial<DefenseBrief> = {}): DefenseBrief => ({
  id: "b1", runId: "r", title: "t", createdAt: "2026-01-01", evidenceHash: "e",
  graphCommit: "g", queryHash: "q", generator: { id: "bothy-scripted", version: "defense-brief-v1", cloudInference: false },
  resultCount: 1, claims: [{ text: "c", citations: [{ runId: "r", row: 0, column: "p.name" }] }],
  gaps: [], recommendedAction: "x", status: "pending", ...over,
});

test("chain nodes map each stage to the exact captured row and column", () => {
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: chainRun([CHAIN_ROW]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {}, onRequestChain: () => {},
  }));
  for (const [label, column] of CHAIN_STAGES) {
    assert.match(html, new RegExp(`data-column="${column.replace(".", "\\.")}"`));
    assert.ok(html.includes(CHAIN_ROW[column as keyof typeof CHAIN_ROW] as string), `missing ${label}`);
  }
  assert.match(html, /aria-label="Platform: Infantry fighting vehicle IFV-24A"/);
  assert.match(html, /Captured path 1 of 1/);
  assert.match(html, /not total exposure/);
});

test("final material segment is labelled bounded, intermediate stages CONTAINS", () => {
  const edges = chainEdges(CHAIN_ROW);
  assert.equal(edges.length, 7);
  assert.equal(edges.at(-1)?.label, BOUNDED_FINAL_LABEL);
  assert.equal(edges.at(-1)?.bounded, true);
  assert.ok(edges.slice(0, -1).every((edge) => edge.label === "CONTAINS" && !edge.bounded));
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: chainRun([CHAIN_ROW]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {}, onRequestChain: () => {},
  }));
  assert.match(html, /intermediate materials not returned/);
});

test("missing stage values are 'Not recorded' and never bridge an edge", () => {
  const row = { ...CHAIN_ROW, "ss.name": null, "m.name": "" };
  const edges = chainEdges(row);
  assert.equal(edges.some((edge) => edge.fromStage === "Subsystem" || edge.toStage === "Subsystem"), false);
  assert.equal(edges.some((edge) => edge.fromStage === "Material"), false);
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: chainRun([row]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {}, onRequestChain: () => {},
  }));
  assert.match(html, /Not recorded/);
});

test("node identity is scoped to run, row and column so equal strings stay distinct", () => {
  assert.notEqual(chainNodeId("r", 0, "p.name"), chainNodeId("r", 0, "s.name"));
  assert.notEqual(chainNodeId("r", 0, "p.name"), chainNodeId("r", 1, "p.name"));
  const row = { ...CHAIN_ROW, "s.name": CHAIN_ROW["p.name"] };
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: chainRun([row]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {}, onRequestChain: () => {},
  }));
  assert.match(html, /aria-label="Platform: Infantry fighting vehicle IFV-24A"/);
  assert.match(html, /aria-label="System: Infantry fighting vehicle IFV-24A"/);
});

test("exposure runs render captured names with no fabricated edges or chain identity", () => {
  const run = exposureRun([{ "p.name": "Radar A" }, { "p.name": "EW B" }]);
  assert.deepEqual(exposureNames(run), ["Radar A", "EW B"]);
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run, sample: 0, onSample: () => {}, selected: null, onSelect: () => {}, onRequestChain: () => {},
  }));
  assert.match(html, /Names captured; paths not returned by this query/);
  assert.doesNotMatch(html, /CONTAINS/);
  assert.doesNotMatch(html, /Primary gallium/);
});

test("zero captured rows teach the action without claiming no exposure", () => {
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: exposureRun([]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {}, onRequestChain: () => {},
  }));
  assert.match(html, /No matching rows captured/);
  assert.match(html, /not evidence of no exposure/);
});

test("malicious captured strings are escaped in rendered markup", () => {
  const row = { ...CHAIN_ROW, "p.name": "<img src=x onerror=alert(1)>" };
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: chainRun([row]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {}, onRequestChain: () => {},
  }));
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

const MATRIX_COLUMNS = ["Programme mapping", "Inventory", "Alternatives", "Delivery timing"] as const;

test("structured-fact columns are always 'Not established', even after approval, completion and acceptance", () => {
  const run = chainRun([CHAIN_ROW]);
  const closedBrief = brief({
    status: "approved",
    action: { owner: "o", dueAt: "2026-01-02", status: "completed", outcome: "Checked stock" },
    reassessment: { subject: "r", decision: "accepted", note: "n", at: "2026-01-03" },
  });
  for (const column of MATRIX_COLUMNS) {
    assert.equal(coverageCell(run, CHAIN_ROW, column).label, "Not established");
  }
  const html = renderToStaticMarkup(createElement(EvidenceCoverage, {
    run, brief: closedBrief, selected: null, onSelect: () => {}, onPrepareVerification: () => {},
  }));
  assert.doesNotMatch(html, /aria-label="[^"]*: (Verified|Complete|Resolved)/i);
  assert.doesNotMatch(html, /cov-cell[^>]*>(?:Verified|Complete|Resolved)/i);
  assert.match(html, /Not attributed to this row/);
});

test("owner findings are never inferred onto rows; case-level summary carries the outcome", () => {
  const closedBrief = brief({
    status: "approved",
    action: { owner: "o", dueAt: "2026-01-02", status: "completed", outcome: "Checked stock" },
  });
  assert.equal(coverageCell(chainRun([CHAIN_ROW]), CHAIN_ROW, "Owner finding").label, "Not attributed to this row");
  assert.match(ownerSummary(closedBrief) ?? "", /Finding recorded — owner-recorded outcome: Checked stock/);
  assert.equal(ownerSummary(null), null);
});

test("dependency evidence cell projects captured vs not recorded per scenario shape", () => {
  const chain = chainRun([CHAIN_ROW]);
  assert.equal(coverageCell(chain, CHAIN_ROW, "Dependency evidence").kind, "captured");
  assert.equal(coverageCell(chain, { "p.name": null }, "Dependency evidence").label, "Not recorded");
  const exposure = exposureRun([{ "p.name": "Radar A" }]);
  assert.equal(coverageCell(exposure, { "p.name": "Radar A" }, "Dependency evidence").label, "Captured");
  assert.equal(coverageCell(exposure, { "p.name": "" }, "Dependency evidence").label, "Not recorded");
  const other = chainRun([CHAIN_ROW]); other.scenarioId = "chn-ownership";
  assert.equal(coverageCell(other, { "p.name": "x" }, "Dependency evidence").label, "Captured row");
  assert.equal(coverageCell(other, {}, "Dependency evidence").label, "Not recorded");
  assert.equal(representativeColumn(chain, CHAIN_ROW), "p.name");
  assert.equal(coverageRows(chainRun(Array.from({ length: 12 }, () => CHAIN_ROW))).length, 10);
});

test("rail stations reflect real capture/brief/session state, never staged progress", () => {
  let stations = railStations({ run: null, busy: false, brief: null, session });
  assert.equal(stations.find((s) => s.id === "capture")?.state, "Waiting");
  stations = railStations({ run: null, busy: true, brief: null, session });
  assert.equal(stations.find((s) => s.id === "capture")?.state, "Working");
  stations = railStations({ run: chainRun([CHAIN_ROW]), busy: false, brief: brief(), session });
  assert.equal(stations.find((s) => s.id === "capture")?.state, "Captured");
  assert.equal(stations.find((s) => s.id === "review")?.state, "Brief pending");
  stations = railStations({ run: chainRun([CHAIN_ROW]), busy: false, brief: brief({ status: "approved", action: { owner: "o", dueAt: "d", status: "acknowledged" } }), session });
  assert.equal(stations.find((s) => s.id === "review")?.state, "Brief approved");
  assert.equal(stations.find((s) => s.id === "followup")?.state, "Action acknowledged");
  stations = railStations({ run: chainRun([CHAIN_ROW]), busy: false, brief: brief({ status: "rejected" }), session });
  assert.equal(stations.find((s) => s.id === "review")?.state, "Brief rejected");
  const anon = railStations({ run: null, busy: false, brief: null, session: { configured: true, authenticated: false, roles: [] } });
  assert.match(anon.find((s) => s.id === "review")?.state ?? "", /Locked — sign in/);
  const unconfigured = railStations({ run: null, busy: false, brief: null, session: { configured: false, authenticated: false, roles: [] } });
  assert.match(unconfigured.find((s) => s.id === "review")?.state ?? "", /SSO not configured/);
  const html = renderToStaticMarkup(createElement(InvestigationRail, {
    run: null, busy: false, brief: null, session, onFocus: () => {},
  }));
  assert.match(html, /Deterministic evidence workflow/);
  assert.match(html, /No cloud inference on this page/);
});

test("public events mode shows sourced beats without mixing graph capture dates", () => {
  const html = renderToStaticMarkup(createElement(InvestigationTimeline, {
    scenarioId: "gallium-chain", run: chainRun([CHAIN_ROW]), activeBeatIndex: 0, onBeatChange: () => {},
  }));
  assert.match(html, /Public events/);
  assert.match(html, /Graph versions/);
  assert.match(html, /IEA policy database/);
  assert.match(html, /current capture does not change/);
  assert.match(html, /Current task/);
});

test("geographic context keeps country labels and synthetic evidence apart", () => {
  assert.deepEqual(geoContextsForScenario("gallium-chain").map((g) => g.id), ["context-china", "context-us"]);
  assert.equal(geoContextsForScenario("chn-ownership").length, 0);
  const gallium = renderToStaticMarkup(createElement(GeographicAtlas, {
    scenarioId: "gallium-chain", beat: undefined, selectedContext: null, onSelectContext: () => {},
  }));
  assert.match(gallium, /no supplier geolocation captured/);
  const other = renderToStaticMarkup(createElement(GeographicAtlas, {
    scenarioId: "chn-ownership", beat: undefined, selectedContext: null, onSelectContext: () => {},
  }));
  assert.match(other, /No geographic locations returned by this query/);
});

test("version diff display reports returned samples, never extrapolated change", () => {
  const summary = diffSummary({ beforeCount: 3, afterCount: 5, addedSample: [{}], removedSample: [] });
  assert.equal(summary.counts, "3 → 5 query rows");
  assert.match(summary.note, /does not prove the full result set is identical/);
});

test("story slug mapping limits public context to authored stories", () => {
  assert.equal(storySlugForScenario("gallium-chain"), "gallium");
  assert.equal(storySlugForScenario("red-sea-d01"), "red-sea");
  assert.equal(storySlugForScenario("chn-ownership"), null);
  assert.equal(cellText({ "p.name": " " }, "p.name"), null);
});

test("drawer values render non-string captures literally and never as 'Not recorded'", () => {
  assert.equal(cellDisplay({ count: 0 }, "count"), "0");
  assert.equal(cellDisplay({ flag: false }, "flag"), "false");
  assert.equal(cellDisplay({ count: 7 }, "count"), "7");
  assert.equal(cellDisplay({ name: null }, "name"), "Not recorded");
  assert.equal(cellDisplay({ name: "  " }, "name"), "Not recorded");
  assert.equal(cellDisplay({ name: "0" }, "name"), "0");
});

test("representative column honours the returned schema before falling back", () => {
  const chain = chainRun([CHAIN_ROW]);
  assert.equal(representativeColumn(chain, CHAIN_ROW), "p.name");
  const generic = { ...chain, scenarioId: "chn-ownership", columns: ["n", "depth"], rows: [{ n: null, depth: 3 }] };
  assert.equal(representativeColumn(generic, generic.rows[0]), "depth");
  const noP = { ...chain, scenarioId: "chn-ownership", columns: ["n"], rows: [{ n: "x" }] };
  assert.equal(representativeColumn(noP, { n: "x", "p.name": "ignored" }), "n");
});

test("turn connector only renders when the captured row bridges the row break", () => {
  const missing = { ...CHAIN_ROW, "sa.name": null };
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: chainRun([missing]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {},
  }));
  assert.doesNotMatch(html, /dep-turn/);
  assert.match(html, /dep-relations/);
  const full = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: chainRun([CHAIN_ROW]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {},
  }));
  assert.match(full, /dep-turn/);
  assert.match(full, /Final material segment/);
  const relations = full.match(/dep-relations[\s\S]*?<\/ol>/)?.[0] ?? "";
  assert.match(relations, /Material → Primary material/);
});

test("geographic context notes are authored per point, never invented", () => {
  const contexts = geoContextsForScenario("gallium-chain");
  assert.match(geoContextNote(contexts[0]), /Export-policy origin in the authored gallium timeline/);
  assert.match(geoContextNote(contexts[1]), /US-specific restriction in the authored timeline/);
  assert.match(geoContextNote(geoContextsForScenario("red-sea-d01")[0]), /Not a ship position or captured supplier site/);
});

test("rail reserves the shelter accent for human stations only", () => {
  const html = renderToStaticMarkup(createElement(InvestigationRail, {
    run: null, busy: false, brief: null,
    session: { configured: true, authenticated: true, roles: ["analyst"] },
    onFocus: () => {},
  }));
  assert.match(html, /data-next="tool"/);
  assert.doesNotMatch(html, /data-next="human"/);
  const human = renderToStaticMarkup(createElement(InvestigationRail, {
    run: chainRun([CHAIN_ROW]), busy: false, brief: null,
    session: { configured: true, authenticated: true, roles: ["analyst"] },
    onFocus: () => {},
  }));
  assert.match(human, /data-next="human"/);
});

test("timeline tabs are wired as a real tablist with mounted panels", () => {
  const html = renderToStaticMarkup(createElement(InvestigationTimeline, {
    scenarioId: "gallium-chain", run: null, activeBeatIndex: 0, onBeatChange: () => {},
    versionsPanel: createElement("p", null, "versions"),
  }));
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-controls="[^"]*panel-0"/);
  assert.match(html, /aria-controls="[^"]*panel-1"/);
  assert.match(html, /role="tabpanel"[^>]*hidden/);
});

test("matrix drawer explains missing dependency evidence without claiming schema facts", () => {
  const run = chainRun([{ ...CHAIN_ROW, "g.name": null }]);
  const cell = coverageCell(run, run.rows[0], "Dependency evidence");
  assert.equal(cell.label, "Not recorded");
});

import { createOperationGuard } from "../lib/operations";

test("operation guard ignores delayed success, error and finally after scenario change or unmount", () => {
  const guard = createOperationGuard();
  const first = guard.begin();
  assert.equal(guard.isCurrent(first), true);
  guard.invalidate();
  assert.equal(guard.isCurrent(first), false);
  const second = guard.begin();
  assert.equal(guard.isCurrent(second), true);
  assert.equal(guard.isCurrent(first), false);
  guard.unmount();
  assert.equal(guard.isCurrent(second), false);
  guard.mount();
  assert.equal(guard.isCurrent(second), false);
  const third = guard.begin();
  assert.equal(guard.isCurrent(third), true);
});

test("row break renders exactly one connector — the downward turn, no outward edge", () => {
  const html = renderToStaticMarkup(createElement(DependencyCanvas, {
    run: chainRun([CHAIN_ROW]), sample: 0, onSample: () => {}, selected: null, onSelect: () => {},
  }));
  assert.equal((html.match(/class="dep-edge"/g) ?? []).length, 6);
  assert.equal((html.match(/class="dep-turn"/g) ?? []).length, 1);
});
