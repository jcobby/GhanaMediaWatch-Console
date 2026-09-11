import fs from 'fs';
import path from 'path';
import { needsRefresh } from '../refresh';
import type { SessionUser } from '../token';

/**
 * The console session outlives the credential inside it.
 *
 * The cookie lasts eight hours; the backend access token lasts far less. Once
 * the inner token expired, every page answered 401 and rendered "Signed out —
 * your session ended" while the sidebar still showed the operator signed in, on
 * a session that was in fact perfectly valid. Reloading changed nothing,
 * because nothing ever renewed it.
 *
 * Middleware is the only place this can be fixed: a Server Component may not
 * write cookies, so a page that discovers the problem cannot store the answer.
 *
 * Verified against the live backend: an expired access token with a real
 * refresh token renews and sets a new cookie; a valid one makes no call; a dead
 * refresh token redirects to `/login?reason=expired` with the cookie cleared.
 */

const base: SessionUser = {
  id: 'u1',
  email: 'operator@example.gh',
  displayName: 'Operator',
  accountType: 'platform_owner',
};

const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

test('an expired token is renewed', () => {
  expect(
    needsRefresh({
      ...base,
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: at(-60_000),
    }),
  ).toBe(true);
});

test('a token about to expire is renewed before it is used', () => {
  /*
   * A token that dies mid-request fails the request. The window is longer than
   * any call this console makes, so a token that passes the check survives the
   * work it was fetched for.
   */
  expect(
    needsRefresh({ ...base, accessToken: 'a', refreshToken: 'r', accessTokenExpiresAt: at(5_000) }),
  ).toBe(true);
});

test('a healthy token costs nothing', () => {
  // Middleware runs on every request; refreshing each one would be a network
  // round trip per page view.
  expect(
    needsRefresh({
      ...base,
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: at(3_600_000),
    }),
  ).toBe(false);
});

test('nothing to renew with is not a renewal', () => {
  // A guest, or a session minted before refresh tokens were stored.
  expect(needsRefresh({ ...base, accessToken: 'a', accessTokenExpiresAt: at(-60_000) })).toBe(
    false,
  );
  expect(needsRefresh({ ...base, refreshToken: 'r', accessTokenExpiresAt: at(-60_000) })).toBe(
    false,
  );
});

test('an unknown expiry is left alone rather than refreshed every request', () => {
  /*
   * Sessions minted before the field existed. Refreshing on every request would
   * be worse than letting a single 401 surface and be retried.
   */
  expect(needsRefresh({ ...base, accessToken: 'a', refreshToken: 'r' })).toBe(false);
  expect(
    needsRefresh({
      ...base,
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: 'nonsense',
    }),
  ).toBe(false);
});

// ─── the wiring, which the unit above cannot see ───────────────────────────

const middleware = () => fs.readFileSync(path.resolve(__dirname, '../../middleware.ts'), 'utf8');

test('middleware renews before anything reads the token', () => {
  const src = middleware();
  expect(src).toMatch(/needsRefresh\(session\)/);
  expect(src).toMatch(/refreshSession\(session\)/);
  /*
   * Before the role gates, which lead to the pages that call the API.
   *
   * Compared against the *use* of ADMIN_PREFIXES, not the constant: the array
   * is declared at the top of the file, so measuring against its declaration
   * compares the refresh to an unrelated line and fails on correct code.
   */
  expect(src.indexOf('needsRefresh(session)')).toBeLessThan(
    src.indexOf('matches(pathname, ADMIN_PREFIXES)'),
  );
});

test('a renewed session is written back on every exit', () => {
  /*
   * The refresh token rotates, so a response that drops the new cookie spends
   * the old token and signs the operator out on the *next* request — a subtler
   * version of the bug being fixed.
   */
  const src = middleware();
  const body = src.slice(src.indexOf('const finish ='));
  const bare = [...body.matchAll(/return NextResponse\.(next|redirect)\(/g)];
  expect(bare).toEqual([]);
});

test('an unrenewable session signs out rather than continuing', () => {
  /*
   * Leaving somebody on a session whose credential is dead is exactly the state
   * this replaces — every page 401s and the shell still shows them signed in.
   */
  const src = middleware();
  const failure = src.slice(src.indexOf('if (session && needsRefresh(session))'));
  expect(failure).toMatch(/reason', 'expired'/);
  expect(failure).toMatch(/cookies\.delete\(SESSION_COOKIE\)/);
});

test('the login page says why they are back there', () => {
  // A bounce to a login screen with no explanation reads as lost work.
  const form = fs.readFileSync(path.resolve(__dirname, '../../app/login/LoginForm.tsx'), 'utf8');
  expect(form).toMatch(/params\.get\('reason'\) === 'expired'/);
  expect(form).toMatch(/Nothing has been lost/);
});

test('the refresh helper stays edge-safe', () => {
  /*
   * It runs in middleware. A `server-only` import or a Node API would fail at
   * build, but the failure reads as an unrelated bundling error — so it is
   * pinned here where the reason is written down.
   *
   * Import statements only. A whole-file search matches that module's own doc
   * comment, which names the things it must not import, so the test failed on
   * correct code for quoting the rule it enforces.
   */
  const src = fs.readFileSync(path.resolve(__dirname, '../refresh.ts'), 'utf8');
  const imports = [...src.matchAll(/^import .*$/gm)].map((m) => m[0]).join('\n');
  expect(imports).not.toMatch(/server-only|next\/headers|from 'fs'|from 'node:/);
});
