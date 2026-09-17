import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { requireSession } from '@/lib/session';
import { writePlatformRates } from '@/lib/commissionRates';

/**
 * Saving the platform's commission rates.
 *
 * Clamped on the way in (by `sanitiseCommissionRates`, the same rules every phone
 * applies to what it is served) and answered with whether the service kept them.
 * A save the service silently dropped is reported as exactly that.
 */

const schema = z.object({
  categoryPesewas: z.record(z.number()),
  videoMultiplier: z.number(),
  audioMultiplier: z.number(),
  directedMultiplier: z.number(),
  lowConfidenceMultiplier: z.number(),
  extraLicenseeShare: z.number(),
  platformFeeRate: z.number(),
});

export async function PUT(request: Request) {
  const session = await requireSession();
  if (session.accountType !== 'platform_owner') {
    // Middleware gates the page; this guards the endpoint, which is reachable directly.
    return NextResponse.json({ error: 'Only a platform owner can set commission rates.' }, { status: 403 });
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
    return NextResponse.json({ error: 'Every rate has to be a number.' }, { status: 400 });
  }

  try {
    const saved = await writePlatformRates(
      parsed.data as unknown as Parameters<typeof writePlatformRates>[0],
      session.accessToken,
    );
    return NextResponse.json({
      ...saved,
      ...(saved.stored
        ? {}
        : {
            warning:
              'The service accepted the request but did not keep the commission rates, so phones still use the built-in rates.',
          }),
    });
  } catch (cause) {
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json(
        { error: cause.status === 0 ? 'The service could not be reached. Nothing was saved.' : cause.message },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    return NextResponse.json({ error: 'The rates could not be saved.' }, { status: 500 });
  }
}
