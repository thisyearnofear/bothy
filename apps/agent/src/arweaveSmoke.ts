import "./loadEnv";
import { postEvidenceReceipt } from "./integrations/arweave";

async function main() {
  const res = await postEvidenceReceipt("gallium-exposure", "2026-10-28", {
    note: "bothy evidence-anchor smoke test",
    context: "assessment endpoint blocked pending local Postgres/PostGIS — proving wallet->sign->post->gateway end to end",
  });
  console.log(JSON.stringify(res, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
