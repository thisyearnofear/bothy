"use client";

import { useState } from "react";
import type { RouteInfo } from "../../../packages/shared/src/types";
import { readOfficerName } from "../lib/caseRecord";

const KINDS = [
  { id: "closure", label: "closure" },
  { id: "disruption", label: "disruption" },
  { id: "report", label: "report" },
  { id: "plough-complete", label: "plough complete" },
] as const;

/** Operator road report — the one live feed that enters the score. */
export default function RoadIngest({
  routes,
  selectedId,
  busy,
  onSubmit,
}: {
  routes: RouteInfo[];
  selectedId: string | null;
  busy?: boolean;
  onSubmit: (input: {
    routeId: string;
    roadKind: (typeof KINDS)[number]["id"];
    headline: string;
    source: string;
    actor: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [routeId, setRouteId] = useState(selectedId ?? routes[0]?.id ?? "");
  const [roadKind, setRoadKind] = useState<(typeof KINDS)[number]["id"]>("disruption");
  const [headline, setHeadline] = useState("");
  const [source, setSource] = useState("Duty officer report");
  const [error, setError] = useState<string | null>(null);

  if (!routes.length) return null;

  return (
    <section
      className="mb-4 rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--rule)", background: "var(--panel)" }}
      aria-label="Road intake"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            Road report · in the score
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-body)" }}>
            Land a patrol or feed update on a corridor. It moves risk. Open-Meteo does not.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (selectedId) setRouteId(selectedId);
          }}
          className="rounded-lg border px-3 py-1.5 text-sm transition-transform active:scale-[0.96]"
          style={{ borderColor: "var(--cursor)", color: "var(--cursor)" }}
        >
          {open ? "Close" : "Report a road"}
        </button>
      </div>

      {open && (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!headline.trim() || !routeId) {
              setError("Corridor and headline are required.");
              return;
            }
            void onSubmit({
              routeId,
              roadKind,
              headline: headline.trim(),
              source: source.trim() || "Duty officer report",
              actor: readOfficerName().trim() || "duty-officer",
            })
              .then(() => {
                setHeadline("");
                setOpen(false);
              })
              .catch((err) => setError(err instanceof Error ? err.message : String(err)));
          }}
        >
          <label className="block text-xs" style={{ color: "var(--text-faint)" }}>
            Corridor
            <select
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" }}
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs" style={{ color: "var(--text-faint)" }}>
            Kind
            <select
              value={roadKind}
              onChange={(e) => setRoadKind(e.target.value as (typeof KINDS)[number]["id"])}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" }}
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs sm:col-span-2" style={{ color: "var(--text-faint)" }}>
            Headline
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. B5311 drifts blocking Wasdale Head"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" }}
              required
            />
          </label>
          <label className="block text-xs sm:col-span-2" style={{ color: "var(--text-faint)" }}>
            Source
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--rule)", background: "var(--page)", color: "var(--text-strong)" }}
            />
          </label>
          {error && (
            <p className="sm:col-span-2 text-xs" style={{ color: "oklch(80% 0.08 25)" }} role="alert">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-transform active:scale-[0.96] disabled:opacity-50"
              style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
            >
              {busy ? "Landing…" : "Land in the score"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
