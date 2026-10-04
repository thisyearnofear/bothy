"use client";

import { useEffect, useRef, useState } from "react";
import type { Beat } from "../lib/stories";
import {
  GALLIUM_CONTEXT,
  RED_SEA_CAPE,
  RED_SEA_POINTS,
  RED_SEA_SUEZ,
  geoContextNote,
  geoContextsForScenario,
  storySlugForScenario,
} from "../lib/atlas";
import { OSM_STYLE } from "../lib/mapStyle";
import { resolveMapLibreColor } from "../lib/mapColor";
import LaneMap from "./LaneMap";

type MapState = NonNullable<Beat["map"]>;

const CORRIDOR_LABEL: Record<MapState, string> = {
  open: "Suez route open",
  avoiding: "Carriers avoiding the Red Sea",
  paused: "Largest carrier pauses the route",
  diverted: "Traffic diverted around the Cape",
};

const token = (name: string, fallback: string) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? resolveMapLibreColor(value) : fallback;
};

const lineFeature = (coordinates: [number, number][]) => ({
  type: "Feature" as const,
  geometry: { type: "LineString" as const, coordinates },
});

function contextEl(label: string, onSelect: () => void): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "geo-ctx-pin";
  el.textContent = label;
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.addEventListener("click", onSelect);
  return el;
}

