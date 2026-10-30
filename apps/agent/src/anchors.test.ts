import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { AnchorStore } from "./anchors";
import type { ArweaveResult } from "./integrations/arweave";

const ok = (txId = "tx-1"): ArweaveResult => ({
  posted: true,
  txId,
  url: `https://arweave.net/${txId}`,
  gateway: "https://arweave.net",
});

describe("AnchorStore", () => {
  it("anchors a receipt and records txId/url", async () => {
    const calls: unknown[] = [];
    const store = new AnchorStore(new DatabaseSync(":memory:"), async (receipt) => {
      calls.push(receipt);
      return ok();
    });
    const rec = await store.anchor("assessment", "a-1", "generated", "digest-1", { scenario: "flood" });
    assert.equal(rec.state, "anchored");
    assert.equal(rec.txId, "tx-1");
    assert.equal(rec.url, "https://arweave.net/tx-1");
    assert.equal(rec.receipt.digest, "digest-1");
    assert.equal(rec.receipt.scenario, "flood");
    assert.equal(calls.length, 1);
  });

  it("is idempotent — an anchored row is returned without posting again", async () => {
    let calls = 0;
    const store = new AnchorStore(new DatabaseSync(":memory:"), async () => { calls += 1; return ok(); });
    const first = await store.anchor("assessment", "a-1", "generated", "digest-1", {});
    const second = await store.anchor("assessment", "a-1", "generated", "digest-1", {});
    assert.equal(first.txId, second.txId);
    assert.equal(calls, 1);
    assert.equal(store.list("assessment", "a-1").length, 1);
  });

  it("writes a pending row while the poster is in flight", async () => {
    let resolve: ((r: ArweaveResult) => void) | undefined;
    const store = new AnchorStore(new DatabaseSync(":memory:"), () => new Promise<ArweaveResult>((r) => { resolve = r; }));
    const pending = store.anchor("assessment", "a-1", "generated", "digest-1", {});
    const inflight = store.get("assessment", "a-1", "generated");
    assert.equal(inflight?.state, "pending");
    assert.equal(inflight?.digest, "digest-1");
    resolve!(ok());
    const done = await pending;
    assert.equal(done.state, "anchored");
  });

  it("records failures and retries on the next call", async () => {
    let calls = 0;
    const store = new AnchorStore(new DatabaseSync(":memory:"), async () => {
      calls += 1;
      return calls === 1
        ? { posted: false, gateway: "https://arweave.net", reason: "post rejected: HTTP 500" }
        : ok("tx-2");
    });
    const failed = await store.anchor("assessment", "a-1", "generated", "digest-1", {});
    assert.equal(failed.state, "failed");
    assert.equal(failed.reason, "post rejected: HTTP 500");
    const retried = await store.anchor("assessment", "a-1", "generated", "digest-1", {});
    assert.equal(retried.state, "anchored");
    assert.equal(retried.txId, "tx-2");
    assert.equal(calls, 2);
  });

  it("turns a throwing poster into a failed row, never a rejection", async () => {
    const store = new AnchorStore(new DatabaseSync(":memory:"), async () => {
      throw new Error("network exploded");
    });
    const rec = await store.anchor("assessment", "a-1", "generated", "digest-1", {});
    assert.equal(rec.state, "failed");
    assert.equal(rec.reason, "network exploded");
  });

  it("posts once when two calls race for the same key", async () => {
    let calls = 0;
    let resolve: ((r: ArweaveResult) => void) | undefined;
    const store = new AnchorStore(new DatabaseSync(":memory:"), () => {
      calls += 1;
      return new Promise<ArweaveResult>((r) => { resolve = r; });
    });
    const first = store.anchor("assessment", "a-1", "generated", "digest-1", {});
    const second = store.anchor("assessment", "a-1", "generated", "digest-1", {});
    resolve!(ok());
    const [a, b] = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.equal(a.txId, "tx-1");
    assert.equal(b.state, "pending");
    // The racer sees the pending row as its result; the stored row is anchored.
    assert.equal(store.get("assessment", "a-1", "generated")?.state, "anchored");
  });

  it("keeps moments and kinds separate per subject", async () => {
    const store = new AnchorStore(new DatabaseSync(":memory:"), async () => ok());
    await store.anchor("assessment", "a-1", "generated", "d-gen", {});
    await store.anchor("assessment", "a-1", "decided", "d-dec", {});
    await store.anchor("defense-brief", "a-1", "generated", "d-brief", {});
    const list = store.list("assessment", "a-1");
    assert.equal(list.length, 2);
    assert.equal(store.get("assessment", "a-1", "decided")?.digest, "d-dec");
    assert.equal(store.get("defense-brief", "a-1", "generated")?.digest, "d-brief");
  });
});
