import fs from 'fs';
import path from 'path';

/**
 * Middleware runs on pages. It must never run on an API route.
 *
 * The matcher excluded `api/auth` and nothing else, so every other route
 * handler was put through the page rules — and those rules answer with
 * redirects. An applicant uploading their certificate of incorporation got
 * `307 → /onboarding` instead of reaching the handler: `hasPendingApplication`
 * is true for them, and a redirect rule cannot tell a navigation from a
 * `fetch`. The browser followed it, the client received HTML where it expected
 * JSON, `res.json()` threw, and the screen reported "The upload did not
 * complete. Try again." — a message about the network, for a request the server
 * never saw. Saving a step failed identically and just as quietly.
 *
 * Nothing could catch it from inside: the handler was correct, the client was
 * correct, and the request never reached one from the other. It only looked
 * like it worked for platform owners, whose sessions fall through the page
 * rules to `next()` — which is why the routing desk could call its endpoint and
 * the onboarding wizard could not.
 *
 * Verified by upload: `POST /api/onboarding/documents` with a real session and
 * a real PDF answered 307 before this and 200 after, writing the bytes to disk.
 */

const SRC = path.resolve(__dirname, '..');
const middleware = () => fs.readFileSync(path.join(SRC, 'middleware.ts'), 'utf8');

/**
 * The matcher pattern, as a real RegExp, so this tests behaviour and not text.
 *
 * Two things have to be right or the test lies:
 *
 * **Anchored.** Next matches a matcher against the whole path. `RegExp.test`
 * does not — it will happily find a match further along the string, so the
 * unanchored pattern reports that `/api/onboarding` *is* matched by finding
 * `/onboarding` inside it. That made the first version of this test fail on
 * correct code for a reason that had nothing to do with the rule.
 *
 * **Unescaped.** The pattern is a string literal in the source, so the file
 * contains `\\.` where the running regex sees `\.`.
 */
function matcher(): RegExp {
  const src = middleware();
  const line = /matcher:\s*\[\s*'([^']+)'/.exec(src);
  if (!line) throw new Error('No matcher found in middleware.ts');
  return new RegExp(`^${line[1]!.replace(/\\\\/g, '\\')}$`);
}

test('the invite route is exempt from the session rule, and only it', () => {
  /*
   * Pins the exemption so it cannot quietly widen. An endpoint that skips the
   * session check is the one kind of hole this suite exists to prevent, and the
   * list of them should be short enough to read in one line.
   */
  const apiRoot = path.join(SRC, 'app', 'api');
  const unguarded: string[] = [];

  (function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== 'route.ts') continue;
      const rel = path.relative(apiRoot, full).replace(/\\/g, '/');
      if (rel.startsWith('auth/')) continue;
      const src = fs.readFileSync(full, 'utf8');
      if (!/readSession\(\)|requireSession\(\)/.test(src)) unguarded.push(rel);
    }
  })(apiRoot);

  expect(unguarded).toEqual(['invites/[token]/route.ts']);
});

test('no API route is matched by middleware', () => {
  const pattern = matcher();
  for (const route of [
    '/api/onboarding',
    '/api/editorial/inc_123',
    '/api/routing/inc_123',
    '/api/platform/applications/held_1',
    '/api/auth/login',
  ]) {
    expect([route, pattern.test(route)]).toEqual([route, false]);
  }
});

test('pages are still matched, or every role gate is off', () => {
  /*
   * The opposite failure, and the dangerous one. A matcher that excluded too
   * much would let a reporter walk into the platform console.
   */
  const pattern = matcher();
  for (const route of [
    '/',
    '/platform',
    '/platform/routing',
    '/inbox',
    '/onboarding',
    '/editorial',
  ]) {
    expect([route, pattern.test(route)]).toEqual([route, true]);
  }
});

test('every API route guards itself, because middleware no longer does', () => {
  /*
   * The invariant that makes the exclusion safe. These endpoints are reachable
   * directly — a redirect rule on a URL prefix was never an authorisation
   * boundary — so each one reads the session and checks it.
   *
   * `/api/auth/*` is exempt: sign-in, sign-out and registration are how a
   * session comes to exist, and `assume-role` is gated by its own env flag.
   *
   * `/api/invites/{token}` is exempt for the same reason, and only that reason.
   * Redeeming an invitation is the fourth way a session comes into being: the
   * caller has no account yet — that is what being invited means — so there is
   * nothing to read a session from. The unguessable token is the credential, and
   * the service decides whether it is still good, whether it has been revoked,
   * and how many times it may be used. A session check here would reject every
   * legitimate caller.
   */
  const apiRoot = path.join(SRC, 'app', 'api');
  const unguarded: string[] = [];

  (function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name !== 'route.ts') continue;

      const rel = path.relative(apiRoot, full).replace(/\\/g, '/');
      if (rel.startsWith('auth/')) continue;
      // The token is the credential; see the note above.
      if (rel === 'invites/[token]/route.ts') continue;

      const src = fs.readFileSync(full, 'utf8');
      if (!/readSession\(\)|requireSession\(\)/.test(src)) unguarded.push(rel);
    }
  })(apiRoot);

  expect(unguarded).toEqual([]);
});

test('the sweep actually reads the handlers', () => {
  // Otherwise the rule above passes by finding nothing.
  const apiRoot = path.join(SRC, 'app', 'api');
  const found: string[] = [];
  (function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts') found.push(full);
    }
  })(apiRoot);

  expect(found.length).toBeGreaterThanOrEqual(6);
});
