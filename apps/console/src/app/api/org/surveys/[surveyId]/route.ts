import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';
import { normaliseResults } from '@/lib/surveys';

/**
 * One survey: reading its results, and closing it.
 *
 * `GET` answers with per-question counts from `/org/surveys/{id}/responses`.
 * `POST {action: "close"}` stops it taking answers — the one change an
 * organisation paying per response most needs to be able to make.
 */

const schema = z.object({ action: z.literal('close') });

async function organisationOnly() {
  const session = await requireSession();
  return session.accountType === 'organisation'
    ? null
    : NextResponse.json({ error: 'This account has no surveys.' }, { status: 403 });
}

function failure(cause: unknown) {
  if (cause instanceof ApiUnavailable) {
    return NextResponse.json({ error: cause.message }, { status: cause.status || 502 });
  }
  return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
}

export async function GET(_request: Request, context: { params: Promise<{ surveyId: string }> }) {
  const refused = await organisationOnly();
  if (refused) return refused;
  const { surveyId } = await context.params;

  try {
    return NextResponse.json({ results: normaliseResults(await org.surveyResponses<unknown>(surveyId)) });
  } catch (cause) {
    return failure(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ surveyId: string }> }) {
  const refused = await organisationOnly();
  if (refused) return refused;
  const { surveyId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }
  if (!schema.safeParse(body).success) {
    return NextResponse.json({ error: 'Unknown survey action.' }, { status: 400 });
  }

  try {
    await org.updateSurvey(surveyId, { status: 'closed' });
    return NextResponse.json({ status: 'closed' });
  } catch (cause) {
    return failure(cause);
  }
}
