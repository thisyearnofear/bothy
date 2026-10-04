"use client";

import { useEffect, useState } from "react";
import { api, isAbortError, type AuditVerification } from "../lib/api";

// Recomputes the stored hash chain on demand, so the badge reflects the log as it is now.
export default function AuditBadge({ briefId, version }: { briefId: string; version: string }) {
  const [result, setResult] = useState<AuditVerification | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setBusy(true);
    api.verifyAudit(briefId, ctl.signal).then((value) => { if (!ctl.signal.aborted) { setResult(value); setFailed(false); } })
      .catch((e) => { if (!ctl.signal.aborted && !isAbortError(e)) setFailed(true); })
      .finally(() => { if (!ctl.signal.aborted) setBusy(false); });
    return () => ctl.abort();
  }, [briefId, version, nonce]);

  if (failed) return <p className="text-xs" role="status">Audit chain could not be checked right now.</p>;
  if (!result) return null;
  const state = result.ok ? "verified" : "tamper-detected";
  const label = result.events === 0 ? "No decisions recorded yet"
    : result.ok ? `Audit chain verified · ${result.verified} of ${result.events} entries`
    : `Audit chain broken at entry ${result.brokenAt}`;
  return <div className="flex flex-wrap items-center gap-3 text-sm" role="status" aria-live="polite">
    <span className="pill" data-state={state} data-live={busy}>{result.events === 0 ? "No entries" : result.ok ? "Verified" : "Tamper detected"}</span>
    <span>{label}</span>
    {result.unchained > 0 && <span style={{ color: "var(--text-faint)" }}>{result.unchained} earlier entries predate chaining</span>}
    <button className="text-xs underline" disabled={busy} onClick={() => setNonce((value) => value + 1)}>Re-verify</button>
  </div>;
}
