import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { editorial } from '@/lib/consoleApi';
import { readSession } from '@/lib/session';

/**
 * An editor's answer to an organisation's request to publish.
 *
 * Approve: published on the chosen desk, credited to the organisation, and
 * optionally put on the top stories. Decline: a reason, which goes back to the
 * organisation — required, because "declined" alone teaches nobody anything.
 */

const SECTION = z.enum(['ghana', 'africa', 'world', 'business', 'politics', 'sport']);

const schema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('approve'),
    section: SECTION,
    lead: z.boolean().optional(),
    leadUntil: z.string().datetime().nullable().optional(),
  }),
  z.object({
    decision: z.literal('decline'),
    reason: z.string().trim().min(4, 'Say why, so the organisation can act on it.').max(500),
  }),
]);

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  }
  // Publishing is the desk's decision — checked here as well as by middleware.
  if (session.accountType !== 'editor' && session.accountType !== 'platform_owner') {
    return NextResponse.json(
      { error: 'Only an editor can decide what is published.' },
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
      { error: parsed.error.issues[0]?.message ?? 'That decision could not be sent.' },
      { status: 400 },
    );
  }

  const { incidentId } = await context.params;
  const input = parsed.data;

  try {
    await editorial.decidePublication(
      incidentId,
      input.decision === 'approve'
        ? {
            decision: 'approve',
            section: input.section,
            ...(input.lead !== undefined ? { lead: input.lead } : {}),
            ...(input.leadUntil !== undefined ? { leadUntil: input.leadUntil } : {}),
          }
        : { decision: 'decline', reason: input.reason },
    );
    return NextResponse.json({ decision: input.decision });
  } catch (cause) {
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json({ error: cause.message }, { status: cause.status || 502 });
    }
    return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
  }
}
