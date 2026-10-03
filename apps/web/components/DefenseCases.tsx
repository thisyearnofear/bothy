"use client";

import { useEffect, useState } from "react";
import { api, isAbortError, recoveryMessage, type DefenseSession } from "../lib/api";
import type { DefenseCasePage, DefenseCaseFilter } from "../../../packages/shared/src/types";

export default function DefenseCases({ session, initialFilter = "all" }: { session: DefenseSession; initialFilter?: DefenseCaseFilter }) {
  const [page, setPage] = useState<DefenseCasePage | null>(null);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<DefenseCaseFilter>(initialFilter);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!session.authenticated) { setPage(null); return; }
    const ctl = new AbortController();
    setLoading(true); setError(""); setPage(null);
    api.defenseCases(offset, ctl.signal, filter).then((result) => { if (!ctl.signal.aborted) setPage(result); })
      .catch((e) => { if (!ctl.signal.aborted && !isAbortError(e)) setError(recoveryMessage(e)); })
      .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    return () => ctl.abort();
  }, [session.authenticated, session.subject, offset, retry, filter]);
  if (!session.authenticated) return null;
  return <section className="rounded-lg border p-4 sm:p-5" style={{ borderColor: "var(--rule)", background: "var(--panel)" }} aria-label="Saved defence cases">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Saved cases and verification work</h2>
      <button className="coarse-target rounded border px-3 py-2 text-sm" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Refresh cases</button>
    </div>
    <p className="mt-2 text-sm">{session.roles.includes("reviewer") ? "Synthetic demo review collection. Pending cases need review; approved cases without an owner need assignment." : "Your created cases and assigned verification work, within your verified roles."}</p>
    <label className="mt-3 block text-sm">Case view
      <select className="mt-2 block max-w-full rounded border px-3 py-2" style={{ background: "var(--panel)" }} value={filter} onChange={(event) => { setFilter(event.target.value as DefenseCaseFilter); setOffset(0); }}>
        <option value="all">All accessible cases</option>
        {session.roles.includes("reviewer") && <><option value="review">Awaiting review</option><option value="assignment">Awaiting assignment</option></>}
        {session.roles.includes("action-owner") && <option value="work">My active verification work</option>}
      </select>
    </label>
    {loading && <p role="status" className="mt-3 text-sm">Loading saved cases…</p>}
    {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
    {page && !page.cases.length && <p role="status" className="mt-3 text-sm">No accessible cases on this page.</p>}
    {page && <ul className="mt-4 space-y-3">{page.cases.map((item) => <li key={item.id} className="border-t pt-3" style={{ borderColor: "var(--rule)" }}>
      <a className="break-words text-sm font-semibold underline" href={`/defense?brief=${encodeURIComponent(item.id)}`}>{item.title}</a>
      <p className="mt-1 text-sm">{item.status === "pending" ? "Awaiting review" : item.status === "rejected" ? "Rejected" : !item.action ? "Approved · awaiting assignment" : `Verification ${item.action.status}`}</p>
      {item.action && <p className="mt-1 break-words text-sm">Owner: {item.action.owner}. Due {new Date(item.action.dueAt).toLocaleString()}{item.action.status !== "completed" && Date.parse(item.action.dueAt) < Date.now() ? " · overdue" : ""}.</p>}
    </li>)}</ul>}
    <div className="mt-4 flex gap-3">
      {offset > 0 && <button className="coarse-target rounded border px-3 py-2 text-sm" disabled={loading} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous cases</button>}
      {page?.nextOffset != null && <button className="coarse-target rounded border px-3 py-2 text-sm" disabled={loading} onClick={() => setOffset(page.nextOffset!)}>Next cases</button>}
    </div>
  </section>;
}
