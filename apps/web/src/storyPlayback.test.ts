import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BEAT_MS, playbackRemaining, playbackSeconds } from "../lib/storyPlayback";
import { guidedDeskAction, guidedDeskComplete } from "../lib/guidedDesk";
import type { SandboxState } from "../lib/api";
import StoryVisual from "../components/StoryVisual";
import SandboxClaim from "../components/SandboxClaim";
import StoryStage from "../components/StoryStage";
import DemoPage from "../app/defense/demo/page";
import { STORIES, clockDays } from "../lib/stories";

const base: SandboxState = { sid: "fixture", briefStatus: "pending", actionStatus: "none", reassessed: false, evidenceEdited: false, claims: [], steps: [], available: [] };

test("playback countdown derives from a deadline and clamps overdue time", () => {
  assert.equal(BEAT_MS, 8000);
  assert.equal(playbackRemaining(9000, 1000), 8000);
  assert.equal(playbackRemaining(9000, 4500), 4500);
  assert.equal(playbackRemaining(9000, 9100), 0);
  assert.equal(playbackRemaining(9000, 0), 8000);
  assert.equal(playbackSeconds(4500), 5);
  assert.equal(playbackSeconds(0), 0);
});

test("guided actions follow current store state instead of replaying a stale plan", () => {
  assert.equal(guidedDeskAction(base), "approve");
  assert.equal(guidedDeskAction({ ...base, briefStatus: "approved" }), "assign");
  assert.equal(guidedDeskAction({ ...base, briefStatus: "approved", actionStatus: "assigned" }), "acknowledge");
  assert.equal(guidedDeskAction({ ...base, briefStatus: "approved", actionStatus: "acknowledged" }), "complete");
  assert.equal(guidedDeskAction({ ...base, briefStatus: "approved", actionStatus: "completed" }), "accept");
  assert.equal(guidedDeskAction({ ...base, reassessed: true, briefStatus: "approved", actionStatus: "completed" }), "verify");
});

test("the guided walkthrough ends after rejection or a post-acceptance audit check", () => {
  assert.equal(guidedDeskComplete({ ...base, briefStatus: "rejected" }), true);
  assert.equal(guidedDeskAction({ ...base, briefStatus: "rejected" }), null);
  assert.equal(guidedDeskComplete({ ...base, reassessed: true }), false);
  const checked = { ...base, reassessed: true, steps: [{ label: "Verify the audit chain", outcome: "verified" as const, detail: "Verified" }] };
  assert.equal(guidedDeskComplete(checked), true);
  assert.equal(guidedDeskAction(checked), null);
});

test("gallium dates have distinct instruments and retain policy boundaries", () => {
  const expected = ["Licensing required", "Prohibited", "Military end-user prohibition remains", "US-specific suspension schedule"];
  for (const [index, beat] of STORIES[0].beats.entries()) {
    const html = renderToStaticMarkup(createElement(StoryVisual, { beat, index, days: clockDays(beat, Date.UTC(2026, 9, 4)), run: null }));
    assert.ok(html.includes(expected[index]));
    if (beat.act) assert.match(html, /Awaiting captured evidence/);
  }
});

test("sandbox findings are readable but retain the actual claim and fixture boundary", () => {
  const claim = "p.name: Sample platform; c.name: Sample component; g.name: Primary gallium";
  const html = renderToStaticMarkup(createElement(SandboxClaim, { claim, index: 0 }));
  for (const text of ["Sample platform", "Sample component", "Primary gallium", "Grouped claim fields", "can use fixture evidence"]) assert.ok(html.includes(text));
  assert.ok(html.includes(claim));
});

test("unstructured sandbox claims are not embellished and names are escaped", () => {
  const html = renderToStaticMarkup(createElement(SandboxClaim, { claim: "<script>missing dependency</script>", index: 0 }));
  assert.match(html, /&lt;script&gt;missing dependency/);
  assert.doesNotMatch(html, /class="claim-chain"|<script>/);
});

test("initial countdown is not a second-by-second live announcement", () => {
  const html = renderToStaticMarkup(createElement(StoryStage, { story: STORIES[0], autoplay: true }));
  assert.match(html, /class="beat-countdown" aria-label="Time until the next story beat"/);
  assert.match(html, /Paused:.*Exports prohibited/);
  assert.doesNotMatch(html, /class="beat-countdown"[^>]*aria-live/);
});

test("guided demo leads with a compact briefing instead of another large hero", () => {
  const html = renderToStaticMarkup(createElement(DemoPage));
  assert.match(html, /A deadline\. A dependency\. A named check\./);
  assert.match(html, /Eight seconds per date/);
  assert.doesNotMatch(html, /page-hero|about two minutes/);
});

test("eight-second guided beats use short reading copy, not the full narrative", () => {
  for (const beat of STORIES[0].beats.filter((beat) => !beat.act)) {
    assert.ok(beat.briefing);
    assert.ok(beat.briefing.split(/\s+/).length <= 24);
  }
  const guided = renderToStaticMarkup(createElement(StoryStage, { story: STORIES[0], autoplay: true }));
  const full = renderToStaticMarkup(createElement(StoryStage, { story: STORIES[0] }));
  assert.ok(guided.includes(STORIES[0].beats[0].briefing!));
  assert.ok(full.includes(STORIES[0].beats[0].narration));
});
