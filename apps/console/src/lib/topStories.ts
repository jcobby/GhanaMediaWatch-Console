import 'server-only';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

/**
 * How the top of the mobile feed behaves, as the platform desk sets it.
 *
 * Two numbers: how many stories share the lead slot, and how long each one
 * holds before the next slides in. They are an editorial judgement — a busy news
 * day wants more stories moving faster, a quiet one wants fewer holding longer —
 * so they belong to the desk rather than to a constant compiled into an app
 * nobody can change without a release.
 *
 * **Held here, and not yet distributed.** The service has no endpoint that
 * carries a platform setting of any kind, so what the desk saves is recorded
 * durably and does not reach a phone: the app runs on its own defaults until
 * the backend serves this. Item 8 in BACKEND-REQUESTS asks for the one field
 * that closes it, and the page says so plainly where the control is rather than
 * letting an operator believe a slider moved something.
 *
 * The same file-store pattern as `applications`, for the same reason and with
 * the same instruction: **delete this module** once the backend owns it.
 *
 * Node-only. Middleware must not read it.
 */

/** Where the file lives. Overridable so tests never touch the real one. */
function storePath(): string {
  const override = process.env.DAWURO_TOP_STORIES_FILE;
  if (override) return override;
  return path.join(process.cwd(), '.data', 'top-stories.json');
}

export interface TopStorySettings {
  /** Stories sharing the lead slot. */
  count: number;
  /** How long each holds, in milliseconds. */
  dwellMs: number;
  updatedAtIso: string;
  updatedByEmail: string;
}

/**
 * The bounds, and they are the app's bounds.
 *
 * **Hand-synced with `topStorySettings.ts` in the mobile app**, which clamps
 * anything it is served to the same range. Two copies because the phone does
 * not consume this package — the same reason `NewsSection` is declared twice —
 * and they disagreeing would show as a desk offering a value the app silently
 * refuses to honour.
 *
 * Every limit is a typo somebody will make. Zero stories empties the top of the
 * feed; 200ms is a strobe; an hour is a carousel that never moves while
 * claiming to.
 */
export const COUNT_RANGE = { min: 1, max: 10 } as const;
export const DWELL_SECONDS_RANGE = { min: 3, max: 20 } as const;

const DEFAULTS = { count: 5, dwellMs: 6000 } as const;

/**
 * What the desk has set, or the app's own defaults.
 *
 * A missing file is the ordinary state before anybody has touched this, and it
 * answers with exactly what the app would do on its own — so the page shows the
 * truth rather than an empty form. An unreadable file is a real fault and
 * throws, because silently showing defaults over a saved setting would have an
 * operator re-entering a value that was already there.
 */
export async function readTopStories(): Promise<TopStorySettings> {
  let raw: string;
  try {
    raw = await readFile(storePath(), 'utf8');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULTS, updatedAtIso: '', updatedByEmail: '' };
    }
    throw cause;
  }

  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Top-stories store at ${storePath()} is not an object.`);
  }
  const row = parsed as Partial<TopStorySettings>;
  return {
    ...clampSettings(row.count, secondsOf(row.dwellMs)),
    updatedAtIso: row.updatedAtIso ?? '',
    updatedByEmail: row.updatedByEmail ?? '',
  };
}

/**
 * Save what the desk chose, clamped on the way in.
 *
 * Clamped here as well as on the phone. A value that only the app refuses is a
 * setting that reads as saved and behaves as something else, and the operator
 * has no way to see the difference.
 */
export async function writeTopStories(input: {
  count: number;
  dwellSeconds: number;
  byEmail: string;
  atIso: string;
}): Promise<TopStorySettings> {
  const settings: TopStorySettings = {
    ...clampSettings(input.count, input.dwellSeconds),
    updatedAtIso: input.atIso,
    updatedByEmail: input.byEmail,
  };

  /*
   * Written via a temporary file and a rename. Writing in place would leave a
   * half-written file if the process died mid-write, and a half-written file
   * throws on read — losing the setting rather than keeping the old one.
   */
  const target = storePath();
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  await rename(temporary, target);

  return settings;
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

/** Stored in milliseconds, entered in seconds — nobody types 6000. */
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
