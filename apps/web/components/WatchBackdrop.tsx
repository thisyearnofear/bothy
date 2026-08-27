"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ScenarioId } from "../../../packages/shared/src/types";
import { ambientMapStyle } from "./MapView";

const PLACES: Record<ScenarioId, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  live: { center: [-3.1, 54.5], zoom: 9.2, pitch: 28, bearing: -14 },
  backtest: { center: [-2.11, 54.51], zoom: 10.1, pitch: 32, bearing: 8 },
  flood: { center: [-2.4, 54.56], zoom: 10.2, pitch: 30, bearing: 6 },
};

/**
 * The same hill as the landing, seen from inside the shelter.
 * Non-interactive, aria-hidden, heavier scrim than the framing page so the
 * instruments stay the lamp. Does not drive time. Patrol pauses on reduced motion.
 */
export default function WatchBackdrop({ caseId }: { caseId: ScenarioId | null }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const placeRef = useRef<ScenarioId>(caseId ?? "live");
  placeRef.current = caseId ?? "live";

  useEffect(() => {
    let alive = true;
    let map: any;
    let drift: ReturnType<typeof setInterval> | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let patrolI = 0;

    const patrolStep = () => {
      if (!alive || !map || document.hidden) return;
      const base = PLACES[placeRef.current];
      const path =
        placeRef.current === "backtest"
          ? [
              { center: [base.center[0] + 0.06, base.center[1] + 0.02] as [number, number], bearing: base.bearing + 8 },
              { center: [base.center[0] - 0.04, base.center[1] - 0.03] as [number, number], bearing: base.bearing - 10 },
              { center: base.center, bearing: base.bearing },
            ]
          : [
              { center: [-3.1, 54.55] as [number, number], bearing: -8 },
              { center: [-2.95, 54.48] as [number, number], bearing: 10 },
              { center: [-3.15, 54.42] as [number, number], bearing: -20 },
              { center: base.center, bearing: base.bearing },
            ];
      const p = path[patrolI % path.length];
      patrolI += 1;
      try {
        map.easeTo({ ...p, duration: 48_000, easing: (x: number) => x });
      } catch {
        /* torn down */
      }
    };
    const startPatrol = () => {
      if (!alive || drift || reduced) return;
      patrolStep();
      drift = setInterval(patrolStep, 50_000);
    };
    const stopPatrol = () => {
      if (drift) clearInterval(drift);
      drift = undefined;
    };

    (async () => {
      const ml = await import("maplibre-gl");
      if (!alive || !container.current) return;
      const here = PLACES[placeRef.current];
      map = new ml.Map({
        container: container.current,
        style: ambientMapStyle(),
        center: here.center,
        zoom: here.zoom,
        pitch: here.pitch,
        bearing: here.bearing,
        interactive: false,
        attributionControl: { compact: true },
        pixelRatio: 1,
      });
      mapRef.current = map;
      map.on("load", () => {
        if (!alive) return;
        const dest = PLACES[placeRef.current];
        try {
          map.jumpTo(dest);
        } catch {
          /* ignore */
        }
        startPatrol();
      });
    })();

    const onVis = () => {
      if (document.hidden) stopPatrol();
      else startPatrol();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      stopPatrol();
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const dest = PLACES[caseId ?? "live"];
    if (!map?.easeTo) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      if (reduced) map.jumpTo(dest);
      else map.easeTo({ ...dest, duration: 700, easing: (x: number) => 1 - Math.pow(1 - x, 4) });
    } catch {
      /* map not ready */
    }
  }, [caseId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div ref={container} className="absolute inset-0 h-full w-full" style={{ background: "var(--page)" }} />
      {/* Heavier than the landing scrim so rails and Approve keep contrast. Product ≈ 0.82 × 0.38. */}
      <div className="absolute inset-0" style={{ background: "color-mix(in oklch, var(--page) 62%, transparent)" }} />
    </div>
  );
}
