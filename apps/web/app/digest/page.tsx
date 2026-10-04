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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = digests.find((digest) => digest.id === selectedId) ?? digests[0];

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
      <ol className="outbox-flow mt-4" aria-label="Notification loop"><li>Watch a lane</li><li>Scenario queues a case link</li><li>Configured sender handles delivery</li></ol>
      <p className="hint">This wall shows queued records only. It does not confirm delivery.</p>

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

      <section className="outbox-reader mt-6" aria-label="Digests">
        {digests.length === 0 && (
          <p className="mono text-sm" style={{ color: "var(--text-faint)" }}>No digests yet — run a scenario in the watch room, then fan a notify to its lane.</p>
        )}
        {digests.length > 0 && <ul className="outbox-index" aria-label="Queued messages">{digests.map((d) => <li key={d.id}>
          <button type="button" aria-pressed={selected?.id === d.id} onClick={() => setSelectedId(d.id)}>
            <span className="docref">{d.at}</span><strong>{d.subject}</strong><span>To {d.to}</span>
          </button>
        </li>)}</ul>}
        {selected && <article className="outbox-message" aria-label="Selected message">
          <p className="sr-only" role="status">Reading queued message: {selected.subject}</p>
          <p className="eyebrow">Queued / not delivery-confirmed</p><h2>{selected.subject}</h2>
          <dl className="record-status"><div><dt>To</dt><dd>{selected.to}</dd></div><div><dt>Recorded</dt><dd>{selected.at}</dd></div></dl>
          <p className="mono whitespace-pre-wrap break-words">{selected.body}</p>
          <Link href={selected.caseHref} className="btn mt-5">Open case →</Link>
        </article>}
      </section>

      <Link href="/watch" className="mono mt-4 inline-block text-xs underline" style={{ color: "var(--cursor)" }}>← back to watch room</Link>
    </div>
    </main>
  );
}
