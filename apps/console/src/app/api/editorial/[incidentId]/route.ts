import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { ApiUnavailable } from '@/lib/apiError';
import { readSession } from '@/lib/session';

/**
 * The verification desk's one write action.
 *
 * `POST /editorial/{incidentId}/transition` — a verification judgement, with the reason kept permanently.
 *
 * It used to send nothing at all: the decision panel called `setStates`, the
 * badge changed, the history grew a row, and the platform was told nothing —
 * an editor could work through a queue of nineteen and change none of it.
 *
 * **The body is no longer a guess.** The endpoint publishes no schema, but its
 * own validation error names the field and enumerates the permitted values, and
 * that is what the union below is copied from. The server's message is still
 * returned verbatim on failure, because it remains the only specification for
 * anything this does not yet cover.
 */

/**
 * The states the server will accept, verbatim.
 *
 * Read from its own validation error rather than guessed:
 *
 *   expected: 'received_unreviewed' | 'integrity_passed' | 'integrity_flagged'
 *           | 'corroboration_in_progress' | 'verified_high_confidence'
 *           | 'verified_in_part' | 'disputed' | 'rejected'
 *
 * Note what is absent: `published`. This endpoint moves a report through
 * review and cannot put it in front of anybody, which is why the release
 * control is an explanation rather than a button. See ReleasePanel.
 */
const decideSchema = z.object({
  action: z.literal('decide'),
  to: z.enum([
    'received_unreviewed',
    'integrity_passed',
    'integrity_flagged',
    'corroboration_in_progress',
    'verified_high_confidence',
    'verified_in_part',
    'disputed',
    'rejected',
  ]),
  /*
   * Required here even though the server tolerates its absence. A verification
   * decision with no recorded reason is not reviewable later, and these decide
   * what may be called verified.
   */
  reason: z.string().trim().min(1, 'Record why. The decision is kept permanently.'),
  /**
   * Which desk it runs on, when this decision publishes it.
   *
   * The server defaults to `ghana`. Sending it explicitly is what lets an
   * editor put a report on Africa or Organisation rather than discovering
   * afterwards that everything lands on one desk.
   */
  section: z.enum(['ghana', 'africa', 'world', 'business', 'politics', 'sport']).optional(),
});

/**
 * One corroboration check, recorded against the report.
 *
 * **This is the gate.** A transition to `verified_high_confidence` is refused
 * with `Corroboration gate failed: insufficient_corroboration` until enough of
 * these have been recorded — and the console's checklist was React state, so
 * ticking every box on screen sent nothing and the gate could never be
 * satisfied. An editor could complete the whole checklist and still be told
 * there was not enough corroboration, with no way to see why.
 *
 * The shape is the server's own, read from its validation error:
 * `{source, weight, passed, independent}`. It matches `CorroborationCheck` in
 * `@dawuro/core` field for field, so the weights below are the shared ones
 * rather than numbers invented here.
 */
const corroborateSchema = z.object({
  action: z.literal('corroborate'),
  source: z.string().min(1),
  weight: z.number().int().min(0).max(100),
  passed: z.boolean(),
  independent: z.boolean(),
});

/** What `POST /editorial/{id}/transition` answers with, as published. */
interface TransitionResult {
  incidentId?: string;
  state?: string;
  published?: boolean;
  publishedAt?: string | null;
  vettingState?: 'pending_review' | 'published' | 'rejected' | 'restricted';
  section?: string | null;
  destination?: string;
  permittedRepresentation?: string;
  auditHash?: string;
}

