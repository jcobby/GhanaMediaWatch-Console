import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roleCan } from '@dawuro/core';
import { readSession } from '@/lib/session';
import { ApiUnavailable } from '@/lib/apiError';
import { platform } from '@/lib/consoleApi';
import { normalisePayoutRun } from '@/lib/payouts';

/**
 * Paying reporters.
 *
 * Three actions, all of which the service now supports:
 *
 *   - `create`  — open a draft batch from every unpaid commission. Moves no money.
 *   - `release` — send a draft batch over mobile money. Cannot be recalled.
 *   - `retry`   — try one failed payment again.
 *
 * Before this route existed the payouts screen moved a batch into "Past runs"
 * in React state and sent nothing, under a banner admitting as much.
 *
 * Answers with the batch the service returned, normalised, so the screen shows
 * each payment's real status rather than assuming the release went through.
 */

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    /*
     * The newest batch the operator could see. Part of the idempotency key, so a
     * double-click opens one batch, and a new batch can still be opened after
     * that one is released.
     */
    afterBatchId: z.string().nullable(),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({ action: z.literal('release'), batchId: z.string().min(1) }),
  z.object({
    action: z.literal('retry'),
    entryId: z.string().min(1),
    /** The failure the operator saw, so each new failure is a new attempt. */
    attempt: z.string().max(400),
  }),
]);

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  }

  /*
   * Checked here as well as on the page. This endpoint sends money and is
   * reachable directly, so it is not gated by a redirect rule on a URL prefix.
   */
  const allowed =
    session.accountType === 'platform_owner' ||
    Boolean(session.role && roleCan(session.role, 'run_payouts'));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Only a platform owner or finance officer can pay reporters.' },
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
      { error: parsed.error.issues[0]?.message ?? 'That could not be sent.' },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    let raw: unknown;
    if (input.action === 'create') {
      raw = await platform.createPayoutBatch(
        input.note ? { note: input.note } : {},
        `after:${input.afterBatchId ?? 'none'}`,
      );
    } else if (input.action === 'release') {
      raw = await platform.releasePayoutBatch(input.batchId);
    } else {
      raw = await platform.retryPayoutEntry(input.entryId, input.attempt);
    }
    return NextResponse.json({ run: normalisePayoutRun(raw) });
  } catch (cause) {
    /*
     * The service's own words. On a money action "something went wrong" is the
     * worst answer: the operator cannot tell whether to press again.
     */
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json(
        {
          error:
            cause.status === 0
              ? 'The service could not be reached, so nothing was sent. Check the batch before trying again.'
              : cause.message,
        },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    return NextResponse.json(
      { error: 'That could not be sent. Check the batch before trying again.' },
      { status: 500 },
    );
  }
}
