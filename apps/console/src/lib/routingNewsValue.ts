import {
  GATES_UNANSWERED,
  deriveGates,
  provisionalAssessment,
  type NewsGateAnswers,
  type ProvisionalAssessment,
} from '@dawuro/core';
import { EMPTY_CORROBORATION } from '@dawuro/core';
import type { RoutingRow } from './normaliseRouting';

/**
 * Scoring a report as it arrives on the routing desk.
 *
 * The desk's question is who receives this, and the news value answers a piece
 * of it that was previously left to whoever opened the queue first: how big the
 * story is. Twenty rows in arrival order tell an operator nothing about which
 * one a newsroom needs in the next ten minutes.
 *
 * **Everything here is derived, and half the model cannot be.** Five of the ten
 * criteria — impact, utility, accountability, timeliness, visual strength —
 * come from fields the routing queue now carries. The other five need a person
 * who has read the report: who is involved, whether this is a first, whether an
 * audience is already following it, and which audience an outlet serves. Those
 * sit at the neutral midpoint and are reported as unassessed, so a routing score
 * is explicitly a triage number and not an editorial judgement. The full
 * ten-criterion assessment stays on the editorial desk, where somebody is
 * actually reading the thing.
 *
 * **Two gates are answered, and only two.** Verification and harm come off the
 * record. Legal exposure and the public interest test are judgements about the
 * world that no routing operator is being asked to make here, and a model that
 * pre-filled them would be inventing a legal opinion.
 */

export interface RoutingAssessment extends ProvisionalAssessment {
  gates: NewsGateAnswers;
  /**
   * Nothing about this report could be read, so the score is meaningless.
   *
   * Kept as a flag rather than by omitting the score: the desk shows a row for
   * it either way, and a tier computed entirely from defaults — `other`,
   * `concern`, no media, no fix — would rank a report nobody has seen against
   * reports that were actually read.
   */
  unreadable: boolean;
}

/**
 * The score for one queued report.
 *
 * `nowIso` is passed in rather than read here so every row in a render is
 * measured against the same instant. Scoring each against its own `Date.now()`
 * would let two reports filmed a second apart fall into different freshness
 * buckets depending on the order they were mapped in.
 */
export function assessRoutingRow(row: RoutingRow, nowIso: string): RoutingAssessment {
  const assessment = provisionalAssessment({
    category: row.category,
    // `RoutingItem` has no severity and the server sends one. Absent means the
    // reporter's own claim about urgency is unknown, not that it is low.
    severity: row.severity ?? 'concern',
    /*
     * `mediaKind` is the desk's own narrower field — a still or a clip — and it
     * is null when the server sent no media at all. Audio is not among its
     * values, so a voice report reaching this desk reads as a photo; that is a
     * one-point difference on the lightest-weighted criterion, and inventing a
     * fourth value the normaliser never produces would be worse.
     */
    mediaKind: row.mediaKind === 'video' ? 'video' : 'photo',
    // No assurance stated is not Class A. `C` is "origin not technically
    // verified", which is the honest reading of silence and the one that does
    // not hand an unread report the provenance bonus.
    assurance: row.assurance ?? 'C',
    /*
     * The *stated* destination, never the normaliser's `marketplace` default.
     * The routing queue sends no destination, so using the default would award
     * every single row the exclusivity point for a choice nobody made.
     */
    destination: row.destinationStated ?? null,
    /*
     * The file's own weight, so footage that does not exist cannot be rated
     * as strong. A 4 KB upload recorded as `kind: video, assurance: A` scored
     * 5 out of 5 for footage while the frame beside it said it was unplayable.
     */
    mediaByteSize: row.mediaByteSize ?? null,
    capturedAtIso: row.capturedAtIso || null,
    nowIso,
    location: row.location ?? { latitude: null, longitude: null },
    // Corroboration is editorial work and has not started at this desk. Empty
    // is the truth, and it is what makes the rumour-decay modifier apply.
    corroboration: EMPTY_CORROBORATION,
  });

  const gates = row.handling
    ? deriveGates({
        corroboration: EMPTY_CORROBORATION,
        handling: row.handling,
        /*
         * Nothing has been redacted at routing time — redaction is recorded on
         * an editorial case, and no case exists yet. So footage the reporter
         * said contains children fails the harm gate here, which is the right
         * answer for a desk about to send it to several newsrooms.
         */
        redactionApplied: false,
      })
    : GATES_UNANSWERED;

  return { ...assessment, gates, unreadable: row.contentUnavailable === true };
}

/**
 * The queue, biggest story first.
 *
 * Sorted rather than left in arrival order, which is what it was. Arrival order
 * is not a priority — it is the order the uploads finished in — and a desk that
 * shows twenty rows in it makes the operator open each one to find out which
 * matters. Ties fall back to capture time so the ordering is stable and, among
 * equals, the older report is not left behind.
 *
 * Reports whose record could not be read sink to the bottom regardless of the
 * number their defaults produce. They still need attention, but ranking an
 * unread report above one somebody can actually see would be ranking on nothing.
 */
export function byNewsValue(
  rows: RoutingRow[],
  nowIso: string,
): { row: RoutingRow; assessment: RoutingAssessment }[] {
  return rows
    .map((row) => ({ row, assessment: assessRoutingRow(row, nowIso) }))
    .sort((a, b) => {
      if (a.assessment.unreadable !== b.assessment.unreadable) {
        return a.assessment.unreadable ? 1 : -1;
      }
      const byScore = b.assessment.score.score - a.assessment.score.score;
      if (byScore !== 0) return byScore;
      return (b.row.capturedAtIso || '').localeCompare(a.row.capturedAtIso || '');
    });
}
