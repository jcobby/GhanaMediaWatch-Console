import 'server-only';
import { z } from 'zod';
import { DEMO_LOGINS, DEMO_PASSWORD, PLATFORM_OWNERS, BUSINESSES } from '@dawuro/core';
import type { SessionUser } from './session';

/**
 * Credential checking against the seeded accounts.
 *
 * This is a simulation of the real thing, and it is deliberately shaped like
 * the real thing: the same validation, the same generic failure message, the
 * same session afterwards. When the backend lands, only the middle of
 * `authenticate` changes — a fetch replaces the fixture lookup.
 */

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
  /** Platform operators additionally present a provisioned access code. */
  accessCode: z.string().trim().optional(),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string; needsAccessCode?: boolean };

/**
 * One message for every credential failure.
 *
 * Distinguishing "no such account" from "wrong password" tells an attacker
 * which emails are registered. The access-code case is the single exception:
 * it is only reachable once email and password already matched a seeded
 * operator, so it reveals nothing new and saves a real operator from guessing
 * why they were rejected.
 */
const GENERIC_FAILURE = 'Those credentials did not match an account.';

export async function authenticate(input: Credentials): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const owner = PLATFORM_OWNERS.find((o) => o.email.toLowerCase() === email);
  if (owner) {
    if (input.password !== DEMO_PASSWORD) return { ok: false, error: GENERIC_FAILURE };
    if (!input.accessCode) {
      return {
        ok: false,
        error: 'This account requires an access code.',
        needsAccessCode: true,
      };
    }
    if (input.accessCode.trim() !== owner.accessCode) {
      return {
        ok: false,
        error: 'That access code is not valid.',
        needsAccessCode: true,
      };
    }
    return {
      ok: true,
      user: {
        id: owner.id,
        email: owner.email,
        displayName: owner.displayName,
        accountType: 'platform_owner',
        title: owner.title,
      },
    };
  }

  const login = DEMO_LOGINS.find((l) => l.email.toLowerCase() === email);
  if (!login || input.password !== DEMO_PASSWORD) {
    return { ok: false, error: GENERIC_FAILURE };
  }

  const business = login.businessId ? BUSINESSES.find((b) => b.id === login.businessId) : undefined;

  return {
    ok: true,
    user: {
      id: login.email,
      email: login.email,
      displayName: login.displayName,
      accountType: login.accountType,
      ...(login.businessId ? { businessId: login.businessId } : {}),
      ...(business?.name ? { businessName: business.name } : {}),
    },
  };
}
