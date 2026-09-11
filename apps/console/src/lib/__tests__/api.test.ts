import { ApiUnavailable, describeApiFailure } from '../apiError';

/**
 * How the console behaves when the backend is not there.
 *
 * The rule this protects is in CLAUDE.md and is not a style preference: the
 * console must **never silently fall back to fixtures**. An organisation inbox that
 * shows seeded reports during an outage shows an operator a queue that does not
 * exist, and they will license, assign and respond to reports nobody filed.
 *
 * An outage has to look like an outage.
 */

test('a configuration mistake is not reported as an outage', () => {
  /*
   * These need different people. "Nobody pointed this console at a server" is
   * for whoever deployed it; "the server is down" is for whoever runs it.
   * Collapsing them sends the operator to wait for a service that was never
   * configured.
   */
  const notConfigured = describeApiFailure(new ApiUnavailable('NOT_CONFIGURED', 0, ''));
  const unreachable = describeApiFailure(new ApiUnavailable('UNREACHABLE', 0, ''));

  expect(notConfigured.title).not.toEqual(unreachable.title);
  expect(notConfigured.body).toMatch(/setting|configured/i);
});

test('the outage message says the page is empty rather than stale', () => {
  // The operator's real question is "is what I am looking at real?".
  expect(describeApiFailure(new ApiUnavailable('UNREACHABLE', 0, '')).body).toMatch(
    /does not fall back|stays empty|not stale/i,
  );
});

test('the server message is never shown', () => {
  /*
   * §2.5: `message` is developer-facing. The backend has already been seen
   * returning a stack trace and an absolute file path in one.
   */
  const leak = 'Invalid prisma.incident.findMany() at /Users/someone/secret/path.ts:288';
  const copy = describeApiFailure(new ApiUnavailable('INTERNAL', 500, leak));

  expect(copy.title).not.toContain('prisma');
  expect(copy.body).not.toContain('/Users/');
});

test('every code has words', () => {
  const codes = [
    'NOT_CONFIGURED',
    'UNREACHABLE',
    'TIMEOUT',
    'MAINTENANCE',
    'TOKEN_EXPIRED',
    'TOKEN_INVALID',
    'FORBIDDEN',
    'INTERNAL',
  ] as const;

  for (const code of codes) {
    const copy = describeApiFailure(new ApiUnavailable(code, 0, ''));
    expect([code, Boolean(copy.title && copy.body)]).toEqual([code, true]);
  }
});

test('an unknown throwable still produces something sayable', () => {
  // A page must not crash because the failure was not an ApiUnavailable.
  expect(describeApiFailure(new Error('boom')).title).toBeTruthy();
  expect(describeApiFailure(null).title).toBeTruthy();
  expect(describeApiFailure(undefined).body).toBeTruthy();
});
