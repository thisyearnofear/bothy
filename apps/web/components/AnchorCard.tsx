"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Assessment, DefenseBrief } from "../../../packages/shared/src/types";
import {
  assessmentAnchorPayload,
  briefAnchorPayload,
  canonicalJSON,
  decisionAnchorPayload,
  type AnchorKind,
  type AnchorMoment,
  type AnchorRecord,
} from "../../../packages/shared/src/anchor";
import { api, isAbortError } from "../lib/api";

// "Permanent public record": renders the Arweave anchor rows for the record on
// screen and lets a judge verify them — recompute the fingerprint in the
// browser, compare it to what the receipt committed to on mainnet.

const MOMENT_LABEL: Record<AnchorMoment, string> = {
  generated: "Generated",
  decided: "Decided",
};

const MOMENTS: AnchorMoment[] = ["generated", "decided"];

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const shortTx = (tx: string) => (tx.length > 16 ? `${tx.slice(0, 6)}…${tx.slice(-6)}` : tx);

const failureText = (reason?: string) =>
  reason?.includes("ARWEAVE_JWK not set")
    ? "Not anchored — this deployment has no project wallet configured"
    : `Anchor failed${reason ? ` — ${reason}` : ""}`;

type VerifyOutcome =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "match" }
  | { state: "mismatch"; detail: string }
  | { state: "propagating" };

