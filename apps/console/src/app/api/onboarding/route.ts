import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DOCUMENT_REQUIREMENTS } from '@dawuro/core';
import { readSession } from '@/lib/session';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { normaliseOnboarding } from '@/lib/onboarding';

/**
 * The onboarding forms, saved on the service.
 *
 * This used to write to a JSON file on the console's own disk, because the
 * backend had nowhere to put an application: `/auth/register` made reporters
 * only, and every `/org/*` route needed an organisation that already existed.
 * Registration now creates a pending organisation, so the application lives
 * where the platform owner reviews it and survives a redeploy.
 *
 * Four actions:
 *
 *   - `save`     — keep a step's answers; the step stays editable.
 *   - `send`     — save, then send that step for review.
 *   - `document` — record an attached document.
 *   - `submit`   — send the whole application to the platform owner.
 *
 * Every answer is the service's own application, normalised, so the wizard shows
 * what was stored rather than what it assumes was stored.
 */

/*
 * The organisation's four, and deliberately not `ALL_STEP_IDS`.
 *
 * This route is an organisation filling in its own wizard against
 * `/org/onboarding/*`. A blogger never reaches it — they verify on the phone,
 * through `/me/verification*` — so a blogger step id arriving here is a bug,
 * and forwarding it to an org-scoped endpoint would turn a clear refusal into
 * a confusing server error.
 *
 * The platform's *decision* route is the one that takes both kinds; it uses
 * `ALL_STEP_IDS` and says why.
 */
const STEP = z.enum(['organisation', 'officer', 'coverage', 'documents']);

/** The service's own ceiling for an onboarding document. */
const MAX_BYTES = 25 * 1024 * 1024;

const ACCEPTED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), stepId: STEP, payload: z.record(z.unknown()) }),
  z.object({ action: z.literal('send'), stepId: STEP, payload: z.record(z.unknown()) }),
  z.object({
    action: z.literal('document'),
    documentType: z.string().refine((id) => id in DOCUMENT_REQUIREMENTS, 'Unknown document type.'),
    fileName: z.string().trim().min(1).max(200),
    // Computed in the browser from the file itself, so it names these bytes.
    sha256: z.string().regex(/^[a-f0-9]{64}$/, 'That file could not be read.'),
    mimeType: z.string(),
    byteSize: z
      .number()
      .int()
      .positive('Choose a file to attach.')
      .max(MAX_BYTES, 'That file is larger than 25 MB. Attach a smaller copy.'),
  }),
  z.object({ action: z.literal('submit') }),
]);

/**
 * The bytes of one document.
 *
 * A separate handler because a file is not JSON, and it is a `PUT` on this same
 * path rather than `/api/onboarding/documents` deliberately: that path must not
 * exist. The console once kept applications and their files on its own disk,
 * which the platform owner could only see on the same machine and which a
 * redeploy erased, and `registration.test.ts` keeps the path free so that cannot
 * come back. Nothing is written here — the bytes are forwarded and forgotten.
 *
 * The document must be declared first (`action: "document"`), because the
 * service checks these bytes against the `sha256` that declared them.
 */
export async function PUT(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue your application.' }, { status: 401 });
  }
  if (!session.businessId) {
    return NextResponse.json(
      { error: 'This account has no organisation to apply for. Register one first.' },
      { status: 403 },
    );
  }

  const documentType = new URL(request.url).searchParams.get('documentType') ?? '';
  if (!(documentType in DOCUMENT_REQUIREMENTS)) {
    return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 });
  }

  /*
   * The type as the browser reported it, without its parameters — a
   * `Content-Type` may arrive as `image/jpeg; charset=binary`.
   *
   * An unknown type is allowed through, exactly as the declare step allows an
   * empty `mimeType`. A phone that cannot name a HEIC sends nothing at all, and
   * refusing the file for that would reject the document rather than the
   * problem. The service checks the bytes against the declared hash either way.
   */
  const mimeType = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (mimeType && mimeType !== 'application/octet-stream' && !ACCEPTED.has(mimeType)) {
    return NextResponse.json({ error: 'Attach a PDF or a photo of the document.' }, { status: 415 });
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: 'That file is empty. Choose it again.' }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: 'That file is larger than 25 MB. Attach a smaller copy.' },
      { status: 413 },
    );
  }

  try {
    await org.uploadOnboardingDocumentBytes(documentType, bytes, mimeType);
    /*
     * Re-read rather than trust the upload's own answer. What the wizard renders
     * is the application as the service now holds it, so a document that did not
     * attach cannot show as attached.
     */
    const raw = await org.onboarding();
    return NextResponse.json(normaliseOnboarding(raw, session.businessName ?? ''));
  } catch (cause) {
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json(
        {
          error:
            cause.status === 0
              ? 'The service could not be reached. The file was not uploaded.'
              : cause.message,
        },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    return NextResponse.json({ error: 'That file could not be uploaded.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in to continue your application.' }, { status: 401 });
  }
  /*
   * The organisation comes from the session, never from the request.
   *
   * The header that scopes these calls is filled from `session.businessId`, so
   * one applicant cannot write to another's application by naming it.
   */
  if (!session.businessId) {
    return NextResponse.json(
      { error: 'This account has no organisation to apply for. Register one first.' },
      { status: 403 },
    );
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
      { error: parsed.error.issues[0]?.message ?? 'That could not be saved. Check the form.' },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    let raw: unknown;

    if (input.action === 'save' || input.action === 'send') {
      raw = await org.saveOnboardingStep(input.stepId, input.payload);
      // Only after the answers are stored: sending an older copy for review
      // would put the reviewer in front of something the applicant has changed.
      if (input.action === 'send') raw = await org.submitOnboardingStep(input.stepId);
    } else if (input.action === 'document') {
      if (input.mimeType && !ACCEPTED.has(input.mimeType)) {
        return NextResponse.json(
          { error: 'Attach a PDF or a photo of the document.' },
          { status: 415 },
        );
      }
      const answer = await org.attachOnboardingDocument<{ application?: unknown }>({
        documentType: input.documentType,
        fileName: input.fileName,
        sha256: input.sha256,
        mimeType: input.mimeType || 'application/octet-stream',
        byteSize: input.byteSize,
      });
      // The service answers `{document, application}`; re-read if it ever stops.
      raw = answer?.application ?? (await org.onboarding());
    } else {
      await org.submitOnboarding();
      raw = await org.onboarding();
    }

    return NextResponse.json(normaliseOnboarding(raw, session.businessName ?? ''));
  } catch (cause) {
    /*
     * The service's own words.
     *
     * It says exactly what is wrong — "Required documents are missing for this
     * step.", "Cannot submit application: steps_outstanding." — and a generic
     * "could not be saved" would leave the applicant guessing which.
     */
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json(
        { error: cause.status === 0 ? 'The service could not be reached. Nothing was saved.' : cause.message },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    return NextResponse.json({ error: 'That could not be saved. Try again.' }, { status: 500 });
  }
}
