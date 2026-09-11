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
  /**
   * The backend's own access token for this person.
   *
   * Carried inside the session rather than beside it, which is the whole point
   * of the httpOnly cookie: the browser holds one opaque string it cannot read,
   * and the API credential rides inside it. Route handlers and Server
   * Components unseal it to call the backend; no page ever receives it, and it
   * must never be passed to a Client Component as a prop.
   *
   * Optional so a session minted before the backend landed still verifies —
   * such a session simply has nothing to call the API with, and every data
   * fetch fails as unauthenticated rather than crashing on a missing field.
   */
  accessToken?: string;
  /** Used to mint a new access token without asking for the password again. */
  refreshToken?: string;
  /** When `accessToken` dies, ISO-8601. */
  accessTokenExpiresAt?: string;
  /**
   * What an applicant entered when registering an organisation.
   *
   * Held here because there is nowhere else: the API has no endpoint that
   * creates an organisation, so the sector, phone, interests and plan they
   * chose were parsed and thrown away. Echoing them back is not storage — this
   * dies with the session — but it is the difference between a form that
   * visibly kept what you typed and one that silently discarded it.
   */
  pendingApplication?: {
    organisationName: string;
    sector: string;
    phone: string;
    interests: string[];
    tier?: string;
  };
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
    return user?.id ? migrate(user) : null;
  } catch {
    // Expired or tampered — indistinguishable to the caller on purpose.
    return null;
  }
}

/**
 * A session signed before the vocabulary changed.
 *
 * `accountType` was `'business'` and is now `'organisation'` — the same party,
 * renamed everywhere a person reads it. The value is derived by this console
 * and crosses no wire, but it *is* inside the signed cookie, so every browser
 * that signed in before the rename is still presenting the old spelling.
 *
 * Without this it fails quietly rather than loudly. `'business' === 'organisation'`
 * is merely false, so middleware stops recognising them as an organisation and
 * routes them to `/no-console` — "Reporting happens on the phone" — with a
 * valid session, a real newsroom behind it, and nothing on screen to explain
 * why their inbox has gone.
 *
 * The cookie is re-signed on the next sign-in, so this can be deleted once no
 * live session predates the rename. Eight hours, by `MAX_AGE_SECONDS`.
 */
function migrate(user: SessionUser): SessionUser {
  const stored: string = (user as { accountType: string }).accountType;
  return stored === 'business' ? { ...user, accountType: 'organisation' } : user;
}

/**
 * When this session was minted, in epoch seconds, or null.
 *
 * Read from the JWT's own `iat` rather than stored on `SessionUser`, so it
 * cannot be set by anything that constructs a session object — it means "when
 * this cookie was signed" and nothing else.
 *
 * It exists to answer one question: **has this person already done the thing we
 * are about to tell them to do?** The organisation console tells an operator to
 * sign in again when `/org/*` refuses them, which is right when their sign-in
 * predates their organisation. Said to somebody who signed in ninety seconds
 * ago it is a loop, and they will run it more than once before they stop
 * believing the screen.
 */
export async function sessionIssuedAt(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    return typeof payload.iat === 'number' ? payload.iat : null;
  } catch {
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
 * An organisation that has not finished onboarding goes to the wizard, not the
 * inbox. An empty inbox with no explanation is the worst possible first
 * impression — it looks like the product does not work.
 */
/**
 * Whether this session belongs to somebody who registered an organisation.
 *
 * The backend issues them a plain reporter account, because that is the only
 * kind `/auth/register` makes — so nothing on the account itself distinguishes
 * a newsroom that applied from a member of the public with a phone. The
 * application restored onto the session at sign-in is what tells them apart.
 */
export function hasApplication(user: SessionUser): boolean {
  return (
    user.accountType === 'reporter' &&
    user.onboardingComplete === false &&
    Boolean(user.businessName)
  );
}

/**
 * Where a session belongs, applications included.
 *
 * `homeFor` answers from the account type alone, and by the server's reckoning
 * an applicant *is* a reporter — so it sends them to `/no-console`: "Reporting
 * happens on the phone." Somebody who registered a newsroom, completed
 * onboarding and was approved by an operator signed in and was told to install
 * the app. Every other part of the console routed them to `/onboarding`; the
 * sign-in redirect was computed from the coarse type and disagreed.
 *
 * One function so login and middleware cannot drift apart again.
 */
export function homeForSession(user: SessionUser): ConsoleHome {
  if (hasApplication(user)) return '/onboarding';
  return homeFor(user.accountType, user.onboardingComplete ?? true, user.role);
}

export function homeFor(
  accountType: AccountType,
  onboardingComplete = true,
  role?: PlatformRole,
): ConsoleHome {
  // A role, when present, is the more specific answer and wins. An institution
  // admin mid-onboarding is still an institution that has not been checked,
  // so the wizard outranks even that.
  if (role && !(accountType === 'organisation' && !onboardingComplete)) {
    return ROLE_META[role].home;
  }

  if (accountType === 'platform_owner') return '/platform';
  if (accountType === 'editor') return '/editorial';
  if (accountType === 'organisation') return onboardingComplete ? '/inbox' : '/onboarding';
  // Reporters have no console: capture, GPS gating and offline queueing are
  // the product, and they live on the phone.
  return '/no-console';
}
