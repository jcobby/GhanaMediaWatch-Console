import fs from 'fs';
import path from 'path';
import { itemsOf, pageOf } from '../collection';

/**
 * A full desk has to mean a full desk.
 *
 * `collection.ts` already carries the rule that an empty desk must mean an
 * empty queue — an unreadable shape fails loudly rather than rendering as
 * nothing. This is the same rule at the other end, and it went unnoticed for
 * longer because it never looks like a failure.
 *
 * **Every collection on this API is a cursor page with `limit` defaulting to
 * 20.** `/incidents` and `/platform/routing` document the default; the
 * endpoints that publish no parameters at all — `/editorial/queue`,
 * `/org/inbox` — describe their 200 as a "Queue page" and an "Inbox page" and
 * return the same `{items, nextCursor, hasMore}` envelope. Measured against the
 * live service, `/incidents?limit=1` answers `hasMore: true` with a cursor.
 *
 * The console asked once and rendered the answer as the whole collection. So
 * the verification desk read "20 in the queue, most urgent first" whether there
 * were twenty reports waiting or two hundred, and a reporter's twenty-first
 * report was in a queue the server had offered a cursor for and on no screen
 * anybody looked at. Nothing errored, nothing was blank, and the count on the
 * badge agreed with the count in the list.
 */

describe('reading one page', () => {
  test('the cursor and the flag survive, they used to be dropped', () => {
    const page = pageOf<number>({ items: [1, 2], nextCursor: 'abc', hasMore: true });
    expect(page).toEqual({ items: [1, 2], nextCursor: 'abc', hasMore: true });
  });

  test('a cursor with no flag still means there is more', () => {
    /*
     * The cursor is the stronger signal. Treating a missing `hasMore` as "that
     * is everything" is exactly the assumption that lost the twenty-first
     * report, and these are endpoints that document nothing.
     */
    expect(pageOf<number>({ items: [1], nextCursor: 'abc' }).hasMore).toBe(true);
  });

  test('a bare array is the whole collection', () => {
    // There is nowhere for a cursor to live, so there is nothing more to ask for.
    expect(pageOf<number>([1, 2, 3])).toEqual({
      items: [1, 2, 3],
      nextCursor: null,
      hasMore: false,
    });
  });

  test('rows are still found under any of the wrapper names', () => {
    for (const key of ['items', 'data', 'results', 'queue', 'records', 'rows']) {
      expect([key, pageOf<number>({ [key]: [7] }).items]).toEqual([key, [7]]);
    }
  });

  test('an unreadable shape still fails loudly', () => {
    // The original rule, unchanged: an empty desk must mean an empty queue.
    expect(() => pageOf({ total: 4, page: 1 }, '/editorial/queue')).toThrow(/unreadable/);
  });

  test('itemsOf keeps its old contract', () => {
    expect(itemsOf<number>({ items: [1, 2], nextCursor: 'x', hasMore: true })).toEqual([1, 2]);
  });
});

describe('following the cursor', () => {
  const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'consoleApi.ts'), 'utf8');

  /** Comments stripped, so a rule cannot pass by matching the note about it. */
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  test('collections are collected, not sampled', () => {
    /*
     * The two that matter most are the two the desks are built on. A report
     * that reaches neither screen has, in effect, not been filed.
     */
    expect(code).toMatch(/queue: <T>\(\) => collect<T>\('\/editorial\/queue'/);
    expect(code).toMatch(/collect<T>\('\/org\/inbox'\)/);
    expect(code).toMatch(/collect<[\s\S]{0,120}>\(\s*'\/platform\/routing'/);
  });

  test('no collection endpoint is read a single page at a time any more', () => {
    // The old shape, which is the bug written out.
    expect(code).not.toMatch(/itemsOf<T>\(await get<Page<T> \| T\[\]>/);
    expect(code).not.toMatch(/itemsOf<T>\(await apiRequest<Page<T> \| T\[\]>/);
  });

  test('the loop cannot run forever against an endpoint that ignores the cursor', () => {
    /*
     * `/editorial/queue` and `/org/inbox` publish no parameters, so `cursor`
     * may simply be ignored — and an ignored cursor returns page one with the
     * same `nextCursor` for ever. Without the repeat check the console would
     * accumulate the same twenty rows until the request died, which is a worse
     * failure than the one being fixed.
     */
    const fn = code.slice(
      code.indexOf('async function collect'),
      code.indexOf('async function send'),
    );
    expect(fn).toMatch(/seen\.has\(page\.nextCursor\)/);
    expect(fn).toMatch(/page\.items\.length === 0/);
    expect(fn).toMatch(/request < MAX_PAGES/);
  });

  test('the cursor is appended without breaking a path that already has a query', () => {
    // `/incidents?section=ghana` is a real call. `?cursor=` on the end of that
    // is a second question mark and a 400.
    const fn = code.slice(
      code.indexOf('async function collect'),
      code.indexOf('async function send'),
    );
    expect(fn).toMatch(/path\.includes\('\?'\) \? '&' : '\?'/);
    expect(fn).toMatch(/encodeURIComponent\(cursor\)/);
  });
});
