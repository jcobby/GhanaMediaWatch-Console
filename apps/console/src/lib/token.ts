import { SignJWT, jwtVerify } from 'jose';
import { ROLE_META, type AccountType, type PlatformRole } from '@dawuro/core';

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
  /**
   * The specific job this person does.
   *
   * `accountType` is the coarse axis the original three route groups were
   * gated on; `role` is the twenty-value model that decides what the interface
   * actually contains. Both are carried because middleware runs on the edge
   * and cannot look either one up.
   *
   * Optional so sessions minted before roles existed still verify rather than
   * logging everyone out on deploy.
   */
  role?: PlatformRole;
  businessId?: string;
  businessName?: string;
  title?: string;
  /**
   * Whether this organisation has finished onboarding.
   *
   * Carried on the session rather than looked up, because middleware runs on
   * the edge before any page renders and cannot reach a database. It is set
   * once at sign-in and refreshed when onboarding completes.
   */
  onboardingComplete?: boolean;
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
export type ConsoleHome = string;

/**
 * Where a signed-in user belongs.
 *
 * A business that has not finished onboarding goes to the wizard, not the
 * inbox. An empty inbox with no explanation is the worst possible first
 * impression — it looks like the product does not work.
 */
export function homeFor(
  accountType: AccountType,
  onboardingComplete = true,
  role?: PlatformRole,
): ConsoleHome {
  // A role, when present, is the more specific answer and wins. An institution
  // admin mid-onboarding is still an institution that has not been checked,
  // so the wizard outranks even that.
  if (role && !(accountType === 'business' && !onboardingComplete)) {
    return ROLE_META[role].home;
  }

  if (accountType === 'platform_owner') return '/platform';
  if (accountType === 'editor') return '/editorial';
  if (accountType === 'business') return onboardingComplete ? '/inbox' : '/onboarding';
  // Reporters have no console: capture, GPS gating and offline queueing are
  // the product, and they live on the phone.
  return '/no-console';
}
