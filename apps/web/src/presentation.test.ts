import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PilotPage from "../app/pilot/page";
import BriefSpecimen from "../components/BriefSpecimen";
import WorkflowStrip from "../components/WorkflowStrip";
import ScatterHeading from "../components/ScatterHeading";
import MarkingBar from "../components/MarkingBar";
import { PilotInterestForm } from "../components/EyPilotBand";
import StoryStage from "../components/StoryStage";
import { STORIES } from "../lib/stories";
import Inspector from "../components/Inspector";
import LensTabs from "../components/LensTabs";
import GraphPanel from "../components/GraphPanel";
import IntakeLegend from "../components/IntakeLegend";
import RoadIngest from "../components/RoadIngest";
import ReliabilityPanel from "../components/ReliabilityPanel";

const render = (component: Parameters<typeof createElement>[0]) => renderToStaticMarkup(createElement(component));

test("pilot leads with scope and an illustrative deliverable without implying achieved results", () => {
  const html = render(PilotPage);
  assert.match(html, /aria-label="Pilot scope"/);
  assert.match(html, /Illustrative layout · synthetic example/);
  assert.match(html, /Measures to agree, not achieved results/);
  assert.match(html, /approved model egress/);
  assert.match(html, /not a claim that this hosted demo is offline/);
  assert.match(html, /Do not submit sensitive BOMs/);
  assert.match(html, /An enquiry is not a signed pilot/);
  assert.match(html, /role="tablist" aria-label="Pilot gates"/);
  assert.match(html, /Planning gates, not completed milestones/);
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(html, /recorded requests|validated traction|First buyer/);
});

test("the specimen separates evidence, gaps, decision and task", () => {
  const html = render(BriefSpecimen);
  for (const label of ["Evidence", "Gap", "Decision", "Task"]) assert.match(html, new RegExp(`<dt>${label}</dt>`));
  assert.match(html, /not proof of a stoppage/);
  assert.match(html, /not a captured case/);
});

test("handoff strip names every station without implying operational closure", () => {
  const html = render(WorkflowStrip);
  assert.equal((html.match(/<li>/g) ?? []).length, 5);
  assert.match(html, /Owner \+ deadline/);
  assert.match(html, /Verification, not operational closure/);
});

test("animated headings retain literal word boundaries for text extraction", () => {
  const html = renderToStaticMarkup(createElement(ScatterHeading, { text: "One question. Two weeks." }));
  const text = html.replace(/<[^>]*>/g, "");
  assert.equal(text, "One question. Two weeks.");
  assert.match(html, /aria-label="One question. Two weeks."/);
});

test("contact form keeps labels and validation but removes the request counter", () => {
  const html = render(PilotInterestForm);
  assert.match(html, /<form/);
  assert.match(html, /autoComplete="email"/i);
  assert.match(html, /type="email"/);
  assert.match(html, /type="submit"/);
  assert.doesNotMatch(html, /recorded requests|validated traction/);
});

test("markings retain the analysis boundary without a decorative clock", () => {
  const html = render(MarkingBar);
  assert.match(html, /public \/ synthetic data/);
  assert.match(html, /Unapproved analysis/);
  assert.doesNotMatch(html, /Current UTC time/);
});

test("story sources stay directly linked and replay limits remain visible", () => {
  for (const story of STORIES) {
    const html = renderToStaticMarkup(createElement(StoryStage, { story }));
    assert.match(html, /Public source/);
    assert.match(html, /Inspect source note/);
    assert.ok(html.includes(story.beats[0].event!.source.url));
    assert.match(html, /Bothy did not exist during these events/);
    assert.match(html, /no changed outcome is claimed/);
  }
});

test("inspectors label a closed native modal and connect its trigger to the dialog", () => {
  const html = renderToStaticMarkup(createElement(Inspector, { label: "Inspect row", title: "Captured row", children: createElement("p", null, "Stored evidence") }));
  const dialogId = html.match(/<dialog[^>]* id="([^"]+)"/)?.[1];
  assert.ok(dialogId);
  assert.ok(html.includes(`aria-controls="${dialogId}"`));
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-label="Close Captured row"/);
  assert.doesNotMatch(html, /<dialog[^>]* open=/);
});

test("reference lenses select one panel and retain the other panel's content", () => {
  const html = renderToStaticMarkup(createElement(LensTabs, { label: "Reference", items: [
    { id: "one", label: "First", content: "First record" },
    { id: "two", label: "Second", content: "Second record" },
  ] }));
  assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
  assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  assert.match(html, /tabIndex="-1"/i);
  assert.match(html, /hidden=""[^>]*>Second record/);
  assert.equal(renderToStaticMarkup(createElement(LensTabs, { label: "Empty", items: [] })), "");
});

test("graph evidence and workbench are inspections, not accordion rows", () => {
  const html = render(GraphPanel);
  assert.match(html, /Inspect captured rows/);
  assert.match(html, /Open query &amp; version workbench/);
  assert.match(html, /Stored rows, not a fresh query/);
  assert.match(html, /Catalogue-only, pinned reads use isolated graph clients/);
  assert.match(html, /Simulation requires SSO and cannot submit changes/);
  assert.doesNotMatch(html, /<details/);
});

test("intake clocks and ingestion limits remain visible without opening a toggle", () => {
  const html = renderToStaticMarkup(createElement(IntakeLegend, { caseId: "live" }));
  assert.match(html, /Open-Meteo — operator-fetched, frozen/);
  assert.match(html, /not the score/);
  assert.match(html, /audio · radio · social are not ingested/);
  assert.doesNotMatch(html, /<button|<details/);
});

test("road intake opens directly as a form, with no second disclosure", () => {
  const html = renderToStaticMarkup(createElement(RoadIngest, {
    routes: [{ id: "test-road", name: "Synthetic road" }] as Parameters<typeof RoadIngest>[0]["routes"],
    selectedId: "test-road", onSubmit: async () => {},
  }));
  assert.match(html, /<form/);
  assert.match(html, /Corridor/);
  assert.match(html, /Headline/);
  assert.match(html, /Land in the score/);
  assert.doesNotMatch(html, /Report a road|<details/);
});

test("provider mechanics use an inspector while service state stays visible", () => {
  const html = renderToStaticMarkup(createElement(ReliabilityPanel, {
    health: { at: "2026-10-03T00:00:00Z", providers: [], firstOkIndex: null, fallbackEngaged: true, scriptedAvailable: true },
    rehearsing: false, onProbe: () => {}, onRehearse: () => {},
  }));
  assert.match(html, /all providers down/);
  assert.match(html, /Inspect provider chain/);
  assert.match(html, /scripted brain:/);
  assert.doesNotMatch(html, /<details/);
});
