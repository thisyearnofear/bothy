import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { postReceipt, sha256Hex } from "./arweave";

const receipt = { v: 2, app: "bothy", kind: "assessment", subjectId: "x", moment: "generated", digest: "d", at: "2026-10-28T00:00:00.000Z" };
const tags = { Kind: "assessment", Moment: "generated", Subject: "x", Digest: "d" };

function withJwk<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.ARWEAVE_JWK;
  if (value === undefined) delete process.env.ARWEAVE_JWK;
  else process.env.ARWEAVE_JWK = value;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.ARWEAVE_JWK;
    else process.env.ARWEAVE_JWK = prev;
  });
}

describe("arweave adapter", () => {
  it("hashes strings as-is and objects canonically", () => {
    const digest = createHash("sha256").update('{"a":1,"b":[2,3]}').digest("hex");
    assert.equal(sha256Hex('{"a":1,"b":[2,3]}'), digest);
    assert.equal(sha256Hex({ b: [2, 3], a: 1 }), sha256Hex({ a: 1, b: [2, 3] }));
  });

  it("degrades gracefully when ARWEAVE_JWK is unset (local dev)", async () => {
    await withJwk(undefined, async () => {
      const res = await postReceipt(receipt, tags);
      assert.equal(res.posted, false);
      assert.ok(res.reason?.includes("ARWEAVE_JWK"));
      assert.equal(res.gateway, "https://arweave.net");
    });
  });

  it("refuses cleanly when ARWEAVE_JWK is malformed JSON", async () => {
    await withJwk("{not-json", async () => {
      const res = await postReceipt(receipt, tags);
      assert.equal(res.posted, false);
      assert.ok(res.reason?.includes("JSON"));
    });
  });

  it("refuses cleanly when ARWEAVE_JWK is not an Arweave key", async () => {
    await withJwk(JSON.stringify({ kty: "RSA" }), async () => {
      const res = await postReceipt(receipt, tags);
      assert.equal(res.posted, false);
      assert.ok(res.reason);
    });
  });
});
