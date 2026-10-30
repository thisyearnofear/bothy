import "./loadEnv";
import { postReceipt } from "./integrations/arweave";

async function main() {
  const res = await postReceipt(
    {
      v: 2,
      app: "bothy",
      kind: "assessment",
      subjectId: "smoke",
      moment: "generated",
      digest: "0".repeat(64),
      at: new Date().toISOString(),
      note: "bothy evidence-anchor smoke test",
    },
    { Kind: "assessment", Moment: "generated", Subject: "smoke", Digest: "0".repeat(64) },
  );
  console.log(JSON.stringify(res, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
