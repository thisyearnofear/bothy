import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GalliumExplanation from "../components/GalliumExplanation";
import type { GraphRun } from "../lib/api";

const run: GraphRun = {
  runId: "presentation", scenarioId: "gallium-chain", graph: "fixture", cypher: "fixture",
  queryHash: "fixture", graphCommit: "fixture", capturedAt: "2026-10-03T00:00:00Z",
  sourceBoundary: "Synthetic fixture", columns: ["p.name", "c.name", "g.name"],
  rows: [{ "p.name": "Modeled platform", "c.name": "Modeled component", "c.family": "GaAs", "g.name": "Primary gallium" }], count: 1, ms: 1,
};

test("presentation leads with captured overview and an explicit optional hierarchy reveal", () => {
  const html = renderToStaticMarkup(createElement(GalliumExplanation, { run }));
  assert.match(html, /A small material\. A long dependency\./);
  assert.match(html, /Modeled platform/);
  assert.match(html, /Modeled component/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /id="chain-presentation" hidden=""/);
  assert.match(html, /connectors are not direct edges/);
  assert.match(html, /Not a real BOM/);
  assert.match(html, /Not confirmed production loss/);
  assert.match(html, /Query limit: 10 paths/);
});

test("empty captured paths do not manufacture an explanation", () => {
  const html = renderToStaticMarkup(createElement(GalliumExplanation, { run: { ...run, rows: [], count: 0 } }));
  assert.match(html, /No chain rows captured/);
  assert.doesNotMatch(html, /Reveal the full dependency/);
});

test("captured names are escaped and missing values are disclosed", () => {
  const html = renderToStaticMarkup(createElement(GalliumExplanation, { run: { ...run, rows: [{ "p.name": "<script>untrusted</script>" }] } }));
  assert.match(html, /&lt;script&gt;untrusted&lt;\/script&gt;/);
  assert.match(html, /Not recorded/);
  assert.doesNotMatch(html, /<script>untrusted/);
});
