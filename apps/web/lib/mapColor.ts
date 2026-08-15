/**
 * Converts CSS Color 4 OKLCH tokens into the hexadecimal sRGB form accepted by
 * MapLibre style properties. Non-OKLCH values pass through unchanged.
 */
const OKLCH_PATTERN =
  /^oklch\(\s*([+-]?(?:\d*\.)?\d+)(%)?\s+([+-]?(?:\d*\.)?\d+)\s+([+-]?(?:\d*\.)?\d+)(?:deg)?\s*\)$/i;

const toSrgbHex = (channel: number) => {
  const linear = Math.max(0, Math.min(1, channel));
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255)
    .toString(16)
    .padStart(2, "0");
};

export const resolveMapLibreColor = (color: string): string => {
  const match = color.trim().match(OKLCH_PATTERN);
  if (!match) return color;

  const lightness = Number(match[1]) / (match[2] ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  if (![lightness, chroma, hue].every(Number.isFinite)) return "#64748b";

  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return `#${toSrgbHex(red)}${toSrgbHex(green)}${toSrgbHex(blue)}`;
};
