import { ApiUnavailable } from '../apiError';
import { COLLECTION_KEYS, itemsOf } from '../collection';

/**
 * An empty queue must mean an empty queue.
 *
 * `/platform/routing`, `/editorial/queue` and `/org/inbox` publish **no response
 * schema** in the API's OpenAPI document — their 200s are described only as
 * "Routing", "Queue page" and "Inbox page". So the wrapper key had to be
 * inferred, and the original `value?.items ?? []` turned every wrong inference
 * into an empty array.
 *
 * That is the worst available failure for this console. An operator opening the
 * routing desk and seeing nothing does not think "the console could not read
 * the answer" — they think the queue is clear, and they stop looking. A report
 * somebody filmed sits unrouted while the screen says there is no work.
 *
 * The rule these pin down: read the rows out of any shape that unambiguously
 * contains them, and *fail loudly* on one that does not.
 */

test('a bare array is the rows', () => {
  expect(itemsOf([{ id: 'a' }, { id: 'b' }])).toHaveLength(2);
});

test('every wrapper key the API might use is read', () => {
  for (const key of COLLECTION_KEYS) {
    expect([key, itemsOf({ [key]: [1, 2, 3] })]).toEqual([key, [1, 2, 3]]);
  }
});

test('a paged envelope keeps its rows, not its cursor', () => {
  const page = { items: [{ id: 'a' }], nextCursor: 'abc', hasMore: true };
  expect(itemsOf(page)).toEqual([{ id: 'a' }]);
});

test('an unfamiliar wrapper with one array is still read', () => {
  /*
   * A naming difference is not worth refusing a page over. `{ incidents: [...] }`
   * is unambiguous even though no key in the list matches.
   */
  expect(itemsOf({ incidents: [{ id: 'a' }], total: 1 })).toEqual([{ id: 'a' }]);
});

test('a genuinely empty queue is empty, not an error', () => {
  // The whole point: this must stay distinguishable from a shape failure.
  expect(itemsOf({ items: [] })).toEqual([]);
  expect(itemsOf([])).toEqual([]);
  expect(itemsOf(null)).toEqual([]);
});

test('an unreadable shape throws instead of rendering an empty desk', () => {
  /*
   * The bug this exists to prevent. Before, this returned `[]` and the routing
   * desk rendered "Queue is clear" over a response it had failed to parse.
   */
  expect(() => itemsOf({ total: 4, page: 1 }, '/platform/routing')).toThrow(ApiUnavailable);
});

test('the failure names the endpoint and says it was not empty', () => {
  /*
   * Whoever reads this message is trying to work out why a report they filmed
   * is not on screen. The two facts that shorten that hunt are which endpoint
   * disagreed and that the queue was not actually empty.
   */
  try {
    itemsOf({ total: 4 }, '/platform/routing');
    throw new Error('should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiUnavailable);
    const message = (error as ApiUnavailable).message;
    expect(message).toContain('/platform/routing');
    expect(message).toMatch(/not empty/i);
    // The keys it did find, so the fix is obvious from the message alone.
    expect(message).toContain('total');
  }
});

test('an ambiguous shape is refused rather than guessed', () => {
  /*
   * Two arrays and no recognised key: picking one would be a coin flip, and the
   * wrong side of it shows an operator the wrong queue — which is worse than
   * showing them an error.
   */
  expect(() => itemsOf({ open: [1], closed: [2] }, '/editorial/queue')).toThrow(ApiUnavailable);
});
