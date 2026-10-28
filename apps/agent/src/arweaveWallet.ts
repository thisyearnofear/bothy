// Wallet readiness check for the Arweave evidence adapter.
//
//   cd apps/agent
//   npx tsx src/arweaveWallet.ts           # uses ARWEAVE_JWK if set
//   ARWEAVE_JWK='{...}' npx tsx src/arweaveWallet.ts
//
// With no ARWEAVE_JWK it generates a fresh wallet and prints the JWK + address
// so you can fund it, then re-run with the key set. With a JWK it prints the
// derived address and the winston/AR balance — exactly what postEvidenceReceipt
// checks before posting.
import Arweave from "arweave";
import { walletInfo } from "./integrations/arweave";

const AR_TO_WINSTON = 1_000_000_000_000;

async function main() {
  if (process.env.ARWEAVE_JWK) {
    const { address, balanceWinston } = await walletInfo();
    const ar = Number(balanceWinston) / AR_TO_WINSTON;
    console.log(`address:  ${address}`);
    console.log(`balance:  ${balanceWinston} winston (${ar} AR)`);
    if (balanceWinston === "0") {
      console.log("\nWallet is unfunded — a ~300-byte receipt costs a tiny");
      console.log("fraction of an AR. Fund the address above and re-run.");
      process.exitCode = 1;
    } else {
      console.log("\nReady — POST /api/scenario/:scenario/assess will anchor receipts.");
    }
    return;
  }

  const arweave = Arweave.init({ host: "arweave.net", port: 443, protocol: "https" });
  const jwk = await arweave.wallets.generate();
  const address = await arweave.wallets.jwkToAddress(jwk);
  console.log("No ARWEAVE_JWK set — generated a fresh wallet:\n");
  console.log(`ARWEAVE_JWK='${JSON.stringify(jwk)}'`);
  console.log(`\naddress:  ${address}`);
  console.log("\nFund that address with a small amount of AR, export the JWK");
  console.log("above as ARWEAVE_JWK, then re-run this script to confirm.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
