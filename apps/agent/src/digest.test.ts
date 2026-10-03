import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResult } from "pg";
import { sendDigest } from "./digest";
import { notifySubscribers, updateDecision, type AssessmentRow } from "./repo";

function notification(status: string) {
  return {
    id: 1, target: "analyst@example.test", route_id: "demo-route", label: "HIGH",
    assessment_id: "demo-assessment", draft: "Approved fixture", score: 0.8,
    confidence: 0.7, assessment_status: status,
  };
}

test("sender selects approved assessments and blocks pending/rejected rows defensively", async () => {
  const writes: string[] = [];
  let sends = 0;
  const result = await sendDigest(20, {
    query: async (sql) => {
      if (sql.startsWith("SELECT")) {
        assert.match(sql, /a\.status = 'approved'/);
        return { rows: [notification("pending"), notification("rejected")] } as QueryResult;
      }
      writes.push(sql);
      return { rows: [] } as unknown as QueryResult;
    },
    fetch: async () => { sends++; return new Response("{}", { status: 200 }); },
    env: { RESEND_API_KEY: "unit-test-placeholder" }, log: () => undefined,
  });
  assert.equal(sends, 0);
  assert.deepEqual(writes, []);
  assert.deepEqual(result, { sent: 0, skipped: 2, logged: 0 });
});

test("approved notification uses the sender and records delivery", async () => {
  const writes: string[] = [];
  let sends = 0;
  const result = await sendDigest(20, {
    query: async (sql) => {
      if (sql.startsWith("SELECT")) return { rows: [notification("approved")] } as QueryResult;
      writes.push(sql);
      return { rows: [] } as unknown as QueryResult;
    },
    fetch: async (_url, options) => {
      sends++;
      assert.match(String(options?.body), /Approved case:/);
      return new Response("{}", { status: 200 });
    },
    env: { RESEND_API_KEY: "unit-test-placeholder" }, log: () => undefined,
  });
  assert.equal(sends, 1);
  assert.match(writes[0], /status = 'sent'/);
  assert.deepEqual(result, { sent: 1, skipped: 0, logged: 0 });
});

test("log-only mode does not expose recipient/body or claim delivery", async () => {
  const logs: string[] = [];
  const result = await sendDigest(20, {
    query: async (sql) => {
      assert.ok(sql.startsWith("SELECT"), "log-only mode must not write a sent status");
      return { rows: [notification("approved")] } as QueryResult;
    },
    fetch: async () => { throw new Error("must not send"); },
    env: {}, log: (message) => logs.push(message),
  });
  assert.deepEqual(result, { sent: 0, skipped: 1, logged: 1 });
  assert.equal(logs.some((line) => line.includes("example.test") || line.includes("Approved fixture")), false);
});

test("pending and rejected assessments never query the subscriber queue", async () => {
  for (const status of ["pending", "rejected"]) {
    assert.equal(await notifySubscribers({ status, label: "HIGH" } as AssessmentRow), 0);
  }
});

test("review update is conditional and never overwrites a prior decision", async () => {
  const query = async (sql: string) => {
    assert.match(sql, /status = 'pending'/);
    assert.match(sql, /RETURNING \*/);
    return { rows: [] } as unknown as QueryResult;
  };
  assert.equal(await updateDecision("already-decided", "approved", "demo officer", query), null);
});
