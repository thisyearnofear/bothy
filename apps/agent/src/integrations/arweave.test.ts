import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReceipt, postEvidenceReceipt, sha256Hex } from "./arweave";

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
  it("builds a hash-only receipt that mirrors the assessment digest", async () => {
    const assessment = { id: "brief-gallium-001", findings: ["row-12", "url-4"] };
    const receipt = await buildReceipt("gallium-exposure", "2026-10-28", assessment);
    assert.equal(receipt.source, "bothy");
    assert.equal(receipt.digest, sha256Hex(assessment));
    assert.equal(receipt.assessmentId, "brief-gallium-001");
    assert.equal(receipt.scenario, "gallium-exposure");
  });

  it("degrades gracefully when ARWEAVE_JWK is unset (local dev)", async () => {
    await withJwk(undefined, async () => {
      const assessment = { id: "brief-gallium-001" };
      const res = await postEvidenceReceipt("gallium-exposure", "2026-10-28", assessment);
      assert.equal(res.posted, false);
      assert.equal(res.digest, sha256Hex(assessment));
      assert.equal(res.receipt?.digest, res.digest);
      assert.ok(res.reason?.includes("ARWEAVE_JWK"));
      assert.equal(res.gateway, "https://arweave.net");
    });
  });

  it("refuses cleanly when ARWEAVE_JWK is malformed JSON", async () => {
    await withJwk("{not-json", async () => {
      const res = await postEvidenceReceipt("gallium-exposure", "2026-10-28", { id: "x" });
      assert.equal(res.posted, false);
      assert.ok(res.reason?.includes("JSON"));
    });
  });

  it("refuses cleanly when ARWEAVE_JWK is not an Arweave key", async () => {
    await withJwk(JSON.stringify({ kty: "RSA" }), async () => {
      const res = await postEvidenceReceipt("gallium-exposure", "2026-10-28", { id: "x" });
      assert.equal(res.posted, false);
      assert.ok(res.reason);
    });
  });
});
