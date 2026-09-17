import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { readSession } from '@/lib/session';

/**
 * Accepting somebody into an organisation, or turning them down.
 *
 * This is an access decision, not an administrative one: an accepted member can
 * read reports filed by the public, including ones whose reporters stayed
 * anonymous because being identified would put them at risk. It used to be React
 * state — the row moved, a staff row appeared, and the platform was told nothing,
 * so a reload put the person back in the queue and they still could not see
 * anything.
 *
 * The console's word is `accepted`; the service's is `approved`.
 */

const schema = z.object({ decision: z.enum(['accepted', 'rejected']) });

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  }
  /*
   * Checked here as well as in middleware. Middleware gates the page; this
   * endpoint is reachable directly, and who may join an organisation is not
   * something a redirect rule on a URL prefix decides.
   */
  if (session.accountType !== 'organisation') {
    return NextResponse.json(
      { error: 'Only an organisation can decide who joins it.' },
      { status: 403 },
    );
  }
  if (!session.businessId) {
    return NextResponse.json(
      { error: 'This account has no organisation. Sign in again.' },
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
    return NextResponse.json({ error: 'That decision could not be read.' }, { status: 400 });
  }

  const { requestId } = await context.params;

  try {
    await org.decideMembership(
      requestId,
      parsed.data.decision === 'accepted' ? 'approved' : 'rejected',
    );
    return NextResponse.json({ ok: true, decision: parsed.data.decision });
  } catch (cause) {
    // The service's own words: "already decided" and "not your organisation"
    // need different next steps from the person reading it.
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
