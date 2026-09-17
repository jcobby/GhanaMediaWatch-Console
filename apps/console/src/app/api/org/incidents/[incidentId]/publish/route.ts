import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';

/**
 * Sending a licensed report to the editor to publish.
 *
 * `POST /org/incidents/{id}/publish` does not publish: it creates a request
 * (`publicationStatus: "awaiting_editor"`). An editor approves it — published and
 * credited to this organisation — or declines with a reason. Nothing reaches the
 * public feed without an editor.
 */

const schema = z.object({
  /*
   * Required, because the service requires it as of 17 September — and for the
   * reason it asked for: a report published with no desk appears on no desk in
   * the app, turning up only under Latest, with nothing erroring to say so.
   *
   * Optional here once, which would now mean a request the service refuses. The
   * panel has always sent one (it defaults to the report's own desk, or Ghana),
   * so this closes the gap between what the form guarantees and what the
   * endpoint accepts rather than changing what anybody sees.
   */
  section: z.enum(['ghana', 'africa', 'world', 'business', 'politics', 'sport']),
  note: z.string().trim().max(500, 'Keep the note under 500 characters.').optional(),
});

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await context.params;

  const session = await requireSession();
  if (session.accountType !== 'organisation') {
    return NextResponse.json(
      { error: 'Only an organisation can send a report to the editor.' },
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
      { error: parsed.error.issues[0]?.message ?? 'That request could not be sent.' },
      { status: 400 },
    );
  }

  try {
    const answer = await org.publish<{ publicationStatus?: string; requestedAt?: string }>(incidentId, {
      ...(parsed.data.section ? { section: parsed.data.section } : {}),
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    });
    return NextResponse.json({
      publicationStatus: answer?.publicationStatus ?? 'awaiting_editor',
      requestedAt: answer?.requestedAt ?? null,
    });
  } catch (cause) {
    // The service's own sentence: "not licensed by this organisation" and
    // "already requested" need different next steps.
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json({ error: cause.message }, { status: cause.status || 502 });
    }
    return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
  }
}