const schema = z.discriminatedUnion('action', [decideSchema, corroborateSchema]);

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  }

  /*
   * Checked here, not only in middleware.
   *
   * Middleware gates the page by URL prefix; this endpoint is reachable
   * directly. Publishing a report puts somebody's footage in front of every
   * user of the app, and that is not gated by a redirect rule.
   *
   * A platform owner is included because the console lets one reach editorial
   * work, but note the server has the final say and refuses them on this
   * endpoint — which is why the routing desk no longer offers a release button.
   */
  if (session.accountType !== 'editor' && session.accountType !== 'platform_owner') {
    return NextResponse.json({ error: 'Only the verification desk can do that.' }, { status: 403 });
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
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? 'Unrecognised action.' }, { status: 400 });
  }

  const { incidentId } = await context.params;
  const input = parsed.data;

  const encoded = encodeURIComponent(incidentId);

  if (input.action === 'corroborate') {
    try {
      const result = await apiRequest<unknown>(`/editorial/${encoded}/corroboration`, {
        method: 'POST',
        body: {
          source: input.source,
          weight: input.weight,
          passed: input.passed,
          independent: input.independent,
        },
        token: session.accessToken,
        // Keyed on the check, so ticking a box twice records it once.
        idempotencyKey: `corroborate:${incidentId}:${input.source}:${input.passed}`,
      });
      /*
       * Recording a check moves the report's state, and the caller has to know.
       *
       * The first corroboration takes a report from `integrity_passed` to
       * `corroboration_in_progress`, and nothing in this endpoint's own answer
       * — `{incidentId, status, strength}` — says so. The desk went on offering
       * the transitions available *before* the tick, so pressing "Corroborating"
       * asked the server to move from `corroboration_in_progress` to
       * `corroboration_in_progress` and was refused: an editor doing exactly
       * the right thing, told they could not.
       *
       * One extra read, on an action taken a handful of times per report, buys
       * a screen that agrees with the platform.
       */
      let verification: string | null = null;
      try {
        const workspace = await apiRequest<{ incident?: { verification?: string } }>(
          `/editorial/${encoded}`,
          { token: session.accessToken },
        );
        verification = workspace.incident?.verification ?? null;
      } catch {
        // The check was recorded; not knowing the new state is a smaller
        // problem than reporting a failure that did not happen.
      }

      return NextResponse.json({ ok: true, result, verification });
    } catch (cause) {
      const failure = cause instanceof ApiUnavailable ? cause : null;
      return NextResponse.json(
        {
          error: failure?.message ?? 'That check could not be recorded.',
          code: failure?.code ?? 'INTERNAL',
          upstreamStatus: failure?.status ?? 0,
        },
        { status: failure && failure.status >= 400 ? failure.status : 502 },
      );
    }
  }

  try {
    /*
     * **`note`, not `reason`.**
     *
     * The published body is `{state, note?, section?}` and this sent
     * `{state, reason}` — an unknown key, accepted and dropped in silence. So
     * every verification decision an editor recorded went to the platform with
     * no reason attached, while the panel had refused to submit without one and
     * told them it was kept permanently. The decision survived; the only part
     * of it a person wrote did not.
     *
     * The console keeps calling it a reason, because that is what it is to the
     * editor typing it. The wire name is the server's.
     */
    const result = await apiRequest<TransitionResult>(
      `/editorial/${encodeURIComponent(incidentId)}/transition`,
      {
        method: 'POST',
        body: {
          state: input.to,
          note: input.reason,
          ...(input.section ? { section: input.section } : {}),
        },
        token: session.accessToken,
        /*
         * Stable, so a double-click records one decision rather than two
         * entries in a permanent history. Keyed on the target state as well as
         * the report: moving a report to `disputed` and later to `rejected` are
         * different acts and must not be collapsed into one.
         */
        idempotencyKey: `decide:${incidentId}:${input.to}`,
      },
    );

    /*
     * Whether this decision published the report, from the answer itself.
     *
     * Publishing used to be a silent side effect: the transition response said
     * nothing about it, so the desk could not tell an editor that the footage
     * they had just ruled on was now in front of every user of the app. The
     * response carries `published`, `publishedAt`, `vettingState` and `section`
     * now, and they go straight back to the screen.
     */
    return NextResponse.json({ ok: true, result });
  } catch (cause) {
    const failure = cause instanceof ApiUnavailable ? cause : null;
    return NextResponse.json(
      {
        error: failure?.message ?? 'That could not be recorded.',
        code: failure?.code ?? 'INTERNAL',
        upstreamStatus: failure?.status ?? 0,
      },
      { status: failure && failure.status >= 400 ? failure.status : 502 },
    );
  }
}
