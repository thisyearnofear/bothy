import { createHash } from "node:crypto";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/node/lib/wallet";

// ---------------------------------------------------------------------------
// Arweave evidence-receipt adapter (Decentralize AI: "verifiable AI systems").
//
// After a brief is produced we anchor a hash-only *evidence receipt* to
// Arweave mainnet so the finding is permanently checkable by anyone:
//   { scenario, at, digest: sha256(assessment), source: "bothy", timestamp }
//
// The receipt lands at https://arweave.net/<txId> — a verifier recomputes
// sha256 over the assessment JSON from the same /assess response and compares
// it to `digest` in the anchored payload.
//
// Grace notes (the live dev loop must never break):
//  - If ARWEAVE_JWK is unset the endpoint still succeeds; the result is
//    { posted: false, reason } with the digest + receipt so the hash is
//    still observable.
//  - A malformed or unfunded key is reported the same way — never thrown.
//
// Defaults point at mainnet. For local dry runs, run `npx arlocal` and set
// ARWEAVE_HOST=localhost ARWEAVE_PORT=1984 ARWEAVE_PROTOCOL=http.
// ---------------------------------------------------------------------------

export interface EvidenceReceipt {
  scenario: string;
  at: string | number;
  digest: string; // sha256 of the assessment JSON (the evidence)
  assessmentId?: string;
  source: "bothy";
  timestamp: number; // epoch ms
}

export interface ArweaveResult {
  posted: boolean;
  txId?: string;
  /** Permanent URL of the anchored receipt, e.g. https://arweave.net/<txId> */
  url?: string;
  gateway: string;
  digest: string;
  /** The exact payload posted — recompute the digest from the assessment to verify */
  receipt?: EvidenceReceipt;
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

export const sha256Hex = (v: unknown): string =>
  createHash("sha256")
    .update(typeof v === "string" ? v : JSON.stringify(v))
    .digest("hex");

function client(): Arweave {
  return Arweave.init({
    host: ARWEAVE_HOST,
    port: ARWEAVE_PORT,
    protocol: ARWEAVE_PROTOCOL,
    timeout: 30_000,
  });
}

export async function buildReceipt(
  scenario: string,
  at: string | number,
  assessment: unknown,
): Promise<EvidenceReceipt> {
  const id =
    typeof assessment === "object" && assessment !== null && "id" in assessment
      ? String((assessment as { id?: unknown }).id)
      : undefined;
  return {
    scenario,
    at,
    digest: sha256Hex(assessment),
    assessmentId: id,
    source: "bothy",
    timestamp: Date.now(),
  };
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

export async function postEvidenceReceipt(
  scenario: string,
  at: string | number,
  assessment: unknown,
): Promise<ArweaveResult> {
  const receipt = await buildReceipt(scenario, at, assessment);
  const base: ArweaveResult = {
    posted: false,
    gateway: ARWEAVE_GATEWAY,
    digest: receipt.digest,
    receipt,
  };

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
    tx.addTag("Scenario", String(scenario));
    tx.addTag("Digest", receipt.digest);
    tx.addTag("Bothy-Source", "agent-assess");

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
      digest: receipt.digest,
      receipt,
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
