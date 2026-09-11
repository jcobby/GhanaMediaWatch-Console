import type { SessionUser } from './token';

/**
 * Renewing the backend credential inside a console session.
 *
 * Deliberately free of `server-only`, `next/headers` and any Node API, because
 * the only place this can run is middleware: a Server Component may not write
 * cookies, so a page that discovers an expired token has no way to store a new
 * one. Middleware can, and it runs before every render.
 *
 * The problem it solves: the console session cookie lasts eight hours, and the
 * backend access token inside it lasts far less. Once the inner token expired,
 * every request answered 401 and the console rendered "Signed out — your
 * session ended" while the sidebar still showed the operator signed in, on a
 * session that was in fact perfectly valid. Reloading did not help, because
 * nothing ever renewed it.
 */

const BASE = (process.env.DAWURO_API_URL ?? '').replace(/\/+$/, '');

/**
 * Renew a little early.
 *
 * A token that expires mid-request fails the request. Sixty seconds is longer
 * than any call this console makes, so a token that survives the check survives
 * the work.
 */
const RENEW_WITHIN_MS = 60_000;

export function needsRefresh(user: SessionUser, now = Date.now()): boolean {
  // Nothing to renew, or nothing to renew it with.
  if (!user.accessToken || !user.refreshToken) return false;
  // No recorded expiry — a session minted before the field existed. Left alone:
  // refreshing every request would be worse than letting one 401 surface.
  if (!user.accessTokenExpiresAt) return false;

  const expiresAt = Date.parse(user.accessTokenExpiresAt);
  if (Number.isNaN(expiresAt)) return false;

  return expiresAt - now < RENEW_WITHIN_MS;
}

interface TokenEnvelope {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

/**
 * A session with a fresh backend token, or null if it cannot be renewed.
 *
 * Null means a real sign-out. The caller must clear the cookie rather than let
 * the operator continue on a session whose credential is dead — that is the
 * state this whole module exists to prevent.
 */
export async function refreshSession(user: SessionUser): Promise<SessionUser | null> {
  if (!BASE || !user.refreshToken) return null;

  try {
    const response = await fetch(`${BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Dev tunnels answer an unrecognised client with an HTML interstitial.
        'X-Tunnel-Skip-AntiPhishing-Page': 'true',
      },
      body: JSON.stringify({ refreshToken: user.refreshToken }),
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const tokens = (await response.json()) as TokenEnvelope;
    if (!tokens?.accessToken) return null;

    return {
      ...user,
      accessToken: tokens.accessToken,
      // The server rotates the refresh token; keeping the spent one would make
      // the next renewal fail for no visible reason.
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      ...(tokens.expiresAt ? { accessTokenExpiresAt: tokens.expiresAt } : {}),
    };
  } catch {
    /*
     * Unreachable, not rejected.
     *
     * Returning null signs the operator out, which is wrong for a dropped
     * connection — so this is deliberately indistinguishable from a refusal
     * only because the caller cannot act differently on it either. Revisit if
     * the console ever needs to tell an outage from an ended session here.
     */
    return null;
  }
}
