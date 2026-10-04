"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { SiteHeader } from "../../components/PageHero";
import { card } from "../../lib/ui";


type Digest = { id: string; to: string; subject: string; body: string; caseHref: string; at: string };

/** Public log-only digest wall: proves the loop fires with no email infra. */
export default function DigestPage() {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [subs, setSubs] = useState(0);
  const [email, setEmail] = useState("");
  const [lane, setLane] = useState("gallium-exposure");
  const [note, setNote] = useState<string | null>(null);

  const refresh = () => {
    api.loopDigest().then((d) => { setDigests(d.digests); setSubs(d.subs); }).catch(() => {});
  };
  useEffect(refresh, []);

  const subscribe = async () => {
    setNote(null);
    try {
      const r = await api.loopSubscribe({ email, routeId: lane, scenario: "defense" });
      setNote(`Watching ${lane}. ${r.count} watcher(s) on this lane.`);
      setEmail("");
      refresh();
    } catch (e) {
      setNote(String((e as Error)?.message ?? e));
    }
  };

  return (
    <main>
    <SiteHeader />
    <div className="enter mx-auto max-w-3xl px-5 py-10 sm:px-10">
      <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Bothy loop · digest wall</p>
      <h1 className="mt-2 text-3xl font-semibold" style={{ color: "var(--text-strong)" }}>
        Notification outbox
      </h1>
      <div className="record-status mt-4"><span>Queued records ≠ delivery confirmation</span><span>{subs} lane subscriptions</span></div>
      <details className="disclosure mt-4"><summary>How the loop works</summary><p>Watch a lane. A scenario notification queues a digest with its case link for each watcher. Delivery depends on the configured sender; this wall alone does not confirm it.</p></details>

      <section className="mt-4 rounded-lg border p-3" style={card} aria-label="Subscribe">
        <div className="flex flex-wrap gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@cell.example" type="email" aria-label="Email"
            className="mono min-w-0 flex-1 rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" }} />
          <input value={lane} onChange={(e) => setLane(e.target.value)} placeholder="lane / scenario id" aria-label="Lane"
            className="mono rounded border px-2 py-1.5 text-sm" style={{ borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" }} />
          <button onClick={() => void subscribe()} disabled={!email || !lane} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>Watch this lane</button>
        </div>
        {note && <p className="mono mt-1 text-xs" style={{ color: "var(--cursor)" }}>{note}</p>}
      </section>

      <section className="mt-4 grid gap-2" aria-label="Digests">
        {digests.length === 0 && (
          <p className="mono text-sm" style={{ color: "var(--text-faint)" }}>No digests yet — run a scenario in the watch room, then fan a notify to its lane.</p>
        )}
        {digests.map((d) => (
          <div key={d.id} className="rounded-lg border p-3" style={card}>
            <p className="mono text-xs" style={{ color: "var(--text-faint)" }}>{d.at} · to {d.to}</p>
            <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-strong)" }}>{d.subject}</p>
            <details className="disclosure mt-3"><summary>Message body</summary><p className="mono whitespace-pre-wrap">{d.body}</p></details>
            <Link href={d.caseHref} className="mono mt-2 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>Open case →</Link>
          </div>
        ))}
      </section>

      <Link href="/watch" className="mono mt-4 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>← back to watch room</Link>
    </div>
    </main>
  );
}
