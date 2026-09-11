import { NextResponse } from 'next/server';
import { apiRequest } from '@/lib/api';
import { ApiUnavailable } from '@/lib/apiError';
import { readSession } from '@/lib/session';

/**
 * An editor's own news-value assessment, stored.
 *
 * **This is the endpoint the panel spent its life apologising for.** Ten
 * ratings, four gates, the modifiers and the two rules were React state and
 * nothing else: gone on reload, invisible to colleagues, and the panel said so
 * in a permanent amber box because pretending otherwise would have been worse.
 *
 * `GET`/`PUT /editorial/{incidentId}/news-value` now exists, with the semantics
 * that were asked for and are worth restating because they shape this file:
 *
 *   - **`PUT`, and it merges.** One assessment per incident, so writing the
 *     same body twice leaves the same result. A partial body is a partial
 *     update, which is what lets a single rating save without resending nine.
 *   - **Unknown keys are refused with 400** rather than dropped, so a typo in a
 *     criterion id is an error rather than a story ranked on a number nobody
 *     sent.
 *   - **`If-Match: <version>` gives 409 on a conflict.** Two editors on one
 *     report is an ordinary Monday, and a silent overwrite is how a failed harm
 *     gate gets flipped back to `pass` by somebody who never saw it.
 *   - **It does not touch publication.** Storing `harm: "fail"` cannot block a
 *     transition; the gate on publishing is corroboration and stays there.
 *
 * Access is checked here as well as in middleware, for the same reason the
 * transition route does it: middleware gates a page by URL prefix, and this
 * endpoint is reachable directly.
 */

/** Who the platform will accept an assessment from. Mirrored from its own rule. */
function mayAssess(accountType: string | undefined): boolean {
  return accountType === 'editor' || accountType === 'platform_owner';
}

async function guard() {
  const session = await readSession();
  if (!session) return { error: NextResponse.json({ error: 'Sign in again.' }, { status: 401 }) };
  if (!mayAssess(session.accountType)) {
    return {
      error: NextResponse.json(
        { error: 'Only the verification desk can assess news value.' },
        { status: 403 },
      ),
    };
  }
  if (!session.accessToken) {
    return {
      error: NextResponse.json(
        { error: 'This session carries no backend credential. Sign in again.' },
        { status: 401 },
      ),
    };
  }
  return { token: session.accessToken };
}

export async function GET(_request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const gate = await guard();
  if (gate.error) return gate.error;

  const { incidentId } = await context.params;

  try {
    const stored = await apiRequest<unknown>(
      `/editorial/${encodeURIComponent(incidentId)}/news-value`,
      { token: gate.token },
    );
    return NextResponse.json({ ok: true, assessment: stored });
  } catch (cause) {
    /*
     * A 404 is an answer, not a failure: nobody has assessed this report yet.
     * The panel then opens on what the record implies, which is the whole
     * reason the two are kept apart — see `AutomaticScorePanel`.
     */
    if (cause instanceof ApiUnavailable && cause.status === 404) {
      return NextResponse.json({ ok: true, assessment: null });
    }
    const failure = cause instanceof ApiUnavailable ? cause : null;
    return NextResponse.json(
      { error: failure?.message ?? 'That assessment could not be read.' },
      { status: failure && failure.status >= 400 ? failure.status : 502 },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const gate = await guard();
  if (gate.error) return gate.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  /*
   * The version travels in a header upstream and in the body from the browser,
   * because a `fetch` from a client component is easier to keep honest with one
   * JSON object than with a header the caller has to remember.
   */
  const { version, ...assessment } = (body ?? {}) as Record<string, unknown> & { version?: number };

  const { incidentId } = await context.params;

  try {
    const saved = await apiRequest<unknown>(
      `/editorial/${encodeURIComponent(incidentId)}/news-value`,
      {
        method: 'PUT',
        body: assessment,
        token: gate.token,
        ...(typeof version === 'number' ? { headers: { 'If-Match': String(version) } } : {}),
      },
    );
    return NextResponse.json({ ok: true, assessment: saved });
  } catch (cause) {
    const failure = cause instanceof ApiUnavailable ? cause : null;

    /*
     * A conflict is somebody else's work, and it is the one failure here the
     * editor has to be told about in their own words. Overwriting silently is
     * the behaviour `If-Match` exists to prevent.
     */
    if (failure?.status === 409) {
      return NextResponse.json(
        {
          error:
            'Somebody else has assessed this report since you opened it. Reload to see theirs before saving yours.',
          conflict: true,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: failure?.message ?? 'That assessment could not be saved.',
        upstreamStatus: failure?.status ?? 0,
      },
      { status: failure && failure.status >= 400 ? failure.status : 502 },
    );
  }
}
