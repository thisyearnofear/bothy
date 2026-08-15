"use client";

import { useEffect, useState } from "react";

type Scenario = { id: string; title: string; subtitle: string; now: string };

export default function Home() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [health, s] = await Promise.all([
          fetch("/api/health").then((r) => r.json()),
          fetch("/api/scenarios").then((r) => (r.ok ? r.json() : [])),
        ]);
        setStatus(health.ok ? "agent api: connected" : "agent api: unhealthy");
        setScenarios(s);
      } catch {
        setError("Could not reach the agent API. Start it with: npm run dev:agent");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen p-8">
      <header className="mb-8">
        <p className="mono text-xs uppercase tracking-widest text-slate-400">Bothy</p>
        <h1 className="text-2xl font-semibold text-white">Winter Watch</h1>
        <p className="mt-1 text-sm text-slate-300">
          Ranked, evidence-backed winter access intelligence. An audit trail is coming to this
          screen — timeline scrubber, risk cards, approve/reject.
        </p>
      </header>

      <section>
        <p className="mb-2 mono text-xs text-slate-400">{status || "checking…"}</p>
        {error && <p className="text-red-300">{error}</p>}
        {scenarios && (
          <ul className="space-y-2">
            {scenarios.map((s) => (
              <li key={s.id} className="rounded border border-slate-700 bg-slate-900 p-3">
                <div className="font-medium text-slate-100">{s.title}</div>
                <div className="text-sm text-slate-400">{s.subtitle}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}