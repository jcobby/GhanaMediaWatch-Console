/**
 * Doing one thing per row without firing every request at once.
 *
 * Two desks need the report behind each row of a queue, and the only way to get
 * it is a request per row. Both did that with `Promise.all(rows.map(...))`,
 * which starts all of them in the same tick — so a queue of fifty reports was
 * fifty simultaneous requests, and the routing desk's is two per row because it
 * tries the editorial record before the public one.
 *
 * **That can take the whole console down, not just the page that did it.** The
 * test service rate-limits at roughly thirty requests in a few minutes and then
 * locks the client out for over twenty (BACKEND-REQUESTS.md item A). One render
 * of a busy desk exceeds that on its own, and every other page then fails —
 * including the ones that were working a moment earlier. A screen that breaks
 * its neighbours is worse than a screen that is slow.
 *
 * So: a few at a time, and a deadline for the whole batch. Past the deadline the
 * remaining rows are not requested at all — they fall back to whatever the
 * caller says an unenriched row looks like, which every caller here already has
 * a shape for, because a row whose detail could not be read was always possible.
 *
 * Order is preserved, so a caller can still line results up against its input.
 */

/** Requests in flight at once. Enough to be quick, far under any sane limit. */
export const DEFAULT_LIMIT = 4;

/**
 * How long a whole batch may take before the rest is abandoned.
 *
 * A page render is a person waiting at a blank screen. Fifteen seconds of
 * enrichment past the list itself is already more than anyone should be asked
 * for, and the rows that miss out still render — with less on them.
 */
export const DEFAULT_DEADLINE_MS = 15_000;

export async function mapWithLimit<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  options: {
    /** What an item that was never attempted becomes. Required: silence is not a result. */
    onSkipped: (item: T, index: number) => R;
    limit?: number;
    deadlineMs?: number;
  },
): Promise<R[]> {
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const startedAt = Date.now();

  const results = new Array<R>(items.length);
  let next = 0;

  /*
   * `next += 1` is safe without a lock: this is one JavaScript thread, and a
   * worker only yields at its `await`. Each index is therefore taken once.
   */
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;

      const item = items[index] as T;
      if (Date.now() - startedAt > deadlineMs) {
        results[index] = options.onSkipped(item, index);
        continue;
      }
      results[index] = await worker(item, index);
    }
  });

  await Promise.all(runners);
  return results;
}
