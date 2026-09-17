import fs from 'fs';
import path from 'path';
import { DEFAULT_LIMIT, mapWithLimit } from '../fanOut';

/**
 * A page must not take the rest of the console down with it.
 *
 * Two desks need the report behind each row, and the only way to get it is a
 * request per row. Both fired them all in one tick, so a queue of fifty reports
 * was fifty simultaneous requests — and the routing desk's is two per row,
 * because it tries the editorial record before the public one.
 *
 * The test service rate-limits at roughly thirty requests in a few minutes and
 * then locks the client out for over twenty. One render of a busy desk exceeds
 * that alone, and every other page fails afterwards — including pages that were
 * working a moment before. That is the failure this file exists to prevent.
 */

test('results come back in the order they went in', () => {
  // A caller lines these up against its own rows; out of order is silent
  // corruption — one report's detail rendered against another's row.
  return expect(
    mapWithLimit([1, 2, 3, 4, 5], async (n) => {
      await new Promise((resolve) => setTimeout(resolve, (5 - n) * 5));
      return n * 10;
    }, { onSkipped: () => 0 }),
  ).resolves.toEqual([10, 20, 30, 40, 50]);
});

test('never more than the limit are in flight at once', async () => {
  let inFlight = 0;
  let peak = 0;

  await mapWithLimit(
    Array.from({ length: 30 }, (_, i) => i),
    async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return n;
    },
    { onSkipped: () => -1, limit: 3 },
  );

  expect(peak).toBeLessThanOrEqual(3);
});

test('every item is still attempted exactly once', async () => {
  const seen: number[] = [];
  await mapWithLimit(
    Array.from({ length: 12 }, (_, i) => i),
    async (n) => {
      seen.push(n);
      return n;
    },
    { onSkipped: () => -1, limit: 4 },
  );

  expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
});

test('past the deadline the rest is not requested at all', async () => {
  /*
   * The point is that no request is made, not that its result is discarded.
   * Discarding it would still spend the rate limit that locks out every other
   * page, which is the whole problem.
   */
  let attempts = 0;

  const out = await mapWithLimit(
    Array.from({ length: 20 }, (_, i) => i),
    async (n) => {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 12));
      return n;
    },
    { onSkipped: () => -1, limit: 1, deadlineMs: 25 },
  );

  expect(attempts).toBeLessThan(20);
  expect(out).toHaveLength(20);
  // Skipped rows are a stated value, not a hole in the array.
  expect(out.filter((n) => n === -1).length).toBeGreaterThan(0);
});

test('an empty list does nothing and answers immediately', async () => {
  await expect(mapWithLimit([], async () => 1, { onSkipped: () => 0 })).resolves.toEqual([]);
});

describe('the desks that fan out use it', () => {
  const SRC = path.resolve(__dirname, '..', '..');
  const code = (rel: string) =>
    fs
      .readFileSync(path.join(SRC, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  test('neither desk starts a request per row all at once', () => {
    const api = code('lib/consoleApi.ts');
    const routing = api.slice(api.indexOf('routing: async ('));
    expect(routing).toMatch(/mapWithLimit\(/);
    expect(routing).not.toMatch(/Promise\.all\(\s*rows\.map/);

    const decided = code('app/(editorial)/editorial/decided/page.tsx');
    expect(decided).toMatch(/mapWithLimit\(rows, completeRow/);
    expect(decided).not.toMatch(/Promise\.all\(rows\.map/);
  });

  test('the default limit stays well under what the service will take', () => {
    // Thirty in a few minutes is the documented lockout threshold.
    expect(DEFAULT_LIMIT).toBeLessThanOrEqual(6);
  });

  test('the paging loop is bounded in time as well as in pages', () => {
    /*
     * Fifty pages at the fifteen-second request timeout is twelve minutes of a
     * page that has not rendered — and a service that has stopped answering is
     * exactly when every page takes the full timeout.
     */
    const api = code('lib/consoleApi.ts');
    const fn = api.slice(api.indexOf('async function collect'), api.indexOf('async function send'));
    expect(fn).toMatch(/Date\.now\(\) - startedAt > COLLECT_DEADLINE_MS/);
    // The first page is never skipped: an empty desk must mean an empty queue.
    expect(fn).toMatch(/request > 0 &&/);
  });
});
