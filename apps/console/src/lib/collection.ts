import { ApiUnavailable } from './apiError';

/**
 * Reading the rows out of a collection response.
 *
 * The parameter is `unknown` on purpose: these endpoints publish no schema,
 * so the shape genuinely is not known until it arrives, and a narrower type
 * here would be a claim the API has never made.
 *
 * Separate from `consoleApi.ts` because that module is `server-only` and cannot
 * be imported by a test. This rule is the one most worth testing in the whole
 * data layer, so it lives where it can be.
 */

/** A paged collection as the API returns it. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** The keys a collection endpoint might hang its rows off. */
export const COLLECTION_KEYS = ['items', 'data', 'results', 'queue', 'records', 'rows'] as const;

/**
 * The rows out of a collection response, whatever it wrapped them in.
 *
 * This used to be `value?.items ?? []`, which is the most dangerous line that
 * can be written against an undocumented endpoint: `/platform/routing`,
 * `/editorial/queue` and `/org/inbox` declare **no response schema** in the
 * OpenAPI document — their 200s are described only as "Routing", "Queue page"
 * and "Inbox page" — so `items` was a guess taken from the fixture types.
 *
 * If the server wraps its rows in anything else, that expression yields an
 * empty array, and an operator opening the routing desk sees nothing. That does
 * not read as "the console could not understand the answer". It reads as "the
 * queue is clear", so they stop looking — while a report somebody filmed sits
 * unrouted.
 *
 * So an unrecognised shape fails loudly. An empty desk must mean an empty
 * queue and nothing else.
 */
export function itemsOf<T>(value: unknown, path = 'collection'): T[] {
  return pageOf<T>(value, path).items;
}

/**
 * One page of a collection: the rows **and** whether there are more.
 *
 * `itemsOf` read the rows and dropped `nextCursor` and `hasMore` on the floor,
 * which is a quieter version of the bug the note above is about. Every
 * collection on this API is a cursor page with `limit` defaulting to **20** —
 * `/incidents` and `/platform/routing` document it, and `/editorial/queue` and
 * `/org/inbox` describe their 200 as a "Queue page" and an "Inbox page" and
 * return the same `{items, nextCursor, hasMore}` envelope.
 *
 * So the verification desk asked for the queue, was handed the first twenty of
 * it, and rendered that as the whole thing: badge 20, list 20, "20 in the
 * queue, most urgent first". A reporter's twenty-first report was in the queue
 * the server returned a cursor for and on no screen anybody looked at. Nothing
 * was broken and nothing said anything.
 *
 * An empty desk had to mean an empty queue. A full one has to mean a full
 * queue, and that needs the cursor.
 */
export function pageOf<T>(
  value: unknown,
  path = 'collection',
): { items: T[]; nextCursor: string | null; hasMore: boolean } {
  if (Array.isArray(value)) {
    // A bare array is the whole collection by definition — there is nowhere for
    // a cursor to live, so there is nothing more to fetch.
    return { items: value as T[], nextCursor: null, hasMore: false };
  }
  if (value == null) return { items: [], nextCursor: null, hasMore: false };

  const record = value as unknown as Record<string, unknown>;
  const nextCursor = typeof record.nextCursor === 'string' ? record.nextCursor : null;
  /*
   * `hasMore` is believed only when the server actually says it. A missing flag
   * with a cursor present still means more — the cursor is the stronger signal,
   * and treating its absence as "that is everything" is how this went wrong the
   * first time.
   */
  const hasMore = typeof record.hasMore === 'boolean' ? record.hasMore : nextCursor !== null;

  for (const key of COLLECTION_KEYS) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return { items: candidate as T[], nextCursor, hasMore };
  }

  // A wrapper with exactly one array in it is unambiguous, whatever it is
  // called — better to read it than to refuse a page over a naming difference.
  const arrays = Object.entries(record).filter(([, v]) => Array.isArray(v));
  if (arrays.length === 1) return { items: arrays[0]![1] as T[], nextCursor, hasMore };

  throw new ApiUnavailable(
    'INTERNAL',
    200,
    `${path} answered with a shape this console does not recognise ` +
      `(keys: ${Object.keys(record).join(', ') || 'none'}). It was not empty — it was unreadable.`,
  );
}
