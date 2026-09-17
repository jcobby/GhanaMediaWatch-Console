import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';
import { normaliseNotes } from '@/lib/notes';

/**
 * Internal notes on one report: reading them back, and adding one.
 *
 * Notes could be written but never read — `POST` existed and `GET` did not — so
 * a note was lost to everyone the moment it was saved. The service now lists
 * them. They are the organisation's own, and are never shown to the reporter or
 * the public.
 */

const schema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write the note first.')
    .max(2000, 'Keep a note under 2,000 characters.'),
});

async function organisationOnly() {
  const session = await requireSession();
  return session.accountType === 'organisation'
    ? null
    : NextResponse.json({ error: 'Only an organisation keeps notes on a report.' }, { status: 403 });
}

function failure(cause: unknown) {
  if (cause instanceof ApiUnavailable) {
    return NextResponse.json({ error: cause.message }, { status: cause.status || 502 });
  }
  return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
}

export async function GET(_request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const refused = await organisationOnly();
  if (refused) return refused;
  const { incidentId } = await context.params;

  try {
    return NextResponse.json({ notes: normaliseNotes(await org.notes<unknown>(incidentId)) });
  } catch (cause) {
    return failure(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const refused = await organisationOnly();
  if (refused) return refused;
  const { incidentId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'That note could not be saved.' },
      { status: 400 },
    );
  }

  try {
    await org.note(incidentId, { body: parsed.data.body });
    return NextResponse.json({ saved: true });
  } catch (cause) {
    return failure(cause);
  }
}
