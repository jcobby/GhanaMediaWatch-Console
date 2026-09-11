import { NextResponse } from 'next/server';
import { z } from 'zod';
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
 * **It writes to the console's own store, not to the service.** No endpoint
 * carries a platform setting of any kind — checked against the published
 * OpenAPI document — so what is saved here is durable and is not yet
 * distributed: phones run on their own defaults until the backend serves it.
 * That is stated on the page where the control is, rather than left for an
 * operator to discover.
 */

const schema = z.object({
  count: z.number().int().min(COUNT_RANGE.min).max(COUNT_RANGE.max),
  dwellSeconds: z.number().int().min(DWELL_SECONDS_RANGE.min).max(DWELL_SECONDS_RANGE.max),
});

export async function GET() {
  const session = await requireSession();
  if (session.accountType !== 'platform_owner') {
    return NextResponse.json(
      { error: 'This account cannot read platform settings.' },
      { status: 403 },
    );
  }
  return NextResponse.json(await readTopStories());
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

  const saved = await writeTopStories({
    count: parsed.data.count,
    dwellSeconds: parsed.data.dwellSeconds,
    // Who changed it, so a rotation nobody remembers setting has a name on it.
    byEmail: session.email,
    atIso: new Date().toISOString(),
  });

  return NextResponse.json(saved);
}
