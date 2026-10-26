"use client";

import { useEffect, useState } from "react";
import { api, isAbortError } from "../lib/api";
import type { DefenseSession } from "../lib/api";

type MemoryStatus = {
  engine: string;
  memories: number;
  ledger: Record<string, number>;
  recent: { id: string; content: string; layer: string; tags: string[]; at: string }[];
};

type FederatedStatus = { configured: boolean; reachable?: boolean; detail?: string };

// Product-story strip: the two capabilities judges can't see from a single
// brief — the agent remembers prior work (Meterless H-MEM) and reaches beyond
// the curated graph (Zetaris federation, when configured).
export default function CaseStatusPanel({ session }: { session: DefenseSession }) {
  const [memory, setMemory] = useState<MemoryStatus | null>(null);
  const [federated, setFederated] = useState<FederatedStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session.authenticated) return;
    const ctl = new AbortController();
    api.defenseMemory(ctl.signal)
      .then((value) => { if (!ctl.signal.aborted) setMemory(value); })
      .catch((e) => { if (!ctl.signal.aborted && !isAbortError(e)) setFailed(true); });
    fetch("/api/defense/federated/status", { signal: ctl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((value) => { if (!ctl.signal.aborted) setFederated(value); })
      .catch(() => {});
    return () => ctl.abort();
  }, [session.authenticated]);

  if (!session.authenticated) return null;
  if (failed && !memory) return null;

  const latest = memory?.recent.at(-1);

  return (
    <section aria-label="Case memory and data reach" className="space-y-3">
      <h3 className="eyebrow">Case memory & reach</h3>
      <div className="record-status">
        <span>{memory ? `${memory.memories} ${memory.memories === 1 ? "memory" : "memories"}` : "memory …"}</span>
        <span>{memory ? `${memory.ledger.create ?? 0} writes · ${memory.ledger.read ?? 0} recalls` : "trust ledger …"}</span>
        <span>{federated?.configured ? (federated.reachable ? "federated sources online" : "federation configured, unreachable") : "federation not configured"}</span>
      </div>
      {latest && (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Latest: <span className="mono text-xs">{latest.id}</span> {latest.content}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        {memory?.engine ?? "meterless-hmem"} · append-only trust ledger · federated queries via Zetaris when configured
      </p>
    </section>
  );
}
