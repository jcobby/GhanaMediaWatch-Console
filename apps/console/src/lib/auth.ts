import 'server-only';
import { z } from 'zod';
import { apiRequest, isLiveBackend } from './api';
import { ApiUnavailable } from './apiError';
import type { SessionUser } from './session';
import type { AccountType } from '@dawuro/core';

/**
 * Credential checking against the Dawuro backend.
 *
 * `POST /auth/login` — email and password, checked by the server. Deliberately
 * **not** `/auth/signin`, which the API also exposes: that endpoint takes an
 * email alone, with no password, and mints a token for whoever asks. Using it
 * for a console sign-in would mean anybody who knows an operator's address can
 * release payouts.
 *
 * There is no fixture path left. A console that accepts a seeded password when
 * the backend is unreachable is a console that lets somebody in during an
 * outage and then shows them data that is not real.
 */

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
  /** Platform operators additionally present a provisioned access code. */
  accessCode: z.string().trim().optional(),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export type AuthResult =
  { ok: true; user: SessionUser } | { ok: false; error: string; needsAccessCode?: boolean };

/**
 * One message for every credential failure.
 *
 * Distinguishing "no such account" from "wrong password" tells an attacker
 * which emails are registered.
 */
const GENERIC_FAILURE = 'Those credentials did not match an account.';

/**
 * What the server says about the person who just signed in.
 *
 * `GET /me` — "Describe the signed-in caller (kind, org, role, memberships)".
 * `POST /auth/login` now returns the same object inline as `me`, so an ordinary
 * sign-in costs no extra request; the endpoint is the fallback for a session
 * that has a token but never saw a login response.
 *
 * Verified against the live service:
 *
 *     {"kind":"platform_owner","userId":"usr_seed_owner","email":"…",
 *      "displayName":"Dawuro Platform Owner","avatarUrl":null,
 *      "accountKind":"platform_owner","orgId":null,"role":null,"memberships":[]}
 *
 * Every field optional but `kind`, because this console must keep working
 * against a server that adds or drops one.
 */
export interface CallerDescription {
  kind?: string;
  accountKind?: string;
  userId?: string;
  email?: string;
  displayName?: string;
  /** The organisation this person belongs to, or null for everybody else. */
  orgId?: string | null;
  /** Their job inside it — owner, admin, analyst, dispatcher, viewer. */
  role?: string | null;
  memberships?: { orgId?: string; orgName?: string; role?: string }[];
}

interface TokenEnvelope {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  /** Added by the backend alongside the tokens. See `CallerDescription`. */
  me?: CallerDescription;
}

export async function authenticate(input: Credentials): Promise<AuthResult> {
  if (!isLiveBackend) {
    return {
      ok: false,
      error: 'This console is not pointed at a backend. Set DAWURO_API_URL and restart it.',
    };
  }

  const email = input.email.trim().toLowerCase();

  let tokens: TokenEnvelope;
  try {
    tokens = await apiRequest<TokenEnvelope>('/auth/login', {
      method: 'POST',
      body: { email, password: input.password },
    });
  } catch (cause) {
    if (cause instanceof ApiUnavailable && cause.status >= 400 && cause.status < 500) {
      // The server rejected the credentials. Its own wording is not shown —
      // it may distinguish cases this deliberately does not.
      return { ok: false, error: GENERIC_FAILURE };
    }
    /*
     * An outage, not a bad password. Saying "those credentials did not match"
     * here would send an operator to reset a password that was never wrong.
     */
    return {
      ok: false,
      error: 'The service could not be reached, so your details could not be checked.',
    };
  }

  if (!tokens?.accessToken) return { ok: false, error: GENERIC_FAILURE };

  const me = tokens.me ?? (await fetchCaller(tokens.accessToken));
  const membership = me ? primaryMembership(me) : null;

  return {
    ok: true,
    user: {
      id: me?.userId ?? subjectOf(tokens.accessToken) ?? email,
      email,
      displayName: me?.displayName?.trim() || email.split('@')[0] || email,
      accountType: accountTypeFrom(me, tokens.accessToken),
      onboardingComplete: true,
      accessToken: tokens.accessToken,
      /*
       * The organisation, straight from the server.
       *
       * This is what makes an approved organisation's console work. Until `/me`
       * existed the console had no way to learn an org id, so it minted its own
       * — `held_…` — which every `/org/*` endpoint correctly answered 403 to,
       * and the organisation saw an outage on a working account.
       */
      ...(membership?.orgId ? { businessId: membership.orgId } : {}),
      ...(membership?.orgName ? { businessName: membership.orgName } : {}),
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      ...(tokens.expiresAt ? { accessTokenExpiresAt: tokens.expiresAt } : {}),
    },
  };
}

