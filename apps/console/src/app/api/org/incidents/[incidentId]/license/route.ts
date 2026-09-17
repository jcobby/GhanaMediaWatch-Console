import { NextResponse } from 'next/server';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';

/**
 * Licensing a report — the organisation's only spending action.
 *
 * It used to be `setLicensed(new Set(...).add(id))` and nothing else: the row
 * moved to the Licensed tab, the button said "Downloaded", and the service was
 * told nothing at all. A reload brought the report back as unlicensed, and an
 * officer who had "bought" four reports had bought none. The inbox carried a
 * banner saying so, which was honest and is no longer needed.
 *
 * **The charge is the reason this is a route handler rather than a fetch from
 * the browser.** The backend token lives in an httpOnly session that page
 * JavaScript cannot read, which is the arrangement that stops any XSS on any
 * console page from spending an organisation's money.
 *
 * Idempotency is `license:{incidentId}`, hashed to the UUID the service
 * requires — so a double-clicked button, a retried request or a refresh mid-
 * flight is recognised as the same purchase rather than charged twice. That is
 * handled in `consoleApi`, where every write's key is derived the same way.
 *
 * No request body. The service is explicit that terms come from the
 * organisation's own plan and there is no client override, which is the right
 * design: a price the buyer can name is a price the buyer can change.
 */
export async function POST(_request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await context.params;

  const session = await requireSession();
  if (session.accountType !== 'organisation') {
    // Middleware already gates the page; this guards the endpoint itself,
    // which is reachable directly.
    return NextResponse.json({ error: 'This account cannot license reports.' }, { status: 403 });
  }

  try {
    return NextResponse.json({ licensed: await org.license<unknown>(incidentId) });
  } catch (cause) {
    /*
     * The service's own sentence, verbatim, and its own status.
     *
     * A general "could not license" here would hide the two answers that
     * actually differ: a report whose verification state forbids licensing, and
     * a subscription that cannot cover it. An officer needs to know which,
     * because only one of them is worth trying again.
     */
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json({ error: cause.message }, { status: cause.status || 502 });
    }
    return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
  }
}
