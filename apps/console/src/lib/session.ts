import 'server-only';
import { cookies } from 'next/headers';
import {
  MAX_AGE_SECONDS,
  SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
  type SessionUser,
} from './token';

/**
 * Server-side session storage.
 *
 * The session is a signed JWT in an httpOnly cookie, so browser JavaScript can
 * never read it — no XSS on any page in this console can exfiltrate a session,
 * which is not true of a token kept in localStorage.
 *
 * This console releases payouts and can view unmasked reporter identities, so
 * that difference is worth the server round trip.
 *
 * When the real backend arrives, its access token is stored *inside* this
 * session server-side and attached by the BFF route handlers. The browser
 * still never sees it.
 */

export { SESSION_COOKIE, type SessionUser };
export { homeFor } from './token';

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Session or bust, for pages and handlers that have already been gated by
 * middleware. Throwing here means a route escaped the matcher, which is a bug
 * worth surfacing rather than rendering an empty console.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await readSession();
  if (!session) throw new Error('No session — this route should be behind middleware.');
  return session;
}
