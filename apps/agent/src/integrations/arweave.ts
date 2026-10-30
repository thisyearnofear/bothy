import { createHash } from "node:crypto";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/node/lib/wallet";
import { canonicalJSON } from "../../../../packages/shared/src/anchor";

// ---------------------------------------------------------------------------
// Arweave receipt poster (Decentralize AI: "verifiable AI systems").
//
// The agent anchors hash-only *evidence receipts* to Arweave mainnet so a
// finding — assessment generated, officer decision, defence brief drafted or
// reviewed — is permanently checkable by anyone. The receipt lands at
// https://arweave.net/<txId>; a verifier recomputes sha256 over the canonical
// anchor payload (packages/shared/src/anchor.ts) and compares it to `digest`.
//
// Grace notes (the live dev loop must never break):
//  - If ARWEAVE_JWK is unset the caller still succeeds; the result is
//    { posted: false, reason }.
//  - A malformed or unfunded key is reported the same way — never thrown.
//
// Defaults point at mainnet. For local dry runs, run `npx arlocal` and set
// ARWEAVE_HOST=localhost ARWEAVE_PORT=1984 ARWEAVE_PROTOCOL=http.
// ---------------------------------------------------------------------------

export interface ArweaveResult {
  posted: boolean;
  txId?: string;
  /** Permanent URL of the anchored receipt, e.g. https://arweave.net/<txId> */
  url?: string;
  gateway: string;
  /** Address derived from ARWEAVE_JWK — share this to get the wallet funded */
  address?: string;
  /** Wallet balance in winston, when the probe succeeded */
  balanceWinston?: string;
  reason?: string;
}

const ARWEAVE_HOST = process.env.ARWEAVE_HOST ?? "arweave.net";
const ARWEAVE_PORT = Number(process.env.ARWEAVE_PORT ?? 443);
const ARWEAVE_PROTOCOL = process.env.ARWEAVE_PROTOCOL ?? "https";
const ARWEAVE_GATEWAY =
  process.env.ARWEAVE_GATEWAY ??
  `${ARWEAVE_PROTOCOL}://${ARWEAVE_HOST}${
    ARWEAVE_PORT === 443 || ARWEAVE_PORT === 80 ? "" : `:${ARWEAVE_PORT}`
  }`;
const ARWEAVE_APP = process.env.ARWEAVE_APP_NAME ?? "bothy-evidence";

// Strings hash as-is; objects hash their canonical form so the digest is
// reproducible regardless of stored key order.
export const sha256Hex = (v: unknown): string =>
  createHash("sha256")
    .update(typeof v === "string" ? v : canonicalJSON(v))
    .digest("hex");

function client(): Arweave {
  return Arweave.init({
    host: ARWEAVE_HOST,
    port: ARWEAVE_PORT,
    protocol: ARWEAVE_PROTOCOL,
    timeout: 15_000,
  });
}

/** Derive the wallet address + balance from ARWEAVE_JWK. Throws on bad input. */
export async function walletInfo(): Promise<{
  address: string;
  balanceWinston: string;
}> {
  const jwkEnv = process.env.ARWEAVE_JWK;
  if (!jwkEnv) throw new Error("ARWEAVE_JWK not set");
  const arweave = client();
  const address = await arweave.wallets.jwkToAddress(
    JSON.parse(jwkEnv) as JWKInterface,
  );
  const balanceWinston = await arweave.wallets.getBalance(address);
  return { address, balanceWinston };
}

/** Post a receipt object to Arweave mainnet. Never throws — every failure is
 *  reported as { posted: false, reason }. */
export async function postReceipt(
  receipt: Record<string, unknown>,
  tags: Record<string, string>,
): Promise<ArweaveResult> {
  const base: ArweaveResult = { posted: false, gateway: ARWEAVE_GATEWAY };

  const jwkEnv = process.env.ARWEAVE_JWK;
  if (!jwkEnv) return { ...base, reason: "ARWEAVE_JWK not set" };

  let wallet: JWKInterface;
  try {
    wallet = JSON.parse(jwkEnv) as JWKInterface;
  } catch {
    return { ...base, reason: "ARWEAVE_JWK is not valid JSON" };
  }

  const arweave = client();

  let address: string | undefined;
  try {
    address = await arweave.wallets.jwkToAddress(wallet);
  } catch {
    return { ...base, reason: "ARWEAVE_JWK is not a valid Arweave key" };
  }

  // Best-effort balance probe — an unfunded wallet would get rejected by the
  // network anyway; this just surfaces a clearer reason. Never blocks posting.
  let balanceWinston: string | undefined;
  try {
    balanceWinston = await arweave.wallets.getBalance(address);
    if (balanceWinston === "0") {
      return {
        ...base,
        address,
        balanceWinston,
        reason: "wallet has no AR — fund this address first",
      };
    }
  } catch {
    // probe failed (gateway hiccup); fall through and let post() report reality
  }

  try {
    const tx = await arweave.createTransaction(
      { data: JSON.stringify(receipt) },
      wallet,
    );
    tx.addTag("App-Name", ARWEAVE_APP);
    tx.addTag("Content-Type", "application/json");
    for (const [name, value] of Object.entries(tags)) tx.addTag(name, value);

    // tx.id is populated by sign() — it's the hash of the signature.
    await arweave.transactions.sign(tx, wallet);
    const res = await arweave.transactions.post(tx);
    if (res.status !== 200 && res.status !== 202) {
      return {
        ...base,
        address,
        balanceWinston,
        reason: `post rejected: HTTP ${res.status} ${res.statusText}`,
      };
    }
    return {
      posted: true,
      txId: tx.id,
      url: `${ARWEAVE_GATEWAY}/${tx.id}`,
      gateway: ARWEAVE_GATEWAY,
      address,
      balanceWinston,
    };
  } catch (e) {
    return {
      ...base,
      address,
      balanceWinston,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
