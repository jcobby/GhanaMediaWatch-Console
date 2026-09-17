import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRequest, isLiveBackend } from '@/lib/api';
import { ApiUnavailable } from '@/lib/apiError';
import { createSession } from '@/lib/session';

/**
 * Register an organisation.
 *
 * `POST /auth/register` with `accountKind: "organisation"` creates the account,
 * a **pending** organisation and the applicant's owner membership in one call,
 * so the next thing they see is the onboarding wizard writing to their own
 * application on the service.
 *
 * Before the backend could do that, this route created a reporter account and
 * filed the organisation's details in a JSON file on the console's disk. The
 * platform owner could only see applications made on the same machine, and a
 * redeploy lost every one of them.
 *
 * Signs the applicant straight in. Registration and onboarding are one
 * continuous act from their side.
 */
const schema = z.object({
  organisationName: z.string().trim().min(1, 'Enter the organisation name'),
  sector: z.enum(['government', 'media', 'utility', 'insurance', 'ngo', 'research', 'other'], {
    errorMap: () => ({ message: 'Choose a sector' }),
  }),
  contactName: z.string().trim().min(1, 'Enter your name'),
  email: z.string().trim().email('Enter a valid work email'),
  phone: z.string().trim().min(6, 'Enter a phone number'),
  /*
   * The credential that lets them back in. The service's floor is six; eight is
   * asked for here, and the form says so before submit.
   */
  password: z.string().min(8, 'Choose a password of at least 8 characters'),
  interests: z.array(z.string()).optional(),
  tier: z.string().optional(),
  expectedMonthlyDownloads: z.number().optional(),
});

interface TokenEnvelope {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  me?: {
    userId?: string;
    orgId?: string | null;
    memberships?: { orgId?: string; name?: string }[];
  };
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
     * tells the reader nothing about which field.
     */
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') ?? '';
    const message =
      issue && issue.message !== 'Required' ? issue.message : `${field || 'A field'} is missing.`;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const input = parsed.data;
  const email = input.email.trim().toLowerCase();

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
        email,
        password: input.password,
        displayName: input.contactName,
        accountKind: 'organisation',
        organisation: { name: input.organisationName, sector: input.sector },
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

  const orgId = tokens.me?.orgId ?? tokens.me?.memberships?.find((m) => m.orgId)?.orgId ?? null;
  if (!tokens.accessToken || !orgId) {
    /*
     * The account exists but the service did not say which organisation it
     * made. Signing them in without one would open a wizard that cannot save,
     * so they are sent to sign in — which reads `/me` afresh.
     */
    return NextResponse.json(
      { error: 'Your account was created, but the organisation could not be confirmed. Sign in to continue.' },
      { status: 502 },
    );
  }

  /*
   * What registration collected that the account itself has no field for.
   *
   * Interests are what routing matches reports against, and the plan and
   * expected volume price the subscription. `/auth/register` accepts only a name
   * and sector, so they are written onto the organisation step, where the
   * platform owner reads the application and where the wizard keeps them when
   * that step is saved again.
   *
   * Not fatal: the account and organisation exist either way, and failing the
   * registration here would tell somebody to register again with an email that
   * is already taken.
   */
  await apiRequest('/org/onboarding/steps/organisation', {
    method: 'PUT',
    token: tokens.accessToken,
    headers: { 'X-Dawuro-Org': orgId },
    body: {
      legalName: input.organisationName,
      sector: input.sector,
      contactName: input.contactName,
      contactEmail: email,
      phone: input.phone,
      interests: input.interests ?? [],
      ...(input.tier ? { tier: input.tier } : {}),
      ...(input.expectedMonthlyDownloads !== undefined
        ? { expectedMonthlyDownloads: input.expectedMonthlyDownloads }
        : {}),
    },
  }).catch(() => undefined);

  await createSession({
    id: tokens.me?.userId ?? email,
    email,
    displayName: input.contactName,
    /*
     * An organisation, because the service made one — pending, so middleware
     * keeps them on `/onboarding` and every other `/org/*` route refuses them
     * until the platform owner approves.
     */
    accountType: 'organisation',
    businessId: orgId,
    businessName: input.organisationName,
    onboardingComplete: false,
    accessToken: tokens.accessToken,
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    ...(tokens.expiresAt ? { accessTokenExpiresAt: tokens.expiresAt } : {}),
  });

  return NextResponse.json({ redirectTo: '/onboarding' });
}
