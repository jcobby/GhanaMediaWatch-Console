import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSession } from '@/lib/session';
import { saveOnboarding, submitApplication } from '@/lib/applications';

/**
 * The onboarding forms, saved.
 *
 * An organisation registers, fills these in, and sends them for review — at
 * which point the Dawuro owner decides. This handler is the middle of that:
 * without it the wizard was four steps and five document slots held in React
 * state with no request behind any of it. An applicant could work through the
 * whole thing, press submit, and have every answer discarded on navigation,
 * with a confirmation screen telling them it had been received.
 *
 * Two actions, because they are genuinely different events. `save` happens
 * continuously as somebody types and must be cheap and forgiving. `submit`
 * happens once, is what puts the application in front of an operator, and
 * closes the application to further editing — an applicant who could still edit
 * would be changing the evidence under a reviewer mid-decision.
 *
 * Writes to the console's own store rather than the API, because no endpoint
 * accepts an application. See `lib/applications.ts`.
 */

const documentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  storedAs: z.string(),
  byteSize: z.number(),
  contentType: z.string(),
  uploadedAtIso: z.string(),
});

const stepSchema = z.object({
  id: z.string(),
  status: z.string(),
  rejectionReason: z.string().nullable(),
  submittedAtIso: z.string().nullable(),
  reviewedAtIso: z.string().nullable(),
  reviewedBy: z.string().nullable(),
});

const progressSchema = z.object({
  organisation: z.object({
    legalName: z.string(),
    registrationNumber: z.string(),
    tin: z.string(),
  }),
  officer: z.object({
    name: z.string(),
    role: z.string(),
    idNumber: z.string(),
    phone: z.string(),
  }),
  coverage: z.object({
    address: z.string(),
    city: z.string(),
    areaLabel: z.string(),
    radiusKm: z.string(),
  }),
  documents: z.array(documentSchema),
  steps: z.array(stepSchema),
});

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), progress: progressSchema }),
  z.object({ action: z.literal('submit'), progress: progressSchema }),
]);

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue your application.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'That could not be saved. Check the form.' },
      { status: 400 },
    );
  }

  /*
   * Keyed on the signed-in account, never on anything the browser sent.
   *
   * The application id is in the page's own data, so accepting one from the
   * request body would let any signed-in account write over somebody else's
   * application — including submitting it, or replacing the evidence attached
   * to it.
   */
  const email = session.email;
  const progress = parsed.data.progress as Parameters<typeof saveOnboarding>[1];

  const saved = await saveOnboarding(email, progress);
  if (!saved) {
    /*
     * No draft to write to. Either they have no application, or it is already
     * under review — and an application under review is deliberately frozen.
     */
    return NextResponse.json(
      { error: 'This application has already been sent for review and cannot be changed.' },
      { status: 409 },
    );
  }

  if (parsed.data.action === 'save') {
    return NextResponse.json({ status: saved.status });
  }

  const submitted = await submitApplication(email, new Date().toISOString());
  if (!submitted) {
    return NextResponse.json(
      { error: 'This application could not be sent. Reload and try again.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ status: submitted.status, submittedAtIso: submitted.submittedAtIso });
}
