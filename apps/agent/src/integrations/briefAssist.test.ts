import test from "node:test";
import assert from "node:assert/strict";
import { critiqueNarrative, type AssistDeps } from "./briefAssist";
import type { FederatedRun } from "../../../../packages/shared/src/types";
import type { ProviderDef } from "../agent/providers";

const DEF: ProviderDef = {
  id: "stub", label: "stub", baseUrl: "http://127.0.0.1:1", apiKey: "", model: "stub-model",
  reqPerMin: 600, burst: 60, maxTokens: 500, timeoutMs: 1000, temperature: 0.1,
};

const RUN: FederatedRun = {
  runId: "r1", questionId: "q1", title: "Ops extract", kind: "rows", source: "zetaris",
  sql: "SELECT 1", sqlHash: "0".repeat(64), capturedAt: "2026-01-01T00:00:00Z",
  columns: ["supplier", "on_hand_units"],
  rows: [
    { supplier: "Meridian", on_hand_units: 420 },
    { supplier: "Nordwave", on_hand_units: 60 },
  ],
  count: 2, total: 2,
  sourceBoundary: "test",
};

const deps = (reply: string): AssistDeps => ({
  providers: () => [DEF],
  chat: (async () => ({ content: reply })) as never,
});

test("critique FLAGs an unfaithful line back to scripted (undefined)", async () => {
  const narrative = [["Meridian holds 420 units", "Nordwave invented a warehouse"]];
  const res = await critiqueNarrative([RUN], narrative, deps("PASS\nFLAG: warehouse not in row"));
  assert.ok(res);
  assert.equal(res.checked, 2);
  assert.equal(res.flagged, 1);
  assert.equal(narrative[0][0], "Meridian holds 420 units");
  assert.equal(narrative[0][1], undefined);
});

test("critique with all PASS keeps every line", async () => {
  const narrative = [["line one", "line two"]];
  const res = await critiqueNarrative([RUN], narrative, deps("PASS\nPASS"));
  assert.equal(res?.flagged, 0);
  assert.deepEqual(narrative[0], ["line one", "line two"]);
});

test("critique returns null with no providers and no work", async () => {
  assert.equal(await critiqueNarrative([RUN], [["x"]], { providers: () => [] }), null);
  assert.equal(await critiqueNarrative([RUN], [[undefined, undefined]], deps("PASS")), null);
});

test("provider failure falls through to the next provider", async () => {
  const seen: string[] = [];
  const res = await critiqueNarrative([RUN], [["x"]], {
    providers: () => [{ ...DEF, id: "dead" }, DEF],
    chat: (async (def: ProviderDef) => {
      seen.push(def.id);
      if (def.id === "dead") throw new Error("down");
      return { content: "PASS" };
    }) as never,
  });
  assert.equal(res?.model, "stub:stub-model");
  assert.deepEqual(seen, ["dead", "stub"]);
});
