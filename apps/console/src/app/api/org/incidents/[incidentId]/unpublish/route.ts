import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';

/**
 * Withdrawing a report this organisation released.
 *
 * `POST /org/incidents/{id}/unpublish` removes it from the public feed and from
 * the organisation's public page. The licence is kept, and the service audits
 * the change. The "Withhold" button this replaces flipped a badge in the browser
 * and left the report live — the one thing somebody pressing it wants not to
 * happen.
 *
 * A reason is required. Taking down footage a citizen filmed is a decision
 * somebody may have to account for later, to the reporter or to a regulator.
 */

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(4, 'Say why it is being withdrawn.')
    .max(500, 'Keep the reason under 500 characters.'),
});

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await context.params;

  const session = await requireSession();
  if (session.accountType !== 'organisation') {
    // Middleware gates the page; this guards the endpoint, which is reachable directly.
    return NextResponse.json(
      { error: 'Only the organisation that released a report can withdraw it.' },
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
      { error: parsed.error.issues[0]?.message ?? 'Say why it is being withdrawn.' },
      { status: 400 },
    );
  }

  try {
    const answer = await org.unpublish<{ unpublished?: boolean; vettingState?: string }>(
      incidentId,
      parsed.data.reason,
    );
    return NextResponse.json({
      unpublished: answer?.unpublished !== false,
      vettingState: answer?.vettingState ?? null,
    });
  } catch (cause) {
    /*
     * The service's own sentence. "Not published by this organisation" and
     * "already withdrawn" need different responses from the person reading it.
     */
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json({ error: cause.message }, { status: cause.status || 502 });
    }
    return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
  }
}