/**
 * The organisation this person operates, if any.
 *
 * `orgId` and `role` at the top level are the server's own answer for the
 * common case. `memberships` is read as a fallback because somebody can belong
 * to an organisation without it being their default — the top-level fields were
 * null for every account tested, and an empty console for a genuine member
 * would look exactly like the bug this replaces.
 */
function primaryMembership(me: CallerDescription): { orgId: string; orgName?: string } | null {
  if (me.orgId) {
    const named = me.memberships?.find((m) => m.orgId === me.orgId);
    return { orgId: me.orgId, ...(named?.orgName ? { orgName: named.orgName } : {}) };
  }

  const first = me.memberships?.find((m) => m.orgId);
  if (!first?.orgId) return null;
  return { orgId: first.orgId, ...(first.orgName ? { orgName: first.orgName } : {}) };
}

/**
 * Which console this person gets.
 *
 * **This used to guess, and the guess was wrong in both directions.** It read
 * the token's `kind` claim, and for a plain `user` — which is every organisation
 * operator and every reporter — it called `/org/dashboard` and inferred
 * membership from whether the call was refused. An editor is refused by every
 * endpoint it tried and so was classed a reporter and sent to `/no-console`; a
 * backend hiccup demoted whoever hit it, because a probe cannot tell a refusal
 * from an outage.
 *
 * `GET /me` answers it outright. `accountKind` is preferred over `kind` because
 * the server sends both and `accountKind` is the field its own summary names;
 * they agreed on every account tested. Membership decides organisation from
 * reporter, which is the distinction the probe existed for and the one thing a
 * refusal could never establish.
 *
 * The token claim remains as a fallback for a server that stops sending `me`.
 */
function accountTypeFrom(me: CallerDescription | null, token: string): AccountType {
  const stated = accountTypeFromKind(me?.accountKind ?? me?.kind ?? readClaim(token, 'kind'));
  if (stated) return stated;
  if (me && primaryMembership(me)) return 'organisation';
  return 'reporter';
}

/**
 * `GET /me`, for a token that did not arrive with a login response.
 *
 * Returns null rather than throwing: a caller that cannot be described is not a
 * failed sign-in. The token is valid — the server issued it — so the session is
 * built from the claim instead, which is the behaviour that was there before
 * this endpoint existed.
 */
async function fetchCaller(token: string): Promise<CallerDescription | null> {
  try {
    return await apiRequest<CallerDescription>('/me', { token, timeoutMs: 8_000 });
  } catch {
    return null;
  }
}

/**
 * The account type a `kind` or `accountKind` value settles, or null if it does
 * not.
 *
 * Null means "membership decides" — a plain `user` may be an organisation's
 * operator or a reporter, and neither field can tell them apart. Every other
 * value the server issues is a complete answer.
 *
 * Exported for its tests. The interesting case is `editor`, which once had no
 * branch at all: an editor is refused by every endpoint the old probe tried, so
 * every one of them was classed a reporter and sent to `/no-console`.
 */
export function accountTypeFromKind(kind: string | null): AccountType | null {
  if (kind === 'platform_owner') return 'platform_owner';
  if (kind === 'editor') return 'editor';
  /*
   * `user` needs the probe below, and so does anything unrecognised — a claim
   * this console has not seen must never be promoted to a console it does not
   * understand. Falling through is the safe direction.
   */
  return null;
}

/** The `sub` claim, read without verifying — the server already verified it. */
function subjectOf(token: string): string | null {
  return readClaim(token, 'userId') ?? readClaim(token, 'sub');
}

/**
 * One claim out of an access token, without verifying the signature.
 *
 * Safe because the server issued this token seconds ago over TLS and remains
 * the authority on every request made with it: nothing here grants access, it
 * only decides which shell to render. A forged claim would build the wrong
 * navigation over an API that still refuses every call behind it.
 */
function readClaim(token: string, name: string): string | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as Record<string, unknown>;
    const value = claims[name];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}
