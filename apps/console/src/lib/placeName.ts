import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Turning a fix into a place a person recognises.
 *
 * **The service resolves no place names.** Every incident it holds comes back
 * `"label": null` with the coordinates that produced it sitting on the same
 * object, and there is no field on `LocationInput` for a client to supply one —
 * so nothing anywhere in the platform has ever put a name to a report.
 *
 * The desks were showing `5.6028° N, 0.2179° W`. That is better than the blank
 * they showed before it, and it is not what an editor needs: nobody deciding
 * whether a fire report is worth running knows where 5.6028 is. The same point
 * reverse-geocodes to **Abelenkpe, Accra**, which answers the question.
 *
 * This is a stopgap and is meant to be deleted. The right place for it is
 * ingest — one lookup per report, stored on the record, and every client gets
 * it for free. Requested as item 11 in BACKEND-REQUESTS.
 *
 * **Three rules it has to obey**, because it is calling somebody else's free
 * service from a page render:
 *
 *   1. **Cached hard.** Keyed on the coordinates rounded to about a hundred
 *      metres, because a suburb name does not change within one, and reports
 *      cluster: forty rows on the desk are typically three or four places. The
 *      cache is written to disk, so a restart does not re-ask.
 *   2. **Budgeted.** A page render never waits more than a couple of seconds in
 *      total. Whatever has not resolved falls back to the coordinates and is
 *      filled in on a later render, once the cache has it.
 *   3. **Never fatal.** A geocoder that is down, rate-limiting or unreachable
 *      returns null, and the caller shows the fix. A missing place name must
 *      never cost somebody the report.
 */

/** Off with `DAWURO_GEOCODER=off`, for a deployment that does not want the call. */
const ENABLED = process.env.DAWURO_GEOCODER !== 'off';

/**
 * Nominatim's usage policy asks for a descriptive agent and no more than one
 * request a second. Both are honoured below. A deployment with its own
 * geocoder points `DAWURO_GEOCODER_URL` at it.
 */
const ENDPOINT = process.env.DAWURO_GEOCODER_URL ?? 'https://nominatim.openstreetmap.org/reverse';
const AGENT = 'DawuroConsole/0.1 (editorial desk; place names for report provenance)';

/** ~110 m. A suburb name does not change inside that, and it clusters a queue. */
const KEY_PRECISION = 3;

/** One request a second, per the policy. */
const SPACING_MS = 1_100;

/** How long one page render will wait for names it does not have yet. */
const BUDGET_MS = 2_500;

/** Anything carrying a fix. Narrower than a location so a row shape can pass. */
export interface Point {
  latitude: number | null;
  longitude: number | null;
}

function keyOf(latitude: number, longitude: number): string {
  return `${latitude.toFixed(KEY_PRECISION)},${longitude.toFixed(KEY_PRECISION)}`;
}

/** Resolved names, and the misses — a null is a real answer worth remembering. */
const memory = new Map<string, string | null>();
let diskLoaded = false;
let lastRequestAt = 0;

function cacheFile(): string {
  return path.join(process.cwd(), '.data', 'places.json');
}

async function loadDisk(): Promise<void> {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    const raw = await readFile(cacheFile(), 'utf8');
    for (const [key, value] of Object.entries(JSON.parse(raw) as Record<string, string | null>)) {
      if (!memory.has(key)) memory.set(key, value);
    }
  } catch {
    // No cache yet, or it is unreadable. Either way we start from nothing.
  }
}

async function saveDisk(): Promise<void> {
  try {
    await mkdir(path.dirname(cacheFile()), { recursive: true });
    await writeFile(
      cacheFile(),
      `${JSON.stringify(Object.fromEntries(memory), null, 2)}\n`,
      'utf8',
    );
  } catch {
    // A cache that cannot be written is a slower console, not a broken one.
  }
}

/**
 * The shortest name that locates the report for a Ghanaian reader.
 *
 * Suburb first — "Abelenkpe" is how somebody in Accra says where that is — then
 * the city. The full `display_name` is a postal address and reads as noise in a
 * queue row: *Onyankle Link, Abelenkpe, Accra, Ayawaso West Municipal District,
 * Greater Accra Region, Ghana*.
 */
function shortLabel(payload: {
  address?: Record<string, string | undefined>;
  display_name?: string;
}): string | null {
  const a = payload.address ?? {};
  const local =
    a.neighbourhood ?? a.suburb ?? a.quarter ?? a.village ?? a.town ?? a.city_district ?? null;
  const wider = a.city ?? a.municipality ?? a.county ?? a.state ?? null;

  if (local && wider && local !== wider) return `${local}, ${wider}`;
  if (local) return local;
  if (wider) return wider;

  // A display name with nothing structured behind it: take the first two parts.
  const parts = payload.display_name?.split(',').map((p) => p.trim()) ?? [];
  return parts.length ? parts.slice(0, 2).join(', ') : null;
}

async function lookup(latitude: number, longitude: number): Promise<string | null> {
  const wait = Math.max(0, lastRequestAt + SPACING_MS - Date.now());
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  const url =
    `${ENDPOINT}?format=jsonv2&zoom=16&addressdetails=1` +
    `&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': AGENT, 'Accept-Language': 'en' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return shortLabel(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fill in the place names for a set of points, within a time budget.
 *
 * Returns what it knows. A point it could not resolve in time is simply absent
 * from the map, and the caller falls back to the coordinates — the same answer
 * as before, and correct rather than blank.
 */
export async function resolvePlaces(points: Point[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ENABLED) return out;

  await loadDisk();

  const wanted = new Set<string>();
  for (const point of points) {
    const { latitude, longitude } = point;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const key = keyOf(latitude, longitude);
    const cached = memory.get(key);
    if (cached !== undefined) {
      if (cached) out.set(key, cached);
      continue;
    }
    wanted.add(key);
  }

  if (wanted.size === 0) return out;

  const deadline = Date.now() + BUDGET_MS;
  let fetched = 0;

  for (const key of wanted) {
    if (Date.now() > deadline) break;
    const [lat, lon] = key.split(',').map(Number);
    if (lat === undefined || lon === undefined) continue;

    const label = await lookup(lat, lon);
    memory.set(key, label);
    fetched += 1;
    if (label) out.set(key, label);
  }

  if (fetched > 0) await saveDisk();
  return out;
}

/** The name for one point out of a resolved map, or null. */
export function placeFor(points: Map<string, string>, point: Point): string | null {
  const { latitude, longitude } = point;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return points.get(keyOf(latitude, longitude)) ?? null;
}
