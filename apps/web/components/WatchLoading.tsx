"use client";

import { useEffect, useState } from "react";

/**
 * The room before it has a case: labeled instruments, map slot holding the
 * landing morph, copy that says we are entering — never a blank panel.
 */
export default function WatchLoading({ embedded }: { embedded?: boolean }) {
  const [replay, setReplay] = useState(false);
  useEffect(() => {
    setReplay(new URLSearchParams(window.location.search).get("replay") === "1");
  }, []);

  return (
    <div aria-busy="true" aria-label={replay ? "Rewinding the day" : "Opening the watch room"} className="space-y-4">
      {!embedded && (
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
          <div>
            <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
              Bothy
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>
              {replay ? "Rewinding the day" : "Opening the watch room"}
            </h1>
          </div>
          <p className="mono text-xs" style={{ color: "var(--cursor)" }}>
            detect → retrieve → reason → draft
          </p>
        </header>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(220px,0.66fr)_minmax(0,1.8fr)_minmax(300px,0.88fr)]">
        <aside className="order-2 rounded-lg border p-3 xl:order-1" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Routes
          </p>
          <ul className="mt-3 space-y-2">
            {[0.72, 0.54, 0.38, 0.16].map((w, i) => (
              <li key={i} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--rule)" }}>
                <span className="block h-3 rounded" style={{ width: `${48 + i * 8}%`, background: "var(--rule)", opacity: 0.7 }} />
                <span className="mt-2 block h-[3px] rounded-full" style={{ width: `${w * 100}%`, background: "var(--rule)" }} />
              </li>
            ))}
          </ul>
        </aside>

        <section
          className="map-morph relative order-1 h-[470px] overflow-hidden rounded-lg border sm:h-[58vh] xl:order-2 xl:h-[min(66vh,760px)]"
          style={{ borderColor: "var(--rule)", background: "var(--page)" }}
        >
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <p className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>
                The window is opening.
              </p>
              <p className="mono mt-2 text-sm" style={{ color: "var(--cursor)" }}>
                {replay ? "rewinding the day" : "the agent takes the lamp"}
              </p>
            </div>
          </div>
        </section>

        <aside className="order-3 rounded-lg border p-4" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Decision case
          </p>
          <p className="mt-3 text-sm" style={{ color: "var(--text-body)" }}>
            A draft waits for a named officer. Nothing publishes until they sign.
          </p>
          <div className="mt-4 space-y-2">
            <div className="h-10 rounded border" style={{ borderColor: "var(--rule)" }} />
            <div className="h-10 rounded border" style={{ borderColor: "var(--rule)" }} />
            <div className="h-16 rounded border" style={{ borderColor: "var(--rule)" }} />
          </div>
        </aside>
      </div>
    </div>
  );
}
