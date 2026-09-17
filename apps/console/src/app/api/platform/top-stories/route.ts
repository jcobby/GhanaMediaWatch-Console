import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { requireSession } from '@/lib/session';
import {
  COUNT_RANGE,
  DWELL_SECONDS_RANGE,
  readTopStories,
  writeTopStories,
} from '@/lib/topStories';

/**
 * How the top of the mobile feed behaves, set by the platform desk.
 *
 * Two numbers — how many stories share the lead slot, and how long each holds
 * before the next slides in. A busy news day wants more stories moving faster
 * and a quiet one wants fewer holding longer, which makes this an editorial
 * decision rather than a constant compiled into an app nobody can change
 * without a release.
 *
 * **Saved to the service.** `PUT /platform/settings` stores it and `GET /settings`
 * serves it to every phone within five minutes. It used to write to a file in
 * this console, because no endpoint carried a platform setting — so nothing the
 * desk saved ever reached a reader.
 */

const schema = z.object({
  count: z.number().int().min(COUNT_RANGE.min).max(COUNT_RANGE.max),
  dwellSeconds: z.number().int().min(DWELL_SECONDS_RANGE.min).max(DWELL_SECONDS_RANGE.max),
});

/** The service's own sentence and status, so an operator sees what refused it. */
function failed(cause: unknown, fallback: string) {
  const failure = cause instanceof ApiUnavailable ? cause : null;
  return NextResponse.json(
    { error: failure?.message ?? fallback, upstreamStatus: failure?.status ?? 0 },
    { status: failure && failure.status >= 400 ? failure.status : 502 },
  );
}

export async function GET() {
  const session = await requireSession();
  if (session.accountType !== 'platform_owner') {
    return NextResponse.json(
      { error: 'This account cannot read platform settings.' },
      { status: 403 },
    );
  }
  try {
    return NextResponse.json(await readTopStories());
  } catch (cause) {
    return failed(cause, 'The service did not answer.');
  }
}

export async function PUT(request: Request) {
  const session = await requireSession();
  if (session.accountType !== 'platform_owner') {
    // Middleware already gates the page; this guards the endpoint itself,
    // which is reachable directly.
    return NextResponse.json(
      { error: 'This account cannot change platform settings.' },
      { status: 403 },
    );
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: 'This session carries no backend credential. Sign in again.' },
      { status: 401 },
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
    /*
     * The bounds in words, because every one of them is a typo somebody will
     * make. Zero stories empties the top of the feed, three seconds is the
     * floor below which a headline cannot be read, and twenty is the ceiling
     * above which a reader assumes the rotation is broken.
     */
    return NextResponse.json(
      {
        error: `Between ${COUNT_RANGE.min} and ${COUNT_RANGE.max} stories, each held for ${DWELL_SECONDS_RANGE.min} to ${DWELL_SECONDS_RANGE.max} seconds.`,
      },
      { status: 400 },
    );
  }

  try {
    const saved = await writeTopStories({
      count: parsed.data.count,
      dwellSeconds: parsed.data.dwellSeconds,
      byEmail: session.email,
      atIso: new Date().toISOString(),
      token: session.accessToken,
    });
    return NextResponse.json(saved);
  } catch (cause) {
    return failed(cause, 'The setting could not be saved.');
  }
}
