"use client";

import { useState } from "react";
import { api } from "../lib/api";

/** Watch-my-road: one email input per route. The funnel + Good Neighbor proof. */
export default function WatchMyRoad({ routeId, routeName, scenario = "live" }: { routeId: string; routeName: string; scenario?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setState("error");
      setMsg("Enter a valid email.");
      return;
    }
    setState("busy");
    try {
      const res = await api.subscribe({ routeId, email, scenario });
      setState("done");
      setMsg(`Watching ${res.routeName}. ${res.count} neighbour${res.count === 1 ? "" : "s"} on watch. We ping only on real decisions.`);
    } catch {
      setState("error");
      setMsg("Could not subscribe — try again.");
    }
  };

  if (state === "done") {
    return (
      <p className="mono mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}>
        ✓ {msg}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <label className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-body)" }} htmlFor={`watch-${routeId}`}>
        Watch {routeName} — email me only on real decisions
      </label>
      <div className="flex gap-2">
        <input
          id={`watch-${routeId}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@valley.example"
          className="mono min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--rule)", color: "var(--text-strong)" }}
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition-transform active:scale-[0.96] disabled:opacity-50"
          style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
        >
          {state === "busy" ? "…" : "Watch"}
        </button>
      </div>
      {state === "error" && (
        <p className="mono text-xs" style={{ color: "var(--cursor)" }}>
          {msg}
        </p>
      )}
    </form>
  );
}
