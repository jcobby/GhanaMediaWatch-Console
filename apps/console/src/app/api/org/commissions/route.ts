import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { requireSession } from '@/lib/session';
import { readPlatformRates, writeOrganisationOffer } from '@/lib/commissionRates';

/**
 * Saving an organisation's commission offer.
 *
 * An offer can only raise what a reporter earns: every rate is checked against
 * the platform's current rate for its category, and anything at or below it is
 * dropped rather than used to pay less. The answer lists what was dropped.
 */

const schema = z.object({
  categoryPesewas: z.record(z.number().int().nonnegative()),
});

export async function PUT(request: Request) {
  const session = await requireSession();
  if (session.accountType !== 'organisation') {
    return NextResponse.json(
      { error: 'Only an organisation can set its own commission offer.' },
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
    return NextResponse.json({ error: 'Each offer has to be a whole number of pesewas.' }, { status: 400 });
  }

  try {
    const { rates } = await readPlatformRates();
    const saved = await writeOrganisationOffer(parsed.data, rates);
    const dropped = Object.keys(parsed.data.categoryPesewas).filter(
      (category) => !(category in saved.offer.categoryPesewas),
    );

    if (!saved.supported) {
      return NextResponse.json(
        { error: 'The service cannot store organisation offers yet. Nothing was saved.', ...saved, dropped },
        { status: 501 },
      );
    }
    return NextResponse.json({ ...saved, dropped });
  } catch (cause) {
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json(
        { error: cause.status === 0 ? 'The service could not be reached. Nothing was saved.' : cause.message },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    return NextResponse.json({ error: 'The offer could not be saved.' }, { status: 500 });
  }
}
