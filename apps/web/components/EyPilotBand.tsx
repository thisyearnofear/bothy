"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "../lib/api";

export function PilotInterestForm({ compact }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await api.pilotInterest({ name, org, email });
      setNote(r.degraded
        ? "Demo request counted, but contact details were not retained while the database was offline. Please retry when connected."
        : "Enquiry recorded. Scope and terms are not yet agreed.");
      if (r.degraded) return;
      setName(""); setOrg(""); setEmail("");
    } catch (e) {
      setNote(String((e as Error)?.message ?? e));
    } finally { setBusy(false); }
  };

  const input = "min-w-0 flex-1 basis-40 rounded-lg border px-3 py-2.5 text-sm";
  const style = { borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" } as const;
  return (
    <form className={compact ? "" : "mt-4"} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="flex flex-wrap gap-2">
        <label className="pilot-field">Name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={input} style={style} /></label>
        <label className="pilot-field">Organisation<input value={org} onChange={(e) => setOrg(e.target.value)} autoComplete="organization" className={input} style={style} /></label>
        <label className="pilot-field">Work email<input value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" type="email" className={input} style={style} /></label>
        <button type="submit" disabled={busy || !email || !name} className="btn btn-primary self-end">
          {busy ? "Sending…" : "Discuss a pilot"}
        </button>
      </div>
      {note && <p role="status" className="hint mt-2">{note}</p>}
    </form>
  );
}

export default function EyPilotBand() {
  return (
    <section aria-label="EY pilot" className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Readiness-2030 pilot</p>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
        For a European defence-prime supply-chain team. Two-week pilot: one dataset, one impact question, and agreed evidence/decision acceptance criteria.
      </p>
      <PilotInterestForm />
      <Link href="/pilot" className="mono mt-1 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>
        pilot one-pager →
      </Link>
    </section>
  );
}
