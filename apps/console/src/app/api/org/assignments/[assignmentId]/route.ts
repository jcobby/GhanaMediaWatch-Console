import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';

/**
 * Moving a dispatch assignment along: accepted, on the way, on scene, closed.
 *
 * `PATCH /org/assignments/{id}`. The service holds the state; this only passes
 * on the step an officer pressed and the optional note with it.
 */

const schema = z.object({
  status: z.enum(['accepted', 'en_route', 'on_scene', 'closed']),
  note: z.string().trim().max(500, 'Keep the note under 500 characters.').optional(),
});

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await context.params;

  const session = await requireSession();
  if (session.accountType !== 'organisation') {
    return NextResponse.json({ error: 'This account has no assignments.' }, { status: 403 });
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
      { error: parsed.error.issues[0]?.message ?? 'That update could not be sent.' },
      { status: 400 },
    );
  }

  try {
    await org.updateAssignment(assignmentId, {
      status: parsed.data.status,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    });
    return NextResponse.json({ status: parsed.data.status });
  } catch (cause) {
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json({ error: cause.message }, { status: cause.status || 502 });
    }
    return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
  }
}