export default function AnchorCard({
  kind,
  subjectId,
  record,
  auditHashes,
  version,
}: {
  kind: AnchorKind;
  subjectId: string;
  /** The object on screen — the verify button recomputes its fingerprint. */
  record: Assessment | DefenseBrief;
  /** Chained audit hashes for defense briefs; decided anchors pin one of them. */
  auditHashes?: string[];
  /** Bump to refetch after the record changes (e.g. `${id}-${status}`). */
  version: string;
}) {
  const [rows, setRows] = useState<AnchorRecord[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [verify, setVerify] = useState<Partial<Record<AnchorMoment, VerifyOutcome>>>({});
  const started = useRef(0);

  const generatedDigest = useCallback(
    () =>
      sha256Hex(
        canonicalJSON(
          kind === "assessment"
            ? assessmentAnchorPayload(record as Assessment)
            : briefAnchorPayload(record as DefenseBrief),
        ),
      ),
    [kind, record],
  );

  useEffect(() => {
    started.current = Date.now();
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setVerify({});
    const poll = async () => {
      try {
        const list = await api.anchors(kind, subjectId);
        if (stop) return;
        setRows(list);
        setUnreachable(false);
        const awaiting =
          list.some((r) => r.state === "pending") ||
          !list.some((r) => r.moment === "generated") ||
          (record.status !== "pending" && !list.some((r) => r.moment === "decided"));
        if (awaiting && Date.now() - started.current < 60_000) {
          timer = setTimeout(poll, 3_000);
        }
      } catch (e) {
        if (stop || isAbortError(e)) return;
        setUnreachable(true);
      }
    };
    void poll();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [kind, subjectId, version, record.status]);

  const verifyRow = async (row: AnchorRecord) => {
    if (!row.url) return;
    setVerify((v) => ({ ...v, [row.moment]: { state: "checking" } }));
    const done = (outcome: VerifyOutcome) => setVerify((v) => ({ ...v, [row.moment]: outcome }));
    try {
      const res = await fetch(row.url);
      const text = res.ok ? await res.text() : "";
      let receipt: Record<string, unknown>;
      try {
        receipt = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return done({ state: "propagating" });
      }
      if (!receipt || typeof receipt.digest !== "string") return done({ state: "propagating" });

      const expected = await generatedDigest();
      const status = (record as Assessment).status;
      if (row.moment === "generated") {
        if (receipt.digest !== row.digest) return done({ state: "mismatch", detail: "receipt digest differs from the recorded anchor" });
        if (expected !== receipt.digest) return done({ state: "mismatch", detail: "recomputed fingerprint differs — the record changed after anchoring" });
        return done({ state: "match" });
      }
      // Decided: the receipt carries the decision payload; recompute it.
      const decisionPayload = decisionAnchorPayload({
        subjectDigest: String(receipt.subjectDigest ?? ""),
        decision: String(receipt.decision ?? ""),
        decidedAt: String(receipt.decidedAt ?? ""),
        actorDigest: String(receipt.actorDigest ?? ""),
        ...(receipt.auditHead !== undefined ? { auditHead: String(receipt.auditHead) } : {}),
      });
      const recomputed = await sha256Hex(canonicalJSON(decisionPayload));
      if (recomputed !== receipt.digest) return done({ state: "mismatch", detail: "decision fingerprint does not recompute" });
      if (receipt.subjectDigest !== expected) return done({ state: "mismatch", detail: "the decision does not chain to this record's generation fingerprint" });
      if (receipt.decision !== status) return done({ state: "mismatch", detail: "the anchored decision differs from the status on screen" });
      if (kind === "defense-brief" && auditHashes?.length && typeof receipt.auditHead === "string" && !auditHashes.includes(receipt.auditHead)) {
        return done({ state: "mismatch", detail: "the pinned audit head is not in this brief's audit chain" });
      }
      return done({ state: "match" });
    } catch {
      return done({ state: "propagating" });
    }
  };

  if (!rows) return null;
  if (unreachable && !rows.length) return null;
  if (!rows.length) return null; // legacy records predate anchoring

  const momentRow = (m: AnchorMoment) => rows.find((r) => r.moment === m);

  return (
    <section className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-label="Permanent public record" aria-live="polite">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
        Permanent public record
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
        A fingerprint of this record — not the record itself — is stored permanently on Arweave. Anyone can recompute it.
      </p>
      <ul className="mt-2 space-y-2">
        {MOMENTS.map((moment) => {
          const row = momentRow(moment);
          if (!row) return null;
          const outcome = verify[moment];
          return (
            <li key={moment} className="border-t pt-2" style={{ borderColor: "var(--rule)" }}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)", minWidth: "5.5em" }}>
                  {MOMENT_LABEL[moment]}
                </span>
                {row.state === "pending" && (
                  <>
                    <span className="pill" data-live="true">Anchoring</span>
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>Anchoring to Arweave…</span>
                  </>
                )}
                {row.state === "anchored" && row.txId && (
                  <>
                    <span className="pill" data-state="verified">Anchored</span>
                    <span className="mono text-xs" style={{ color: "var(--text-body)" }}>{shortTx(row.txId)}</span>
                    {row.url && (
                      <a href={row.url} target="_blank" rel="noopener" className="mono text-xs underline" style={{ color: "var(--cursor)" }}>
                        View on Arweave ↗
                      </a>
                    )}
                    <button type="button" className="mono text-xs underline" style={{ color: "var(--cursor)" }} disabled={outcome?.state === "checking"} onClick={() => void verifyRow(row)}>
                      {outcome?.state === "checking" ? "Verifying…" : "Verify"}
                    </button>
                  </>
                )}
                {row.state === "failed" && (
                  <span className="text-xs" style={{ color: "var(--text-body)" }}>{failureText(row.reason)}</span>
                )}
              </div>
              {outcome?.state === "match" && (
                <p className="mono mt-1 text-xs" style={{ color: "var(--text-body)" }}>
                  ✓ Matches the record on screen
                </p>
              )}
              {outcome?.state === "mismatch" && (
                <p className="mono mt-1 text-xs" style={{ color: "oklch(64% 0.21 25)" }}>
                  ✗ Does not match — {outcome.detail}
                </p>
              )}
              {outcome?.state === "propagating" && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                  Receipt mined; gateway is still propagating the data — try again in a minute
                </p>
              )}
              {row.moment === "decided" && row.state === "anchored" && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                  Reviewer identity committed (hashed), not revealed.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
