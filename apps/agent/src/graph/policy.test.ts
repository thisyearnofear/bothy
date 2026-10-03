import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SCENARIOS } from "./scenarios";
import { BLAST_QUERIES, graphQuery, graphSimulate } from "./turing";

test("every scenario is explicitly reviewed in the sidecar read-only catalogue", () => {
  const policy = JSON.parse(readFileSync(new URL("./read-policy.json", import.meta.url), "utf8"));
  for (const scenario of SCENARIOS) assert.ok(policy.reads[scenario.graph].includes(scenario.cypher), scenario.id);
  for (const query of [BLAST_QUERIES.bom8("Loitering munition"), BLAST_QUERIES.materialExposure("Primary gallium"),
    BLAST_QUERIES.ownership("CHN"), BLAST_QUERIES.chokepoint("Taiwan Strait")]) {
    assert.ok(policy.reads.supply_chain_deep.includes(query));
  }
  for (const reads of Object.values(policy.reads) as string[][]) {
    assert.ok(reads.every((read) => /^MATCH /.test(read) && !/\b(CREATE|SET|DELETE|CALL|SUBMIT)\b/.test(read)));
  }
});

test("agent rejects arbitrary reads/writes and simulation before contacting even a legacy sidecar", async () => {
  const native = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network must not be touched"); };
  try {
    await assert.rejects(graphQuery("supply_chain_deep", "MATCH (n) SET n.x = 1"), /read-only catalogue/);
    await assert.rejects(graphQuery("supply_chain_deep", SCENARIOS[1].cypher, "HEAD"), /hexadecimal/);
    await assert.rejects(graphSimulate({ graph: "supply_chain_deep", writes: ["CREATE (n)"], readCypher: SCENARIOS[1].cypher }), /reviewed/);
  } finally { globalThis.fetch = native; }
});
