import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STORIES, clockDays } from "../lib/stories";

describe("story clocks", () => {
  const gallium = STORIES[0];
  it("counts the notice period and the suspension window from the public dates", () => {
    assert.equal(clockDays(gallium.beats[0], 0), 29);
    assert.equal(clockDays(gallium.beats[2], 0), 383);
  });
  it("counts from now for the act beat and never goes undefined", () => {
    const now = Date.UTC(2026, 9, 4, 12);
    assert.equal(clockDays(gallium.beats[3], now), 54);
    assert.equal(clockDays(gallium.beats[1], now), null);
  });
  it("gives every story exactly one act beat, last, with a source on every event", () => {
    for (const story of STORIES) {
      assert.equal(story.beats.filter((beat) => beat.act).length, 1);
      assert.ok(story.beats.at(-1)?.act);
      for (const beat of story.beats) if (beat.event) assert.match(beat.event.source.url, /^https:\/\//);
    }
  });
});
