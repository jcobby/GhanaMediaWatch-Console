import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { ApiUnavailable } from '@/lib/apiError';
import { requireSession } from '@/lib/session';

/**
 * Acting on a report from the routing desk.
 *
 * The console's first write path. Every action button in this console — route,
 * license, approve, release a payout — was local React state: pressing
 * "Confirm and send" removed the row from the list and told the server
 * nothing, so the desk looked like it worked and a reload brought the report
 * back. An operator could believe they had routed something that had never
 * left the browser.
 *
 * One decision lives here: sending a report to named organisations.
 *
 * It used to carry a second, `publish`, which posted `{state: 'published'}` to
 * `/editorial/{id}/transition`. Both halves of that were wrong, and reading the
 * live service settled it: a platform owner is refused that endpoint outright
 * (403, even for an empty body), and `published` is not one of the states it
 * accepts — its permitted values are the eight verification states and nothing
 * else. The action could not have worked for anyone. Releasing a report to the
 * public feed has no endpoint at all; see the editorial desk's ReleasePanel.
 *
 * **`/platform/routing/{id}/recipients` publishes no request schema**, so the
 * payload below is the plausible shape and the server's own answer is returned
 * verbatim on failure. A wrong guess therefore shows up as the server's
 * validation message on screen rather than as a silent no-op, which is the only
 * way to find the real contract from out here.
 */

const schema = z.object({
  action: z.literal('route'),
  businessIds: z.array(z.string()),
});

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await context.params;

  const session = await requireSession();
  if (session.accountType !== 'platform_owner' && session.accountType !== 'editor') {
    // Middleware already gates the page; this guards the endpoint itself,
    // which is reachable directly.
    return NextResponse.json({ error: 'This account cannot route reports.' }, { status: 403 });
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: 'This session carries no credential for the service. Sign in again.' },
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
    return NextResponse.json({ error: 'Unrecognised routing action.' }, { status: 400 });
  }

  const id = encodeURIComponent(incidentId);
  const input = parsed.data;

  try {
    const result = await apiRequest<unknown>(`/platform/routing/${id}/recipients`, {
      method: 'POST',
      body: { businessIds: input.businessIds },
      token: session.accessToken,
      // The report's own id: pressing send twice must route once.
      idempotencyKey: `route:${incidentId}:${input.businessIds.sort().join(',')}`,
    });

    return NextResponse.json({ ok: true, result });
  } catch (cause) {
    /*
     * The server's own words, passed through.
     *
     * Normally this console never shows an upstream message — it leaks
     * internals and rarely helps. Here it is the point: these two endpoints
     * document no request body, so the validation error *is* the specification,
     * and hiding it behind "something went wrong" would leave whoever is
     * fixing this with nothing to go on.
     */
    const failure = cause instanceof ApiUnavailable ? cause : null;
    return NextResponse.json(
      {
        error: failure?.message ?? 'The report could not be updated.',
        code: failure?.code ?? 'INTERNAL',
        upstreamStatus: failure?.status ?? 0,
      },
      { status: failure && failure.status >= 400 ? failure.status : 502 },
    );
  }
}
