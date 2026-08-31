import { NextResponse } from 'next/server';
import { z } from 'zod';
import { onboardingReference } from '@dawuro/core';
import { createSession } from '@/lib/session';

/**
 * Register an organisation.
 *
 * Signs the applicant straight in with `onboardingComplete: false`, so the
 * next thing they see is the wizard rather than a confirmation page and a dead
 * end. Registration and onboarding are one continuous act from the applicant's
 * side; splitting them across a sign-out was our mistake, not theirs.
 *
 * The session grants nothing beyond the wizard — middleware holds a business
 * account there until onboarding is finished and the platform has approved it.
 */
const schema = z.object({
  organisationName: z.string().trim().min(1, 'Enter the organisation name'),
  sector: z.string().trim().min(1, 'Choose a sector'),
  contactName: z.string().trim().min(1, 'Enter your name'),
  email: z.string().trim().email('Enter a valid work email'),
  phone: z.string().trim().min(6, 'Enter a phone number'),
  /*
   * Chosen at registration, checked at onboarding. Optional here because an
   * organisation can skip ahead and set them later — the wizard is where they
   * become binding.
   */
  interests: z.array(z.string()).optional(),
  tier: z.string().optional(),
  expectedMonthlyDownloads: z.number().optional(),
});

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
  // Simulated. A real registration creates the organisation and returns its id.
  const businessId = `biz_new_${Date.now().toString(36)}`;

  await createSession({
    id: input.email.toLowerCase(),
    email: input.email,
    displayName: input.contactName,
    accountType: 'business',
    businessId,
    businessName: input.organisationName,
    onboardingComplete: false,
  });

  return NextResponse.json({
    redirectTo: '/onboarding',
    reference: onboardingReference(1),
  });
}
