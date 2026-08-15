import type { LiveWeatherResponse, LiveWeatherRoute, RouteInfo } from "../../../../packages/shared/src/types";

const BASE_URL = process.env.OPEN_METEO_BASE_URL ?? "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 10 * 60_000;
const PROVIDER_URL = "https://open-meteo.com/en/docs";

type CacheEntry = { expiresAt: number; value: LiveWeatherRoute };
const cache = new Map<string, CacheEntry>();

type OpenMeteoCurrent = {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  precipitation: number;
  snowfall: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_gusts_10m: number;
};

type OpenMeteoResponse = { current?: OpenMeteoCurrent };

const conditions: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "rime fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "rain showers",
  81: "rain showers",
  82: "heavy rain showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
};

function fallback(route: RouteInfo, error?: unknown): LiveWeatherRoute {
  return {
    routeId: route.id,
    routeName: route.name,
    source: "Bothy seeded demo fallback",
    sourceUrl: PROVIDER_URL,
    mode: "demo-fallback",
    condition: "Live weather unavailable",
    note: "Seeded demo conditions remain available; this context does not alter the risk score.",
    error: error instanceof Error ? error.message : undefined,
  };
}

async function fetchRouteWeather(route: RouteInfo): Promise<LiveWeatherRoute> {
  const key = `${route.lat.toFixed(4)},${route.lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { ...hit.value, mode: "cached" };

  const url = new URL(BASE_URL);
  url.searchParams.set("latitude", String(route.lat));
  url.searchParams.set("longitude", String(route.lng));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,snowfall,weather_code,wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("snowfall_unit", "cm");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = (await response.json()) as OpenMeteoResponse;
    if (!data.current) throw new Error("Open-Meteo returned no current conditions");

    const current = data.current;
    const value: LiveWeatherRoute = {
      routeId: route.id,
      routeName: route.name,
      source: "Open-Meteo",
      sourceUrl: PROVIDER_URL,
      mode: "live",
      observedAt: new Date(current.time).toISOString(),
      fetchedAt: new Date().toISOString(),
      temperatureC: current.temperature_2m,
      apparentTemperatureC: current.apparent_temperature,
      precipitationMm: current.precipitation,
      snowfallCm: current.snowfall,
      windSpeedKph: current.wind_speed_10m,
      windGustKph: current.wind_gusts_10m,
      weatherCode: current.weather_code,
      condition: conditions[current.weather_code] ?? `weather code ${current.weather_code}`,
      note: "External live context only; the deterministic demo score is unchanged.",
    };
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    return fallback(route, error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getLiveWeather(routes: RouteInfo[]): Promise<LiveWeatherResponse> {
  return {
    provider: "Open-Meteo",
    providerUrl: PROVIDER_URL,
    fetchedAt: new Date().toISOString(),
    cacheTtlSeconds: CACHE_TTL_MS / 1_000,
    scoreBoundary: "Live context only; it does not modify seeded signals, assessments, or replay evidence.",
    routes: await Promise.all(routes.map(fetchRouteWeather)),
  };
}