function boundsFor(slug: string | null): [[number, number], [number, number]] | null {
  const points: [number, number][] =
    slug === "gallium" ? GALLIUM_CONTEXT.map((item) => item.lngLat)
    : slug === "red-sea" ? [...RED_SEA_SUEZ, ...RED_SEA_CAPE, ...RED_SEA_POINTS.map((item) => item.lngLat)]
    : [];
  if (!points.length) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export default function GeographicAtlas({ scenarioId, beat, selectedContext, onSelectContext }: {
  scenarioId: string;
  beat: Beat | undefined;
  selectedContext: string | null;
  onSelectContext: (id: string | null) => void;
}) {
  const slug = storySlugForScenario(scenarioId);
  const contexts = geoContextsForScenario(scenarioId);
  const container = useRef<HTMLDivElement>(null);
  const handle = useRef<{ map: any; ml: any } | null>(null);
  const markers = useRef<any[]>([]);
  const generation = useRef(0);
  const onSelectRef = useRef(onSelectContext);
  onSelectRef.current = onSelectContext;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tileWarning, setTileWarning] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [showPoints, setShowPoints] = useState(true);
  const [showCorridors, setShowCorridors] = useState(true);
  const mapState: MapState = beat?.map ?? (slug === "red-sea" ? "diverted" : "open");

  useEffect(() => {
    let alive = true;
    let map: any;
    const my = ++generation.current;
    setReady(false);
    setFailed(null);
    setTileWarning(null);
    const teardown = () => {
      for (const marker of markers.current) {
        try { marker.remove(); } catch (error) { void error; }
      }
      markers.current = [];
      handle.current = null;
      try { map?.remove(); } catch (error) { void error; }
      map = undefined;
    };
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (!alive || my !== generation.current || !container.current) return;
        const colors = {
          cursor: token("--cursor", "#9ac4cb"),
          shelter: token("--shelter", "#dfad73"),
          moss: token("--moss", "#b5c99a"),
        };
        map = new ml.Map({ container: container.current, style: OSM_STYLE as any });
        handle.current = { map, ml };
        map.on("error", (event: { error?: Error; sourceId?: string }) => {
          if (!alive || my !== generation.current) return;
          if (event?.sourceId) {
            setTileWarning("Basemap tiles unavailable; geographic context labels remain reference only.");
            return;
          }
          setReady(false);
          setFailed(event?.error?.message ?? "Map could not be initialised.");
          teardown();
        });
        map.on("load", () => {
          if (!alive || my !== generation.current) return;
          try {
            if (slug === "red-sea") {
              map.addSource("corridor-suez", { type: "geojson", data: lineFeature(RED_SEA_SUEZ) });
              map.addSource("corridor-cape", { type: "geojson", data: lineFeature(RED_SEA_CAPE) });
              map.addLayer({ id: "corridor-cape", type: "line", source: "corridor-cape", paint: { "line-color": colors.cursor, "line-width": 2, "line-opacity": 0.8 } });
              map.addLayer({ id: "corridor-suez", type: "line", source: "corridor-suez", paint: { "line-color": colors.shelter, "line-width": 2.5, "line-opacity": 0.9 } });
            }
            const items = slug === "gallium" ? GALLIUM_CONTEXT : slug === "red-sea" ? RED_SEA_POINTS : [];
            for (const item of items) {
              const el = contextEl(item.label, () => onSelectRef.current(item.id));
              markers.current.push(new ml.Marker({ element: el, anchor: "center" }).setLngLat(item.lngLat).addTo(map));
            }
            const bounds = boundsFor(slug);
            if (bounds) {
              const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
              map.fitBounds(bounds, { padding: 56, duration: reduce ? 0 : 600, maxZoom: 4 });
            }
            setReady(true);
          } catch (error) {
            if (alive && my === generation.current) {
              setFailed(error instanceof Error ? error.message : String(error));
              teardown();
            }
          }
        });
      } catch (error) {
        if (alive && my === generation.current) setFailed(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      alive = false;
      setReady(false);
      teardown();
    };
  }, [slug, retry]);

  useEffect(() => {
    const el = container.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      try { handle.current?.map.resize(); } catch (error) { void error; }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    const map = handle.current?.map;
    if (!map || !ready || slug !== "red-sea") return;
    const colors = {
      shelter: token("--shelter", "#dfad73"),
      moss: token("--moss", "#b5c99a"),
    };
    try {
      if (map.getLayer("corridor-suez")) {
        map.setPaintProperty("corridor-suez", "line-color", mapState === "open" ? colors.moss : colors.shelter);
        map.setPaintProperty("corridor-suez", "line-dasharray", mapState === "open" ? [1, 0] : [3, 2]);
        map.setPaintProperty("corridor-suez", "line-opacity", mapState === "diverted" ? 0.45 : 1);
        if (map.getLayer("corridor-cape")) {
          map.setPaintProperty("corridor-cape", "line-width", mapState === "diverted" ? 3 : 1.5);
          map.setPaintProperty("corridor-cape", "line-opacity", mapState === "diverted" ? 1 : 0.5);
        }
      }
    } catch (error) { void error; }
  }, [mapState, ready, slug]);

  useEffect(() => {
    const map = handle.current?.map;
    for (const marker of markers.current) {
      const el = marker.getElement() as HTMLElement;
      el.style.display = showPoints ? "" : "none";
    }
    if (map && ready && slug === "red-sea") {
      try {
        const visibility = showCorridors ? "visible" : "none";
        map.setLayoutProperty("corridor-suez", "visibility", visibility);
        map.setLayoutProperty("corridor-cape", "visibility", visibility);
      } catch (error) { void error; }
    }
  }, [showPoints, showCorridors, ready, slug]);

  const selected = contexts.find((item) => item.id === selectedContext) ?? null;

  return (
    <section className="geo" aria-label="Geographic context">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Geographic context · public reference</p>
        {(slug === "gallium" || slug === "red-sea") && !failed && (
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} />
              Context points
            </label>
            {slug === "red-sea" && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showCorridors} onChange={(e) => setShowCorridors(e.target.checked)} />
                Illustrative corridors
              </label>
            )}
          </div>
        )}
      </div>

      <div className="geo-map" ref={container} role="region" aria-label="Geographic basemap" style={failed ? { display: "none" } : undefined} />
      {failed ? (
        <div className="geo-fallback" role="status">
          <p className="text-sm">Map could not be initialised ({failed}). Schematic fallback shown; retry reloads the basemap.</p>
          <button type="button" className="btn mt-2" onClick={() => { setFailed(null); setRetry((value) => value + 1); }}>Retry map</button>
          {slug === "red-sea" && <div className="mt-4"><LaneMap state={mapState} /></div>}
        </div>
      ) : (
        <>
          {!ready && <p className="hint mt-2" role="status">Loading basemap…</p>}
          {tileWarning && <p className="hint mt-2" role="status">{tileWarning}</p>}
        </>
      )}

      {contexts.length > 0 && (
        <ul className="geo-ctx-list" aria-label="Geographic context points">
          {contexts.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="btn"
                data-active={selectedContext === item.id || undefined}
                aria-pressed={selectedContext === item.id}
                onClick={() => onSelectContext(selectedContext === item.id ? null : item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {slug === "gallium" && (
        <p className="hint mt-2">Country-level policy context · representative label positions · no supplier geolocation captured.</p>
      )}
      {slug === "red-sea" && !failed && (
        <p className="hint mt-2">
          Schematic corridor overlays on a geographic basemap — {CORRIDOR_LABEL[mapState]}. Not ship
          positions or navigation geometry; no live closure is asserted.
        </p>
      )}
      {!slug && (
        <p className="hint mt-2">No geographic locations returned by this query.</p>
      )}

      {selected && (
        <div className="geo-drawer" role="status">
          <p className="text-sm"><strong>{selected.label}</strong> — {geoContextNote(selected)}</p>
          {beat?.event && (
            <div className="mt-3">
              <p className="eyebrow">Selected public event — not a fact about this point</p>
              <p className="mt-2 text-sm">
                {beat.event.text}{" "}
                <a className="underline" href={beat.event.source.url} target="_blank" rel="noreferrer">{beat.event.source.name} ↗</a>
              </p>
            </div>
          )}
          <p className="hint mt-2">Geographic context is not graph evidence; no synthetic platform is mapped to this point.</p>
          <button type="button" className="btn mt-2" onClick={() => onSelectContext(null)}>Clear context</button>
        </div>
      )}

      <p className="hint mt-2">Basemap © OpenStreetMap contributors.</p>
    </section>
  );
}
