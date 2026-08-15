"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteInfo } from "../../../packages/shared/src/types";
import { pointAt } from "../lib/derive";
import { resolveMapLibreColor } from "../lib/mapColor";

export type RouteOnMap = {
  route: RouteInfo;
  color: string;
  score: number;
  label: string;
};

/** A signal arrival pinned onto its route — lands when the cursor crosses it. */
export type MapBeat = {
  id: string;
  routeId: string;
  atMs: number;
  lngLat: [number, number];
  text: string; // "08:20 · closure reported"
  delta: number; // score contribution
};

export const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: { type: "raster" as const, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
      // pull the bright raster basemap into the situation-room palette
      paint: { "raster-brightness-max": 0.55, "raster-saturation": -0.6, "raster-contrast": 0.1 },
    },
  ],
};

const centroid = (coords: [number, number][]) => {
  let x = 0;
  let y = 0;
  for (const [lng, lat] of coords) {
    x += lng;
    y += lat;
  }
  return { lng: x / coords.length, lat: y / coords.length };
};

/** Point at fraction f along the polyline — the risk-cursor position. (re-exported from derive for page use) */
export { pointAt };

export default function MapView({
  routes,
  selectedId,
  hoverId,
  onSelect,
  cursorMs,
  startMs,
  endMs,
  beats,
  revealed,
}: {
  routes: RouteOnMap[];
  selectedId: string | null;
  hoverId?: string | null;
  onSelect: (id: string) => void;
  cursorMs: number;
  startMs: number;
  endMs: number;
  beats: MapBeat[];
  revealed?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const libRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const pinsRef = useRef<Map<string, { marker: any; popup: any }>>(new Map());
  const openPin = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const lastFollow = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const fraction = endMs > startMs ? Math.max(0, Math.min(1, (cursorMs - startMs) / (endMs - startMs))) : 1;

  // init once (client-only)
  useEffect(() => {
    let alive = true;
    let map: any;
    (async () => {
      const ml = await import("maplibre-gl");
      if (!alive || !container.current) return;
      map = new ml.Map({
        container: container.current,
        style: OSM_STYLE as any,
        center: [-3.0, 54.45],
        zoom: 10.2,
      });
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      libRef.current = ml;
      const marker = new ml.Marker({ element: beaconEl(), anchor: "center" }).setLngLat([-3.0, 54.45]);
      map.on("load", () => {
        marker.addTo(map);
        markerRef.current = marker;
      });
      map.on("load", () => setReady(true));
      mapRef.current = map;
    })();
    return () => {
      alive = false;
      map?.remove();
    };
  }, []);

  // (re)draw route lines + colour + click; the selected route self-draws up to the cursor
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const on of routes) {
      const ghostId = `g-${on.route.id}`;
      const progId = `l-${on.route.id}`;
      const isSel = on.route.id === selectedId;
      const isHover = on.route.id === hoverId;

      const pathSourceId = `s-${on.route.id}`;
      const progressSourceId = `p-${on.route.id}`;
      if (!map.getSource(pathSourceId)) {
        map.addSource(pathSourceId, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: on.route.coords } },
        });
      }
      if (!map.getSource(progressSourceId)) {
        map.addSource(progressSourceId, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
        });
      }

      // Keep each MapLibre resource independently idempotent. A rejected layer
      // must not cause the next React effect to re-add its existing sources.
      if (!map.getLayer(ghostId)) {
        map.addLayer({
          id: ghostId,
          type: "line",
          source: pathSourceId,
          paint: { "line-color": resolveMapLibreColor("oklch(28% 0.008 255)"), "line-width": 2, "line-opacity": 0.35 },
        });
        map.on("click", ghostId, () => onSelectRef.current(on.route.id));
      }
      if (!map.getLayer(progId)) {
        map.addLayer({
          id: progId,
          type: "line",
          source: progressSourceId,
          paint: {
            "line-color": resolveMapLibreColor(on.color),
            "line-width": isSel || isHover ? 4 : 3,
            "line-opacity": isSel || isHover ? 1 : 0.55,
          },
        });
        map.on("click", progId, () => onSelectRef.current(on.route.id));
        map.on("mouseenter", progId, () => {
          try {
            map.getCanvas().style.cursor = "pointer";
          } catch {
            /* noop */
          }
        });
        map.on("mouseleave", progId, () => {
          try {
            map.getCanvas().style.cursor = "";
          } catch {
            /* noop */
          }
        });
      }

      map.setPaintProperty(progId, "line-color", resolveMapLibreColor(on.color));
      map.setPaintProperty(progId, "line-width", isSel || isHover ? 4 : 3);
      map.setPaintProperty(progId, "line-opacity", isSel || isHover ? 1 : 0.55);

      // self-draw: the polyline grows with the elapsed fraction of the day
      const src = map.getSource(`p-${on.route.id}`);
      if (src) {
        const f = isSel ? fraction : 1;
        const n = Math.max(2, Math.ceil(on.route.coords.length * f));
        src.setData({
          type: "Feature",
          geometry: { type: "LineString", coordinates: on.route.coords.slice(0, n) },
        });
      }
    }

    // camera: follows the risk-cursor; snaps to final state under reduced motion
    const sel = routes.find((r) => r.route.id === selectedId);
    const marker = markerRef.current;
    if (sel && map.easeTo) {
      const pos = pointAt(sel.route.coords, fraction);
      marker?.setLngLat(pos);
      const el = marker?.getElement();
      if (el) el.classList.toggle("beacon", Boolean(revealed));
      if (lastFollow.current !== sel.route.id) {
        // new focus: one proper camera flight onto the corridor
        lastFollow.current = sel.route.id;
        map.easeTo({ center: centroid(sel.route.coords), zoom: 11.5, duration: 700 });
      } else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // scrubbing: short, interruptible drift — the pointer is the camera
        map.easeTo({ center: pos, duration: 240, easing: (x: number) => x });
      } else {
        map.jumpTo({ center: pos });
      }
    }
  }, [routes, selectedId, hoverId, fraction, revealed, ready]);

  // signal pins: land at the cursor crossing (pin-in), un-land when scrubbed back past them.
  // Each carries its citation + timestamp — "every number on this screen cites a source".
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const pins = pinsRef.current;
    const landed = beats.filter((b) => b.atMs <= cursorMs);

    const ml = libRef.current;
    if (!ml) return;
    for (const b of landed) {
      if (pins.has(b.id)) continue;
      const el = pinEl(b);
      const marker = new ml.Marker({ element: el, anchor: "bottom" }).setLngLat(b.lngLat).addTo(map);
      const popup = new ml.Popup({ closeButton: false, offset: 14 }).setHTML(
        `<div class="mono" style="font-size:12px;line-height:1.5">${b.text}` +
          ` <span style="color:var(--cursor)">(${b.delta >= 0 ? "+" : ""}${b.delta.toFixed(2)})</span></div>`
      );
      marker.setPopup(popup);
      pins.set(b.id, { marker, popup });
    }
    // scrubbed backwards: rewind the day, pins lift off again
    for (const [id, p] of [...pins]) {
      if (!landed.some((b) => b.id === id)) {
        p.marker.remove();
        if (openPin.current === id) openPin.current = null;
        pins.delete(id);
      }
    }
    // staging: the latest landed pin on the selected route holds the open popup
    const staged = [...landed].reverse().find((b) => b.routeId === selectedId);
    if (staged && openPin.current !== staged.id) {
      pins.get(openPin.current ?? "")?.marker.getPopup()?.remove();
      const p = pins.get(staged.id);
      if (p) {
        p.marker.togglePopup();
        openPin.current = staged.id;
      }
    } else if (!staged && openPin.current) {
      pins.get(openPin.current)?.marker.getPopup()?.remove();
      openPin.current = null;
    }
  }, [beats, cursorMs, selectedId, ready]);

  return (
    <div className="map-morph h-full w-full absolute inset-0" style={{ background: "var(--page)" }}>
      {/* terrain arrives with a fade, not a pop; the hint holds the promise until it does */}
      <div
        ref={container}
        className="h-full w-full"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 480ms var(--ease-base)" }}
      />
      {!ready && (
        <div
          className="mono pointer-events-none absolute inset-0 grid place-items-center text-xs uppercase tracking-widest"
          style={{ color: "var(--text-faint)" }}
        >
          acquiring terrain…
        </div>
      )}
    </div>
  );
}

/** A signal pin: cursor-coloured dot on a stem, with its arrival time as a mono label. */
function pinEl(b: MapBeat): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "pin-in";
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "center";
  wrap.style.cursor = "pointer";
  const time = b.text.split(" · ")[0];
  wrap.innerHTML =
    `<span class="mono" style="font-size:11px;color:var(--cursor);margin-bottom:2px;white-space:nowrap">${time}</span>` +
    `<span style="width:8px;height:8px;border-radius:50%;background:var(--cursor);box-shadow:0 0 0 2px var(--page)"></span>`;
  return wrap;
}

/** The risk-cursor: a small dot riding the line, drifting along as you scrub. */
function beaconEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "10px";
  el.style.height = "10px";
  el.style.borderRadius = "50%";
  el.style.background = "var(--cursor)";
  el.style.boxShadow = "0 0 0 2px var(--page)";
  return el;
}
