"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function PilotInterestForm({ compact }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    api.pilotCount().then((c) => { if (!off) setCount(c.count); }).catch(() => { /* count optional */ });
    return () => { off = true; };
  }, []);

  const submit = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await api.pilotInterest({ name, org, email });
      setCount(r.count);
      setNote(r.degraded
        ? "Demo request counted, but contact details were not retained while the database was offline. Please retry when connected."
        : "Registered — pilot scope will be reviewed.");
      if (r.degraded) return;
      setName(""); setOrg(""); setEmail("");
    } catch (e) {
      setNote(String((e as Error)?.message ?? e));
    } finally { setBusy(false); }
  };

  const input = "min-w-0 flex-1 basis-40 rounded-lg border px-3 py-2.5 text-sm";
  const style = { borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" } as const;
  return (
    <div className={compact ? "" : "mt-2"}>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" className={input} style={style} />
        <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organisation" aria-label="Organisation" className={input} style={style} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="work email" aria-label="Email" type="email" className={input} style={style} />
        <button onClick={() => void submit()} disabled={busy || !email || !name} className="coarse-target rounded-lg border-2 px-5 py-2.5 text-sm font-medium disabled:opacity-50" style={{ borderColor: "var(--text-strong)", color: "var(--text-body)" }}>
          {busy ? "sending…" : "Request pilot"}
        </button>
      </div>
      <p className="mono mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
        {note ?? (count != null ? `${count} recorded requests · not validated traction` : "Two-week pilot · one dataset · one impact question")}
      </p>
    </div>
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
