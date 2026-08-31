import type { IncidentCategory } from '../types/api';
import { categoryHue } from '../types/categories';

/**
 * Locally generated placeholder imagery.
 *
 * The fixtures used to point at loremflickr.com. That service returned HTTP 500
 * and every image in both products became a broken link — during a demo, which
 * is exactly when it matters. A seeded demo must not have a network dependency
 * for its own screenshots.
 *
 * These are inline SVG data URIs: no request, no cache, no outage, identical on
 * every machine. They are deliberately abstract rather than pretending to be
 * photographs — a synthetic image that admits what it is beats a stock sunset
 * standing in for a two-car collision.
 *
 * Composition is a horizon: lit sky above, dark mass below, one light source.
 * At thumbnail size that reads as a scene, which is all a layout needs to be
 * judged honestly.
 */

/**
 * Scene colours, derived from the category's own hue.
 *
 * A second hand-maintained palette was the wrong shape: it had to be updated
 * every time a category was added, and TypeScript only caught that because the
 * record was exhaustive. Now there is one source of colour per category and
 * this darkens it for sky and ground.
 */
function scene(category: IncidentCategory): [string, string, string] {
  const light = categoryHue(category);
  return [shade(light, 0.45), shade(light, 0.12), light];
}

/** Mix a hex colour toward black. `amount` is how much of it survives. */
function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * amount);
  const g = Math.round(((n >> 8) & 255) * amount);
  const b = Math.round((n & 255) * amount);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Deterministic 0..1 from a string, so each report keeps its own composition. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export interface PlaceholderOptions {
  width?: number;
  height?: number;
}

/**
 * A data-URI image for one report.
 *
 * `seed` should be the report id so the same report always looks the same — a
 * demo whose imagery reshuffles on reload cannot be talked over.
 */
export function placeholderImage(
  seed: string,
  category: IncidentCategory,
  options: PlaceholderOptions = {},
): string {
  const w = options.width ?? 720;
  const h = options.height ?? 1280;
  const [sky, ground, light] = scene(category);

  const r = hash(seed);
  const horizon = Math.round(h * (0.52 + r * 0.16));
  const lightX = Math.round(w * (0.2 + r * 0.6));
  const lightY = Math.round(horizon * (0.35 + r * 0.3));
  const ridge = Math.round(horizon - h * 0.05 - r * h * 0.04);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    '<defs>',
    `<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${ground}"/>`,
    `<stop offset="0.62" stop-color="${sky}"/>`,
    `<stop offset="1" stop-color="${light}" stop-opacity="0.55"/>`,
    '</linearGradient>',
    `<radialGradient id="g" cx="${lightX / w}" cy="${lightY / h}" r="0.42">`,
    `<stop offset="0" stop-color="${light}" stop-opacity="0.85"/>`,
    `<stop offset="1" stop-color="${light}" stop-opacity="0"/>`,
    '</radialGradient>',
    '</defs>',
    `<rect width="${w}" height="${h}" fill="url(#s)"/>`,
    `<rect width="${w}" height="${h}" fill="url(#g)"/>`,
    // Far ridge, then the near ground mass.
    `<path d="M0 ${ridge} L${Math.round(w * 0.28)} ${Math.round(ridge - h * 0.03)} L${Math.round(w * 0.55)} ${Math.round(ridge + h * 0.02)} L${w} ${Math.round(ridge - h * 0.015)} L${w} ${h} L0 ${h} Z" fill="${ground}" fill-opacity="0.55"/>`,
    `<rect y="${horizon}" width="${w}" height="${h - horizon}" fill="${ground}" fill-opacity="0.92"/>`,
    `<rect y="${horizon}" width="${w}" height="2" fill="${light}" fill-opacity="0.35"/>`,
    '</svg>',
  ].join('');

  // encodeURIComponent rather than base64: no Buffer, no atob, works unchanged
  // in Node, the browser and React Native.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
