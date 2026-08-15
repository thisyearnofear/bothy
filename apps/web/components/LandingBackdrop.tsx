"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { OSM_STYLE } from "./MapView";

type CamKey = {
  id: string;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
};

/**
 * The watch room as a backdrop: a dim, non-interactive map of the fells.
 *
 * Bothy-legal scroll cinema (docs/design.md): while the reader is still, the
 * camera patrols slowly; when a `[data-cam]` section takes the viewport, the
 * camera flies once to that section's keyframe — native scroll picks the
 * keyframe, an interruptible easeTo performs the flight, and reduced motion
 * jumps instead. Falls back to a flat surface if tiles can't load.
 */
export default function LandingBackdrop() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let map: any;
    let drift: ReturnType<typeof setInterval> | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const HERO: CamKey = { id: "hero", center: [-3.1, 54.5], zoom: 9.0, pitch: 35, bearing: -18 };
    // a slow patrol: long eases between neighbouring fells — the camera while the reader is still
    const patrol: Array<{ center: [number, number]; bearing: number; duration: number }> = [
      { center: [-3.1, 54.55], bearing: -8, duration: 45_000 },
      { center: [-2.95, 54.48], bearing: 10, duration: 50_000 },
      { center: [-3.15, 54.42], bearing: -20, duration: 48_000 },
      { center: HERO.center, bearing: HERO.bearing, duration: 52_000 },
    ];
    let patrolI = 0;
    const patrolStep = () => {
      const p = patrol[patrolI % patrol.length];
      patrolI++;
      map.easeTo({ ...p, easing: (x: number) => x });
    };
    const startPatrol = () => {
      if (drift || reduced) return;
      patrolStep();
      drift = setInterval(patrolStep, 50_000);
    };
    const stopPatrol = () => {
      if (drift) clearInterval(drift);
      drift = undefined;
    };
    // one interruptible flight per keyframe change — never per-pixel scrubbing
    const flyTo = (k: CamKey) => {
      if (reduced) map.jumpTo(k);
      else map.easeTo({ ...k, duration: 700, easing: (x: number) => 1 - Math.pow(1 - x, 4) }); // ~focus/expo
    };

    const cleanup: Array<() => void> = [];

    (async () => {
      const ml = await import("maplibre-gl");
      if (!alive || !container.current) return;
      map = new ml.Map({
        container: container.current,
        // darker + flatter than the watch room — text sits on top of this
        style: darkStyle(),
        ...HERO,
        interactive: false,
        attributionControl: { compact: true },
      });
      map.on("load", () => {
        if (!alive) return;
        startPatrol();

        // scroll keyframes: sections carrying data-cam define the flight
        const keyed = new Map<Element, CamKey>();
        document.querySelectorAll<HTMLElement>("[data-cam]").forEach((el) => {
          try {
            keyed.set(el, JSON.parse(el.dataset.cam ?? "{}") as CamKey);
          } catch {
            /* malformed keyframe — leave the camera alone */
          }
        });
        if (!keyed.size) return;
        const io = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              const k = keyed.get(e.target);
              if (!k) continue;
              if (k.id === "hero") {
                stopPatrol();
                flyTo(k);
                startPatrol(); // home again: resume the watch
              } else {
                stopPatrol();
                flyTo(k);
              }
            }
          },
          { threshold: 0.5 }
        );
        keyed.forEach((_, el) => io.observe(el));
        cleanup.push(() => io.disconnect());
      });
    })();

    return () => {
      alive = false;
      cleanup.forEach((fn) => fn());
      stopPatrol();
      map?.remove();
    };
  }, []);

  return (
    <div className="map-morph absolute inset-0 overflow-hidden" aria-hidden="true">
      <div ref={container} className="absolute inset-0" style={{ background: "var(--page)" }} />
      {/* One restrained scrim keeps copy legible without erasing the map's terrain and road texture.
          Effective luminance = raster brightness (0.6) x scrim transparency — keep the product above ~0.3. */}
      <div className="absolute inset-0" style={{ background: "color-mix(in oklch, var(--page) 50%, transparent)" }} />
    </div>
  );
}

/** The watch-room basemap, pushed further into the dark — but the fells must
 *  still read as terrain, not void. */
function darkStyle() {
  const style = JSON.parse(JSON.stringify(OSM_STYLE));
  style.layers[0].paint = {
    "raster-brightness-max": 0.6,
    "raster-saturation": -0.7,
    "raster-contrast": 0.08,
  };
  return style;
}
