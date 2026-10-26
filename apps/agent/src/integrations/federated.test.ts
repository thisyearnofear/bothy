import assert from "node:assert/strict";
import test from "node:test";
import { captureFederation, federatedCatalogue, federatedHash } from "./federated";

const ROWS = { headers: ["supplier", "on_hand_units"], data: [["Meridian Compound Semis", 420], ["Baltic Photonics", 12]], total: 2 };

test("catalogue is reviewed per scenario and bounded", () => {
  const questions = federatedCatalogue("gallium-exposure");
  assert.ok(questions.length >= 2);
  for (const question of questions) {
    assert.match(question.sql, /^SELECT /i);
    assert.ok(question.limit <= 100);
    assert.ok(question.sourceBoundary.length > 20);
  }
  assert.equal(federatedCatalogue("unknown-scenario").length, 0);
});

test("capture maps engine rows to a pinned FederatedRun", async () => {
  const capture = await captureFederation("gallium-exposure", async (sql) => {
    assert.match(sql, /^SELECT /i);
    return ROWS;
  });
  assert.equal(capture.unavailable.length, 0);
  assert.equal(capture.runs.length, federatedCatalogue("gallium-exposure").length);
  const inventory = capture.runs.find((run) => run.questionId === "ops-inventory-contracts")!;
  assert.equal(inventory.kind, "rows");
  assert.equal(inventory.count, 2);
  assert.equal(inventory.rows[0].supplier, "Meridian Compound Semis");
  assert.equal(inventory.sqlHash.length, 64);
  assert.ok(inventory.runId);
});

test("a failed leg degrades to unavailable, never a thrown capture", async () => {
  const capture = await captureFederation("gallium-exposure", async (sql) => {
    if (sql.includes("UNION")) throw new Error("zetaris down");
    return ROWS;
  });
  assert.equal(capture.runs.length, 1);
  assert.deepEqual(capture.runs[0].questionId, "ops-inventory-contracts");
  assert.equal(capture.unavailable.length, federatedCatalogue("gallium-exposure").length - 1);
});

test("unconfigured federation reports every reviewed question unavailable", async () => {
  const saved = { url: process.env.ZETARIS_REST_URL, key: process.env.ZETARIS_API_KEY };
  delete process.env.ZETARIS_REST_URL;
  delete process.env.ZETARIS_API_KEY;
  try {
    const capture = await captureFederation("gallium-exposure");
    assert.equal(capture.runs.length, 0);
    assert.equal(capture.unavailable.length, federatedCatalogue("gallium-exposure").length);
  } finally {
    if (saved.url !== undefined) process.env.ZETARIS_REST_URL = saved.url;
    if (saved.key !== undefined) process.env.ZETARIS_API_KEY = saved.key;
  }
});

test("scenarios without a catalogue capture nothing", async () => {
  const capture = await captureFederation("red-sea-d01", async () => ROWS);
  assert.equal(capture.runs.length, 0);
  assert.equal(capture.unavailable.length, 0);
});

test("federated hash is order-sensitive and row-content-sensitive", async () => {
  const a = await captureFederation("gallium-exposure", async () => ROWS);
  const b = await captureFederation("gallium-exposure", async () => ({ ...ROWS, data: [["Different", 1]] }));
  assert.notEqual(federatedHash(a.runs), federatedHash(b.runs));
  const run = { ...a.runs[0], rows: [{ ...a.runs[0].rows[0], supplier: "Edited" }] };
  assert.notEqual(federatedHash([run]), federatedHash([a.runs[0]]));
});
