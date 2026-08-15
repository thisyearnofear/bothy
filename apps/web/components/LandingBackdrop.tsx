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
 *
 * The map is viewport-fixed. Pinning it to the full document height makes
 * MapLibre size a canvas taller than the screen, so the first viewport shows
 * empty mercator void (a black page) and scroll keyframes never read.
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
      if (!alive || !map) return;
      const p = patrol[patrolI % patrol.length];
      patrolI++;
      try {
        map.easeTo({ ...p, easing: (x: number) => x });
      } catch {
        /* map torn down between ticks */
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
    // one interruptible flight per keyframe change — never per-pixel scrubbing
    const flyTo = (k: CamKey) => {
      if (!alive || !map) return;
      try {
        if (reduced) map.jumpTo({ center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing });
        else map.easeTo({ center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing, duration: 700, easing: (x: number) => 1 - Math.pow(1 - x, 4) });
      } catch {
        /* map torn down between scroll ticks */
      }
    };

    const cleanup: Array<() => void> = [];

    const attachCamera = () => {
      const keyed = new Map<Element, CamKey>();
      document.querySelectorAll<HTMLElement>("[data-cam]").forEach((el) => {
        try {
          keyed.set(el, JSON.parse(el.dataset.cam ?? "{}") as CamKey);
        } catch {
          /* malformed keyframe — leave the camera alone */
        }
      });
      if (!keyed.size) return;

      let lastId: string | null = null;
      const pick = () => {
        if (!alive) return;
        const aim = window.innerHeight * 0.38;
        let closest: CamKey | null = null;
        let closestDist = Infinity;
        for (const [el, k] of keyed) {
          const r = el.getBoundingClientRect();
          if (r.bottom < 80 || r.top > window.innerHeight - 80) continue;
          const dist = Math.abs(r.top + r.height / 2 - aim);
          if (dist < closestDist) {
            closest = k;
            closestDist = dist;
          }
        }
        if (!closest || closest.id === lastId) return;
        lastId = closest.id;
        if (closest.id === "hero") {
          stopPatrol();
          flyTo(closest);
          startPatrol();
        } else {
          stopPatrol();
          flyTo(closest);
        }
      };

      const io = new IntersectionObserver(pick, { threshold: [0, 0.15, 0.35, 0.5, 0.75, 1] });
      keyed.forEach((_, el) => io.observe(el));
      pick();
      cleanup.push(() => io.disconnect());
    };

    (async () => {
      const ml = await import("maplibre-gl");
      if (!alive || !container.current) return;
      map = new ml.Map({
        container: container.current,
        style: darkStyle(),
        center: HERO.center,
        zoom: HERO.zoom,
        pitch: HERO.pitch,
        bearing: HERO.bearing,
        interactive: false,
        attributionControl: { compact: true },
      });
      const resize = () => {
        try {
          map.resize();
        } catch {
          /* torn down */
        }
      };
      requestAnimationFrame(resize);
      const ro = new ResizeObserver(resize);
      ro.observe(container.current);
      cleanup.push(() => ro.disconnect());

      attachCamera();
      map.on("load", () => {
        if (!alive) return;
        resize();
        startPatrol();
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
    <div className="map-morph pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div ref={container} className="absolute inset-0 h-full w-full" />
      {/* Scrim keeps copy legible. Product ≈ brightness 0.82 × (1 − 0.32) so the fells still read as terrain. */}
      <div className="absolute inset-0" style={{ background: "color-mix(in oklch, var(--page) 32%, transparent)" }} />
    </div>
  );
}

/** The watch-room basemap, pushed further into the dark — but the fells must
 *  still read as terrain, not void. */
function darkStyle() {
  const style = JSON.parse(JSON.stringify(OSM_STYLE));
  style.layers[0].paint = {
    "raster-brightness-max": 0.82,
    "raster-saturation": -0.45,
    "raster-contrast": 0.12,
  };
  return style;
}
