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
      // same hill as the landing, dimmer so routes and pins stay the instrument
      paint: { "raster-brightness-max": 0.55, "raster-saturation": -0.55, "raster-contrast": 0.14 },
    },
  ],
};

/** Landing / watch-room gutter atmosphere — brighter than the operational window. */
export function ambientMapStyle() {
  const style = JSON.parse(JSON.stringify(OSM_STYLE));
  style.layers[0].paint = {
    "raster-brightness-max": 0.82,
    "raster-saturation": -0.45,
    "raster-contrast": 0.12,
  };
  return style;
}
