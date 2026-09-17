import 'server-only';
import { apiRequest } from './api';

/**
 * How the top of the mobile feed behaves, as the platform desk sets it.
 *
 * Two numbers: how many stories share the lead slot, and how long each one
 * holds before the next slides in. They are an editorial judgement — a busy news
 * day wants more stories moving faster, a quiet one wants fewer holding longer —
 * so they belong to the desk rather than to a constant compiled into an app
 * nobody can change without a release.
 *
 * **The service owns them now.** `GET /settings` is public and every phone reads
 * it; `PUT /platform/settings` is for the platform owner and clamps on write.
 * This module used to keep them in a file in `.data`, because no endpoint
 * carried a platform setting of any kind — so what the desk saved never reached
 * a phone. It is a thin client over the two endpoints now.
 *
 * Node-only. Middleware must not read it.
 */

export interface TopStorySettings {
  /** Stories sharing the lead slot. */
  count: number;
  /** How long each holds, in milliseconds. */
  dwellMs: number;
  /** When this console last saved it, if it did so in this request. */
  updatedAtIso: string;
  updatedByEmail: string;
}

/**
 * The bounds, and they are the service's and the app's bounds.
 *
 * The service clamps to the same range on write, and the mobile app's
 * `topStorySettings.ts` clamps anything it is served. Checked here too so the
 * form can say the limits in words instead of saving one value and showing
 * another.
 *
 * Every limit is a typo somebody will make. Zero stories empties the top of the
 * feed; 200ms is a strobe; an hour is a carousel that never moves while
 * claiming to.
 */
export const COUNT_RANGE = { min: 1, max: 5 } as const;
export const DWELL_SECONDS_RANGE = { min: 3, max: 20 } as const;

const DEFAULTS = { count: 5, dwellMs: 6000 } as const;

/** The `{ feed }` object both endpoints answer with. */
interface SettingsBody {
  feed?: { topStoryCount?: unknown; topStoryDwellMs?: unknown };
}

/**
 * What the service is serving to phones right now.
 *
 * Throws when the service cannot be reached. Showing the defaults over a
 * setting the desk had changed would have an operator re-entering a value that
 * was already live — an outage has to look like an outage.
 */
export async function readTopStories(): Promise<TopStorySettings> {
  const body = await apiRequest<SettingsBody>('/settings', {});
  return { ...fromFeed(body, DEFAULTS), updatedAtIso: '', updatedByEmail: '' };
}

/**
 * Save what the desk chose, clamped on the way in and returned as stored.
 *
 * The answer is the service's stored value rather than what was sent, so a
 * clamp on its side shows on the form instead of being hidden by ours.
 */
export async function writeTopStories(input: {
  count: number;
  dwellSeconds: number;
  byEmail: string;
  atIso: string;
  token: string;
}): Promise<TopStorySettings> {
  const chosen = clampSettings(input.count, input.dwellSeconds);
  const body = await apiRequest<SettingsBody>('/platform/settings', {
    method: 'PUT',
    token: input.token,
    body: { feed: { topStoryCount: chosen.count, topStoryDwellMs: chosen.dwellMs } },
  });
  return {
    ...fromFeed(body, chosen),
    updatedAtIso: input.atIso,
    updatedByEmail: input.byEmail,
  };
}

function fromFeed(
  body: SettingsBody | null | undefined,
  fallback: { count: number; dwellMs: number },
): { count: number; dwellMs: number } {
  const feed = body?.feed;
  if (!feed) return { count: fallback.count, dwellMs: fallback.dwellMs };
  return clampSettings(
    feed.topStoryCount ?? fallback.count,
    secondsOf(feed.topStoryDwellMs ?? fallback.dwellMs),
  );
}

function clampSettings(count: unknown, dwellSeconds: unknown): { count: number; dwellMs: number } {
  return {
    count: clamp(count, DEFAULTS.count, COUNT_RANGE.min, COUNT_RANGE.max),
    dwellMs:
      clamp(
        dwellSeconds,
        DEFAULTS.dwellMs / 1000,
        DWELL_SECONDS_RANGE.min,
        DWELL_SECONDS_RANGE.max,
      ) * 1000,
  };
}

/** Served in milliseconds, entered in seconds — nobody types 6000. */
function secondsOf(dwellMs: unknown): number {
  return typeof dwellMs === 'number' && Number.isFinite(dwellMs)
    ? dwellMs / 1000
    : DEFAULTS.dwellMs / 1000;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const asNumber = typeof value === 'string' ? Number(value) : value;
  if (typeof asNumber !== 'number' || !Number.isFinite(asNumber)) return fallback;
  return Math.min(max, Math.max(min, Math.round(asNumber)));
}
