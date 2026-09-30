import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ALL_STEP_IDS } from '@dawuro/core';
import { readSession } from '@/lib/session';
import { ApiUnavailable } from '@/lib/apiError';
import { platform } from '@/lib/consoleApi';

/**
 * Deciding an organisation's application.
 *
 * Every decision goes to the service. This used to have two paths — one for
 * applications the backend held, and one that wrote decisions into a file on the
 * console's own disk and then created the organisation separately. Registration
 * now creates the organisation (pending), so there is one queue and approving it
 * is `POST /platform/applications/{id}/approve`.
 */

const schema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approved') }),
  z.object({
    decision: z.literal('rejected'),
    /*
     * Required, and not merely encouraged. An applicant told only "declined"
     * applies again with the same problem.
     */
    note: z.string().trim().min(1, 'Give a reason for the rejection.'),
  }),
  z.object({
    decision: z.literal('step'),
    /*
     * Both kinds of application, from the one list they are declared in.
     *
     * **This enum was the organisation's four, typed out by hand, and it made
     * every blogger undecidable.** The platform queue carries organisations
     * and bloggers together, but a blogger's steps are `identity`, `presence`
     * and `coverage` — so approving their first one sent `stepId: 'identity'`,
     * this rejected it, and the reviewer was shown a Zod parser error naming
     * an enum they had no way to know about: *"Invalid enum value. Expected
     * 'organisation' | 'officer' | 'coverage' | 'documents', received
     * 'identity'"*. The panel rendered perfectly and no decision could be
     * recorded through it.
     *
     * `ALL_STEP_IDS` is derived from the two step lists, so a step added to
     * either kind is accepted here without anybody remembering to come back.
     *
     * Note this is the one route that takes both. `api/onboarding/route.ts`
     * keeps the organisation's four deliberately — that is an organisation
     * filling in its own wizard against `/org/onboarding/*`, and a blogger
     * step id arriving there is a bug worth refusing rather than forwarding.
     */
    stepId: z.enum(ALL_STEP_IDS as [string, ...string[]]),
    status: z.enum(['approved', 'rejected']),
    note: z.string().trim().optional(),
  }),
  z.object({ decision: z.literal('screening'), clear: z.boolean() }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  }

  /*
   * Checked here, not only in middleware. Middleware gates the page; this
   * endpoint is reachable directly, and deciding who may license the public's
   * footage is not gated by a redirect rule on a URL prefix.
   */
  if (session.accountType !== 'platform_owner') {
    return NextResponse.json(
      { error: 'Only a platform owner can decide an application.' },
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
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? 'That decision could not be recorded.' },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const input = parsed.data;

  if (input.decision === 'step' && input.status === 'rejected' && !input.note) {
    return NextResponse.json(
      { error: 'Say what needs changing, so the applicant can fix it.' },
      { status: 400 },
    );
  }

  try {
    if (input.decision === 'approved') {
      await platform.approve(id);
    } else if (input.decision === 'rejected') {
      /*
       * The whole application, declined. The endpoint landed on 16 September;
       * before it, this answered 501 and told the reviewer to send the offending
       * step back instead.
       *
       * The console calls the reason `note`, as it does for a step; the service
       * calls it `reason`. Translated here rather than renamed through the
       * screens, so one vocabulary reaches the reviewer.
       */
      await platform.reject(id, input.note);
    } else if (input.decision === 'screening') {
      await platform.screen(id, input.clear);
    } else {
      /*
       * `approved` / `rejected`, and one key rather than two.
       *
       * The decide body is undocumented — `additionalProperties: true` with
       * nothing declared — so this was sending both spellings at once:
       * `decision: 'accepted'` alongside `status: 'approved'`. The service
       * refused it with "Request validation failed", which is what a reviewer
       * saw instead of a decision being recorded.
       *
       * Two things were likely wrong with that guess. `accepted` is not the
       * word this service uses anywhere else — `/org/membership-requests/{id}/decide`
       * takes `approved` | `rejected` — and sending a second, unexpected key
       * alongside it gives a strict validator a second thing to object to.
       * This sends the vocabulary the rest of the API uses, and nothing more.
       *
       * If it is still wrong, the error now names the offending field: the
       * service's `details.issues` are carried through to the reviewer rather
       * than collapsed to the word "issues".
       */
      await platform.decideStep(id, input.stepId, {
        decision: input.status,
        ...(input.note ? { note: input.note } : {}),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (cause) {
    const status = cause instanceof ApiUnavailable ? cause.status : 0;
    return NextResponse.json(
      { error: cause instanceof ApiUnavailable ? cause.message : 'That could not be sent.' },
      { status: status >= 400 ? status : 502 },
    );
  }
}
