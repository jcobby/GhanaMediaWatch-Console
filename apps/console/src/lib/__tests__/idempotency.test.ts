import fs from 'fs';
import path from 'path';
import { stableKey } from '../api';

/**
 * Idempotency keys the server will accept.
 *
 * Releasing a report to the public feed answered
 * `Idempotency-Key must be a UUID v4. (400)`, and that was not one broken
 * button. Every stable key in this console was a readable string —
 * `publish:inc_832d570b658f`, `route:inc_…:biz_a,biz_b`, `license:inc_…`,
 * `payout-batch:…`, `approve:…` — so *every action deliberately made
 * replay-safe was rejected outright*, while one-shot actions, which fall
 * through to `randomUUID()`, worked. The actions that mattered most were the
 * only ones that could not run.
 *
 * The fix has to keep the property the key exists for. A random UUID per
 * attempt would satisfy the format and silently destroy replay safety — a
 * double-clicked payout paying twice — which is the tempting wrong answer.
 */

/** RFC 4122 v4: version nibble `4`, variant nibble one of 8/9/a/b. */
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('the key the server rejected becomes one it can accept', async () => {
  expect(await stableKey('publish:inc_832d570b658f')).toMatch(V4);
});

test('every key this console actually sends is well formed', async () => {
  // The real call sites, verbatim.
  for (const key of [
    'publish:inc_832d570b658f',
    'route:inc_832d570b658f:biz_a,biz_b',
    'license:inc_d65bd0ef62bb',
    'payout-batch:2026-09',
    'approve:held_9d3d1dfa-5836-4dca-85fc-fe157d2efcd5',
  ]) {
    expect(await stableKey(key)).toMatch(V4);
  }
});

test('the same action always produces the same key', async () => {
  /*
   * The whole point. A retried or double-clicked action must be recognised by
   * the server as the one it already performed: a reporter paid once, a report
   * released once.
   */
  expect(await stableKey('publish:inc_1')).toBe(await stableKey('publish:inc_1'));
});

test('different actions do not collide', async () => {
  // Colliding keys would make the server treat releasing one report as a
  // replay of releasing another, and silently do nothing.
  const keys = await Promise.all(
    ['publish:inc_1', 'publish:inc_2', 'route:inc_1', 'license:inc_1'].map(stableKey),
  );
  expect(new Set(keys).size).toBe(keys.length);
});

test('a key is not passed through unchanged', async () => {
  // The failing behaviour, pinned directly.
  expect(await stableKey('publish:inc_1')).not.toBe('publish:inc_1');
});

// ─── the wiring, which the unit tests above do not reach ───────────────────

/**
 * Found by a probe.
 *
 * Reverting `apiRequest` to send the caller's raw key — the exact 400 — left
 * every test above green, because they all call `stableKey` directly and none
 * of them exercised the one line that decides whether it is called at all. A
 * suite that cannot see the bug it was written for is not covering it.
 */
test('the request actually derives the key before sending it', () => {
  const src = fs
    .readFileSync(path.resolve(__dirname, '../api.ts'), 'utf8')
    // Comments removed: the note above this line quotes the shape it forbids.
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  const assignment = src.slice(src.indexOf("headers['Idempotency-Key']"));
  const line = assignment.slice(0, assignment.indexOf(';') + 1);

  expect(line).toContain('await stableKey(options.idempotencyKey)');
  // A one-shot action still needs a key, and a random one is correct there.
  expect(line).toContain('crypto.randomUUID()');
});

test('a stable key is never sent raw', () => {
  const src = fs
    .readFileSync(path.resolve(__dirname, '../api.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  const assignment = src.slice(src.indexOf("headers['Idempotency-Key']"));
  const line = assignment.slice(0, assignment.indexOf(';') + 1);

  // `? options.idempotencyKey` — the reverted form, and the 400.
  expect(line).not.toMatch(/\?\s*options\.idempotencyKey\s*$/m);
});
