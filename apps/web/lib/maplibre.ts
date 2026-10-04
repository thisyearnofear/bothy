let loadPromise: Promise<typeof import("maplibre-gl")> | null = null;

export function loadMapLibre(): Promise<typeof import("maplibre-gl")> {
  if (!loadPromise) {
    const pending = import("maplibre-gl").then((ml) => {
      ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      return ml;
    });
    loadPromise = pending;
    pending.catch(() => {
      if (loadPromise === pending) loadPromise = null;
    });
  }
  return loadPromise;
}
