import { SignJWT, jwtVerify } from 'jose';
import type { AccountType } from '@dawuro/core';

/**
 * Session token primitives, with no Node or `next/headers` dependency.
 *
 * Split out from session.ts so middleware — which runs on the edge runtime —
 * can verify a session with exactly the same code the server uses. When
 * middleware verifies differently from the server, the gap between them is the
 * vulnerability.
 */

export const SESSION_COOKIE = 'dawuro_session';
export const MAX_AGE_SECONDS = 60 * 60 * 8;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  accountType: AccountType;
  businessId?: string;
  businessName?: string;
  title?: string;
}

export function sessionSecret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      'SESSION_SECRET is missing or shorter than 32 characters. Set it in .env.local.',
    );
  }
  return new TextEncoder().encode(value);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ user: user as unknown as Record<string, unknown> })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(sessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const user = payload.user as SessionUser | undefined;
    return user?.id ? user : null;
  } catch {
    // Expired or tampered — indistinguishable to the caller on purpose.
    return null;
  }
}

/**
 * Where a signed-in user belongs, by role.
 *
 * Returns literals rather than `string` so Next's typed routes accept the
 * result directly — a computed redirect that has to be cast is a redirect the
 * compiler has stopped checking.
 */
export type ConsoleHome = '/platform' | '/inbox' | '/no-console';

export function homeFor(accountType: AccountType): ConsoleHome {
  if (accountType === 'platform_owner') return '/platform';
  if (accountType === 'business') return '/inbox';
  // Reporters have no console: capture, GPS gating and offline queueing are
  // the product, and they live on the phone.
  return '/no-console';
}
