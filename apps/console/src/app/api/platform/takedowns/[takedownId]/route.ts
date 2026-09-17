import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roleCan } from '@dawuro/core';
import { ApiUnavailable } from '@/lib/apiError';
import { platform } from '@/lib/consoleApi';
import { readSession } from '@/lib/session';

/**
 * Deciding a request from somebody who appears in footage.
 *
 * These are statutory requests under Ghana's Data Protection Act (Act 843), and
 * until now the buttons were simulated: the row settled into "Upheld" after a
 * timer and the platform was told nothing, so a refusal nobody recorded looked
 * exactly like one that was. On this screen that is the worst possible failure —
 * a person asked for their footage to come down and was shown a tick.
 *
 * A reason travels with both answers. A refusal that cannot be explained is not
 * a decision anybody can account for later, and Act 843 expects it to be.
 */

const schema = z.object({
  decision: z.enum(['accepted', 'rejected']),
  note: z.string().trim().min(4, 'Record why, however briefly.').max(500),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ takedownId: string }> },
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  }
  /*
   * Checked here, not only on the page. The page redirects on the capability;
   * this endpoint is reachable directly, and a redirect rule on a URL prefix was
   * never an authorisation boundary.
   */
  const allowed =
    session.accountType === 'platform_owner' ||
    Boolean(session.role && roleCan(session.role, 'handle_takedowns'));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Only a compliance officer can decide a takedown.' },
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
      { error: parsed.error.issues[0]?.message ?? 'That decision could not be recorded.' },
      { status: 400 },
    );
  }

  const { takedownId } = await context.params;

  try {
    await platform.decideTakedown(takedownId, parsed.data);
    return NextResponse.json({ ok: true, decision: parsed.data.decision });
  } catch (cause) {
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json(
        {
          error:
            cause.status === 0
              ? 'The service could not be reached. Nothing was decided.'
              : cause.message,
        },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    return NextResponse.json({ error: 'That could not be sent.' }, { status: 500 });
  }
}
