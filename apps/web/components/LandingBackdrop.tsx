"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "./MapView";

/**
 * The watch room as a backdrop: a dim, non-interactive map of the fells,
 * drifting slowly — the shelter is already watching the hill while you read.
 * Falls back to a flat panel if tiles can't load (flake wifi) and stands
 * perfectly still under prefers-reduced-motion.
 */
export default function LandingBackdrop() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let map: any;
    let drift: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const ml = await import("maplibre-gl");
      if (!alive || !container.current) return;
      map = new ml.Map({
        container: container.current,
        // darker + flatter than the watch room — text sits on top of this
        style: darkStyle(),
        center: [-3.1, 54.5],
        zoom: 9.4,
        pitch: 35,
        bearing: -18,
        interactive: false,
        attributionControl: false,
      });
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      // a slow patrol: long eases between neighbouring fells, forever
      const patrol: Array<{ center: [number, number]; bearing: number; duration: number }> = [
        { center: [-3.1, 54.55], bearing: -8, duration: 45_000 },
        { center: [-2.95, 54.48], bearing: 10, duration: 50_000 },
        { center: [-3.15, 54.42], bearing: -20, duration: 48_000 },
        { center: [-3.1, 54.5], bearing: -18, duration: 52_000 },
      ];
      let i = 0;
      const step = () => {
        const p = patrol[i % patrol.length];
        i++;
        map.easeTo({ ...p, easing: (x: number) => x });
      };
      map.on("load", () => {
        step();
        drift = setInterval(step, 50_000);
      });
    })();
    return () => {
      alive = false;
      if (drift) clearInterval(drift);
      map?.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div ref={container} className="absolute inset-0" style={{ background: "var(--page)" }} />
      {/* flat dim layer for text legibility — no gradient overlays, per design.md */}
      <div className="absolute inset-0" style={{ background: "color-mix(in oklch, var(--page) 72%, transparent)" }} />
    </div>
  );
}

/** The watch-room basemap, pushed further into the dark. */
function darkStyle() {
  const style = JSON.parse(JSON.stringify(OSM_STYLE));
  style.layers[0].paint = {
    "raster-brightness-max": 0.38,
    "raster-saturation": -0.85,
    "raster-contrast": 0.05,
  };
  return style;
}
