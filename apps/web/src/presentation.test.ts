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
  assert.match(html, /<summary>Requirements<\/summary>/);
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

test("story sources remain accessible in disclosures and replay limits stay visible", () => {
  for (const story of STORIES) {
    const html = renderToStaticMarkup(createElement(StoryStage, { story }));
    assert.match(html, /<summary>Source/);
    assert.ok(html.includes(story.beats[0].event!.source.url));
    assert.match(html, /Bothy did not exist during these events/);
    assert.match(html, /no changed outcome is claimed/);
  }
});
