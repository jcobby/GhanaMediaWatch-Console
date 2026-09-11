import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRequest, isLiveBackend } from '@/lib/api';
import { ApiUnavailable } from '@/lib/apiError';
import { createSession } from '@/lib/session';
import { registerApplication } from '@/lib/applications';

/**
 * Register an organisation.
 *
 * Signs the applicant straight in, so the next thing they see is the wizard
 * rather than a confirmation page and a dead end. Registration and onboarding
 * are one continuous act from the applicant's side; splitting them across a
 * sign-out was our mistake, not theirs.
 *
 * **What this can and cannot do.** It creates a real account on the backend, so
 * the session carries a real credential and the applicant can sign in again.
 * It cannot create the *organisation*: the API has no endpoint that does —
 * `/auth/register` is documented as "Register a reporter account", every
 * `/org/*` route requires membership of an organisation that already exists,
 * and `/platform/applications` only lists, with no POST on it or anywhere else.
 *
 * What it does instead is **file the application with the console**, which holds
 * it until the backend can take it. Before that, the organisation's details went
 * into the session cookie and nowhere else: they died on sign-out, and no
 * operator ever saw them, so the approvals queue read zero while somebody sat on
 * `/onboarding` waiting. Filing it means the platform owner has something to act
 * on and the applicant can close the tab. See `lib/applications.ts`.
 *
 * This previously invented a `businessId` locally and wrote a session with no
 * backend token at all. The applicant was signed in, sent to `/onboarding`, and
 * the first thing that screen did was ask the API a question with no credential
 * — which surfaced as "Signed out. Your session ended." on a page they had
 * never been signed in to.
 */
const schema = z.object({
  organisationName: z.string().trim().min(1, 'Enter the organisation name'),
  sector: z.string().trim().min(1, 'Choose a sector'),
  contactName: z.string().trim().min(1, 'Enter your name'),
  email: z.string().trim().email('Enter a valid work email'),
  phone: z.string().trim().min(6, 'Enter a phone number'),
  /*
   * The credential that lets them back in.
   *
   * Registration used to collect none, so an applicant whose session expired
   * had no way to return to their own application.
   */
  password: z.string().min(8, 'Choose a password of at least 8 characters'),
  /*
   * Chosen at registration, checked at onboarding. Optional here because an
   * organisation can skip ahead and set them later — the wizard is where they
   * become binding.
   */
  interests: z.array(z.string()).optional(),
  tier: z.string().optional(),
  expectedMonthlyDownloads: z.number().optional(),
});

interface TokenEnvelope {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    /*
     * Zod's default for a missing field is the bare word "Required", which
     * tells the reader nothing about which field. Every message above is
     * written out, and the field name is appended for anything that slips
     * through — an error nobody can act on is worse than no error.
     */
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') ?? '';
    const message =
      issue && issue.message !== 'Required' ? issue.message : `${field || 'A field'} is missing.`;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const input = parsed.data;

  if (!isLiveBackend) {
    return NextResponse.json(
      { error: 'This console is not pointed at a backend, so nothing can be registered.' },
      { status: 503 },
    );
  }

  let tokens: TokenEnvelope;
  try {
    tokens = await apiRequest<TokenEnvelope>('/auth/register', {
      method: 'POST',
      body: {
        email: input.email.trim().toLowerCase(),
        password: input.password,
        displayName: input.contactName,
      },
    });
  } catch (cause) {
    const status = cause instanceof ApiUnavailable ? cause.status : 0;
    if (status === 409) {
      return NextResponse.json(
        { error: 'An account already exists for that email. Sign in instead.' },
        { status: 409 },
      );
    }
    if (status >= 400 && status < 500) {
      return NextResponse.json(
        { error: 'That account could not be created. Check the email and password.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'The service could not be reached, so nothing was registered. Try again shortly.' },
      { status: 503 },
    );
  }

  /*
   * File the application before signing them in.
   *
   * Ordered deliberately. If the store is unwritable, the applicant must find
   * out now — while they still have the form open and can be told to try again
   * — not after a redirect to a page that would tell them everything is fine.
   * The account already exists at this point, so re-registering with the same
   * email answers 409 with "sign in instead", which is a recoverable position.
   */
  try {
    await registerApplication({
      accountEmail: input.email,
      organisationName: input.organisationName,
      sector: input.sector,
      contactName: input.contactName,
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      interests: input.interests ?? [],
      ...(input.tier ? { tier: input.tier } : {}),
      ...(input.expectedMonthlyDownloads !== undefined
        ? { expectedMonthlyDownloads: input.expectedMonthlyDownloads }
        : {}),
      registeredAtIso: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'Your account was created, but the application could not be saved. Sign in and try again.',
      },
      { status: 500 },
    );
  }

  await createSession({
    id: input.email.toLowerCase(),
    email: input.email,
    displayName: input.contactName,
    /*
     * A reporter account, because that is what the backend created.
     *
     * Claiming `organisation` here would put them in a console whose every page
     * the server refuses, which is exactly the screen this route used to
     * produce. `/onboarding` is where the position is explained.
     */
    accountType: 'reporter',
    businessName: input.organisationName,
    onboardingComplete: false,
    /*
     * Kept rather than discarded.
     *
     * Five of the nine fields this form collects — sector, phone, interests,
     * tier and expected volume — were validated and then dropped on the floor,
     * because nothing downstream could accept them. `interests` is the one that
     * matters most: it is what routing matches a report against, so an
     * organisation created without it would receive nothing.
     */
    pendingApplication: {
      organisationName: input.organisationName,
      sector: input.sector,
      phone: input.phone,
      interests: input.interests ?? [],
      ...(input.tier ? { tier: input.tier } : {}),
    },
    accessToken: tokens.accessToken,
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    ...(tokens.expiresAt ? { accessTokenExpiresAt: tokens.expiresAt } : {}),
  });

  return NextResponse.json({ redirectTo: '/onboarding' });
}
