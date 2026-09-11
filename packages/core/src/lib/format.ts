import { format, formatDistanceToNowStrict, isThisYear, isToday, isYesterday } from 'date-fns';
import type { TimePrecision } from '../types/api';

/**
 * Display formatters.
 *
 * Every one of these takes a nullable input where the API can suppress a value
 * via display flags, and returns null rather than a placeholder — callers must
 * decide what absence looks like, so a hidden value can never leak as "unknown"
 * text that implies the data exists.
 */

/** "12m", "3h", "2d". Compact because it sits in a chip over video. */
export function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNowStrict(date, { addSuffix: false })
    .replace(/ seconds?/, 's')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ months?/, 'mo')
    .replace(/ years?/, 'y');
}

/** "820 m" under a kilometre, "5.2 km" above. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** "2.4K", "8.1K", "1.2M" — feed counts, not exact figures. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Coordinates for display, always 6 dp (~0.11 m). Null stays null. */
export function formatCoordinate(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toFixed(6);
}

/**
 * The exact capture moment, rendered to whatever precision the reporter allowed.
 *
 * Returns null when nothing may be shown, so callers omit the row entirely
 * rather than printing "Unknown" — which would imply the value does not exist
 * when in fact it is deliberately withheld.
 */
export function formatExactCapture(iso: string | null, precision: TimePrecision): string | null {
  if (!iso || precision === 'hidden') return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  if (precision === 'date_only') {
    return isThisYear(date) ? format(date, 'd MMM') : format(date, 'd MMM yyyy');
  }

  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`;
  if (isThisYear(date)) return format(date, 'd MMM, h:mm a');
  return format(date, 'd MMM yyyy, h:mm a');
}

/**
 * The day something was captured, for a group heading.
 *
 * `formatExactCapture` is the wrong tool for one: it carries a time, so twelve
 * reports filmed on the same afternoon produce twelve different headings and
 * the grouping disappears. This is deliberately coarse — the whole point is
 * that many reports share one value.
 *
 * Today and Yesterday are named. A desk works the last two days far more than
 * any other, and "8 Sep" makes somebody do the arithmetic every time.
 */
export function formatCaptureDay(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return isThisYear(date) ? format(date, 'd MMM') : format(date, 'd MMM yyyy');
}

/**
 * Where it was filmed, in whatever terms are available.
 *
 * The service resolves `label` for nothing it holds — every incident comes back
 * `"label": null` — while carrying the fix that produced it. Reading the label
 * alone therefore prints nothing about the location of footage whose entire
 * claim is that it was taken somewhere specific, and a desk cannot tell that
 * from a reporter who withheld it. Those are opposite facts and had one
 * appearance.
 *
 * Coordinates are a worse name than "Kaneshie, Accra" and a far better one than
 * silence: they can be read out, pasted into a map, and checked. Four decimals
 * is about eleven metres — the accuracy a phone fix actually has.
 *
 * Hemisphere letters rather than a signed number: Ghana sits either side of the
 * prime meridian, and `-0.218` reads as a typo where `0.2180° W` does not.
 *
 * Null when there is no fix either, which is how a suppressed location arrives
 * — so absence stays absence and is never labelled as withheld.
 *
 * **Hand-synced with `formatCoordinates` in the mobile app's `lib/format`.**
 * The app does not consume this package (see `NewsSection`), and the two
 * disagreeing would put one place name on the phone and another on the desk for
 * the same report.
 */
export function formatPlace(
  location: { latitude: number | null; longitude: number | null; label?: string | null } | null,
): string | null {
  if (!location) return null;
  const label = location.label?.trim();
  if (label) return label;

  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const ns = latitude >= 0 ? 'N' : 'S';
  const ew = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}° ${ns}, ${Math.abs(longitude).toFixed(4)}° ${ew}`;
}

/**
 * Full timestamp for the detail view and any evidence context — seconds and
 * timezone included, because a report used to dispatch a patrol needs to be
 * unambiguous about when it was taken.
 */
export function formatFullTimestamp(iso: string | null, precision: TimePrecision): string | null {
  if (!iso || precision === 'hidden') return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (precision === 'date_only') return format(date, 'EEEE, d MMMM yyyy');
  return format(date, "EEEE, d MMMM yyyy 'at' h:mm:ss a");
}
