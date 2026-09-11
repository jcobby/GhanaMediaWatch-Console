import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSession } from '@/lib/session';
import { ApiUnavailable } from '@/lib/apiError';
import { platform } from '@/lib/consoleApi';
import { decideApplication, heldApplications } from '@/lib/applications';
import { provisionOrganisation } from '@/lib/provisionOrganisation';

/**
 * Approving or rejecting an organisation.
 *
 * The last step of the flow: an organisation registers, fills in the onboarding
 * forms, sends them, and this is where the Dawuro owner answers. Before it, the
 * approvals screen carried a banner reading "Nothing here is saved yet —
 * approving or declining works on screen but is not sent to the service", which
 * was true and is the kind of control that should not exist.
 *
 * **What it does and does not do.** It records the decision, durably, against
 * the application. It does not create the organisation on the platform,
 * because no endpoint does — `/platform/applications/{id}/approve` exists but
 * only accepts applications the backend itself holds, and it holds none of
 * these. The screen says so at the point of clicking rather than implying the
 * organisation is now live.
 */

const schema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approved') }),
  /*
   * Finishing an approval that was recorded before the platform could act on it.
   *
   * Not a decision — the decision was made, possibly weeks ago. This creates the
   * organisation that approval was always supposed to create, for every row
   * approved while `POST /platform/organisations` did not exist. Without it the
   * whole backlog stays unusable, and the only alternative is asking each
   * newsroom to apply again.
   */
  z.object({ decision: z.literal('provision') }),
  z.object({
    decision: z.literal('rejected'),
    /*
     * Required, and not merely encouraged.
     *
     * An applicant told only "declined" applies again with the same problem.
     * These are newsrooms and public bodies, and the reason is the only part of
     * a rejection that is any use to anybody.
     */
    note: z.string().trim().min(1, 'Give a reason for the rejection.'),
  }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  }

  /*
   * Checked here, not only in middleware.
   *
   * Middleware gates the page; this endpoint is reachable directly. Deciding
   * who may license the public's footage is the most consequential action in
   * this console, and it is not gated by a redirect rule on a URL prefix.
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

  /*
   * Two queues reach this handler, and they are decided in different places.
   *
   * Applications this console holds are decided here, because the backend
   * cannot be told about them — no endpoint files one. Applications the backend
   * itself holds must be decided *on the backend*, or the console records an
   * approval the platform never hears about, which is the exact failure this
   * handler exists to remove. Which queue an id belongs to decides the path.
   */
  const held = await heldApplications();
  const isHeld = held.some((row) => row.id === id);

  /*
   * Finish an approval the platform never heard about.
   *
   * Runs on its own so the backlog can be cleared without re-deciding anything,
   * and so a failure here is reported as what it is — the organisation could not
   * be created — rather than as a decision that did not record.
   */
  if (parsed.data.decision === 'provision') {
    const application = held.find((row) => row.id === id);
    if (!application) {
      return NextResponse.json({ error: 'No such application.' }, { status: 404 });
    }

    const outcome = await provisionOrganisation(application);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({
      status: 'approved',
      organisationId: outcome.organisationId,
      created: outcome.created,
    });
  }

  if (!isHeld) {
    if (parsed.data.decision === 'rejected') {
      /*
       * The API publishes `approve`, `screening` and a per-step `decide`, and
       * nothing that rejects a whole application. Saying so is the only honest
       * answer: a local "rejected" would leave the applicant approved-pending
       * on the platform while this console showed them declined.
       */
      return NextResponse.json(
        {
          error:
            'Declining this application is not something the console can send yet. Approve it or leave it.',
        },
        { status: 501 },
      );
    }

    try {
      await platform.approve(id);
      return NextResponse.json({ status: 'approved' });
    } catch (cause) {
      const status = cause instanceof ApiUnavailable ? cause.status : 0;
      return NextResponse.json(
        { error: cause instanceof ApiUnavailable ? cause.message : 'That could not be sent.' },
        { status: status >= 400 ? status : 502 },
      );
    }
  }

  const decided = await decideApplication(id, parsed.data.decision, {
    email: session.email,
    atIso: new Date().toISOString(),
    ...(parsed.data.decision === 'rejected' ? { note: parsed.data.note } : {}),
  });

  if (!decided) {
    /*
     * Either it does not exist, or somebody else decided it first. Both are
     * the same thing to the operator: the queue they are looking at is stale.
     */
    return NextResponse.json(
      { error: 'That application is no longer waiting for a decision. Reload the queue.' },
      { status: 409 },
    );
  }

  /*
   * Approval creates the organisation, because approval *is* the end of setup.
   *
   * Run after the decision is durable, never instead of it: if the platform
   * refuses, the operator's decision still stands and the row appears in the
   * "approved, not yet created" list to be finished. Doing it the other way
   * round would lose a decision because a network call failed.
   */
  if (decided.status === 'approved') {
    const outcome = await provisionOrganisation(decided);
    if (!outcome.ok) {
      return NextResponse.json(
        {
          status: decided.status,
          decidedAtIso: decided.decidedAtIso,
          warning: `${decided.organisationName} is approved, but the organisation could not be created: ${outcome.error} Use "Finish setup" to try again.`,
        },
        // 200, not an error: the decision was recorded, which is what the
        // operator pressed. Reporting a failure would have them press again.
        { status: 200 },
      );
    }

    return NextResponse.json({
      status: decided.status,
      decidedAtIso: decided.decidedAtIso,
      organisationId: outcome.organisationId,
    });
  }

  return NextResponse.json({ status: decided.status, decidedAtIso: decided.decidedAtIso });
}
