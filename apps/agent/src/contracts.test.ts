import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const { api } = createRequire(import.meta.url)("../../web/lib/api.ts") as typeof import("../../web/lib/api");

test("web API unwraps catalogue and benchmark envelopes and uses captured run export", async () => {
  const native = globalThis.fetch;
  const calls: { path: string; body?: unknown }[] = [];
  globalThis.fetch = async (input, options) => {
    const path = String(input);
    const body = options?.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({ path, body });
    const data = path === "/api/graph/scenarios" ? { scenarios: [{ id: "gallium-exposure" }] }
      : path === "/api/graph/bench" ? { results: [{ id: "gallium-exposure", ms: 8, count: 34 }], totalMs: 8 }
      : path === "/api/pilot-interest/count" ? { count: 3 }
      : {};
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.equal((await api.graphScenarios())[0].id, "gallium-exposure");
    assert.equal((await api.graphBench())[0].count, 34);
    assert.equal((await api.pilotCount()).count, 3);
    await api.graphWitness({ runId: "server-run" });
    assert.deepEqual(calls.at(-1), { path: "/api/graph/witness", body: { runId: "server-run" } });
    await api.runScenario("gallium-exposure", { commit: "abc12345" });
    assert.deepEqual(calls.at(-1)?.body, { commit: "abc12345" });
  } finally {
    globalThis.fetch = native;
  }
});
