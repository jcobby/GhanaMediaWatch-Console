'use client';

import { AlertTriangle, Ban } from 'lucide-react';
import {
  NEWS_CRITERIA,
  NEWS_GATES,
  NEWS_MODIFIERS,
  SCORE_SCALE,
  criterionContributions,
  failedGates,
  leadingReasons,
} from '@dawuro/core';
import type { RoutingAssessment } from '@/lib/routingNewsValue';
import { cn } from '@/lib/cn';

/**
 * How big this story is, shown where the report is routed.
 *
 * The routing desk decides who receives a report. Until now it did that in
 * arrival order — the order the uploads happened to finish in — so the operator
 * opened each row to find out which of twenty a newsroom needed in the next ten
 * minutes. The score answers that before anything is opened.
 *
 * **It is a triage number, not an editorial judgement, and it never pretends
 * otherwise.** Five of the ten criteria cannot be evidenced from a queue row —
 * who is involved, whether this is a first, whether an audience is already
 * following it, and which audience an outlet serves — so they sit at the
 * neutral midpoint and the count of them is on the panel. The full assessment
 * belongs on the editorial desk, where somebody has actually read the report.
 *
 * **No tier is shown here, and that is the point.** "Lead story", "Top five",
 * "Inside page" are placement decisions, and a placement decision needs all ten
 * criteria. With five pinned at the midpoint every score is pulled toward 300,
 * so the tier barely moves: measured against the live queue, nine of ten
 * reports came out "Inside page" — a label that told an operator nothing and
 * claimed an editorial judgement nobody had made. The number and the ordering
 * are what this desk can honestly offer, so they are what it offers.
 */

/** The score, small enough to read as a queue position rather than a verdict. */
export function NewsValueChip({ assessment }: { assessment: RoutingAssessment | undefined }) {
  if (!assessment) return null;

  /*
   * An unread report gets no number at all.
   *
   * Its score comes entirely from defaults — `other`, `concern`, no media, no
   * fix — so showing one would rank a report nobody can see against reports
   * somebody can. The row still appears; it just makes no claim.
   */
  if (assessment.unreadable) return null;

  const failing = failedGates(assessment.gates).length > 0;

  return (
    <span
      className={cn(
        'tabular ml-auto shrink-0 rounded-pill px-1.5 text-2xs',
        failing ? 'bg-danger-wash text-danger' : 'bg-canvas-raise text-text-muted',
      )}
      title={
        failing
          ? 'Cannot be routed as it stands — see the report.'
          : `${assessment.score.score} of ${SCORE_SCALE} from the record alone. ${assessment.unassessed.length} of ${NEWS_CRITERIA.length} criteria still need an editor, so this is a triage number and not a placement.`
      }
    >
      {failing ? 'Hold' : assessment.score.score}
    </span>
  );
}

/**
 * Why this report sits where it does, in a few words.
 *
 * The number ranks the queue and explains nothing, and an operator scanning
 * twenty rows will not open each one to find out. The two criteria carrying the
 * most weight in *this* score are the shortest true answer to "why is this one
 * above that one" — and being able to answer that is the whole reason for
 * writing the criteria down rather than leaving editors to weigh it silently.
 *
 * Drawn only from criteria that were actually assessed. Naming a default
 * nobody chose would be inventing a reason, which is worse than giving none.
 */
export function NewsValueReason({ assessment }: { assessment: RoutingAssessment | undefined }) {
  if (!assessment || assessment.unreadable) return null;
  if (failedGates(assessment.gates).length > 0) return null;

  const reasons = leadingReasons(assessment.ratings, assessment.unassessed);

  /*
   * "Nothing stands out yet" is a real answer, and the honest one.
   *
   * A report with no criterion rated 4 or better is in the queue on weighting
   * rather than on merit. Printing nothing here would leave the row looking
   * identical to one whose reasons had simply not loaded, and printing its
   * biggest number — "impact 2/5" — would dress a weakness up as a
   * justification.
   */
  if (reasons.length === 0) {
    return (
      <span className="mt-1 block truncate text-2xs italic text-text-faint">
        Nothing stands out yet
      </span>
    );
  }

  return (
    <span className="mt-1 block truncate text-2xs text-text-faint">
      {reasons.map((r) => `${r.short} ${r.rating}/5`).join(' · ')}
    </span>
  );
}

/**
 * The score behind the chip, on the report an operator has opened.
 *
 * Says what went into it and what did not, because a number without either is
 * something people either over-trust or ignore, and both are worse than a
 * number with its working shown.
 */
export function NewsValueSummary({ assessment }: { assessment: RoutingAssessment | undefined }) {
  if (!assessment) return null;

  if (assessment.unreadable) {
    return (
      <div className="rounded-md border border-hairline/[0.08] bg-canvas-raise p-3.5">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          News value
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
          Not scored. This report&rsquo;s own record could not be read, so there is nothing to score
          it on — a number here would come entirely from defaults.
        </p>
      </div>
    );
  }

  const failing = failedGates(assessment.gates);

  return (
    <div className="rounded-md border border-hairline/[0.08] bg-canvas-raise p-3.5">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
        News value
      </p>

      {failing.length > 0 ? (
        <div className="mt-2 rounded-sm border border-danger/30 bg-danger-wash/40 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-danger">
            <Ban className="h-3.5 w-3.5" strokeWidth={2.5} />
            Do not route this as it stands
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
            {failing.map((id) => NEWS_GATES.find((g) => g.id === id)?.label).join(' and ')}{' '}
            {failing.length > 1 ? 'gates fail' : 'gate fails'}. The reporter marked this as needing
            redaction and none has been applied &mdash; sending it to several newsrooms now puts
            that out of our hands. No score outweighs it, so none is shown.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="tabular text-2xl font-semibold leading-none">
              {assessment.score.score}
            </span>
            <span className="text-xs text-text-faint">/ {SCORE_SCALE}</span>
          </div>
          {/*
            Deliberately no tier. "Inside page" is a placement decision and it
            needs all ten criteria; with five pinned at the midpoint the tier
            hardly moves, and it read "Inside page" on nine of ten live reports.
            The number ranks the queue, which is what this desk needs.
          */}
          <p className="mt-1 text-2xs text-text-faint">
            Ranks this against the rest of the queue. Not a placement decision.
          </p>

          {assessment.score.applied.length > 0 ? (
            <p className="mt-2 text-2xs leading-relaxed text-text-muted">
              {assessment.score.baseScore} then{' '}
              {assessment.score.applied
                .map(
                  (m) =>
                    `${m.points > 0 ? '+' : ''}${m.points} ${
                      NEWS_MODIFIERS.find((x) => x.id === m.id)?.label.toLowerCase() ?? ''
                    }`,
                )
                .join(', ')}
              .
            </p>
          ) : null}

          {assessment.region ? (
            <p className="mt-1 text-2xs leading-relaxed text-text-faint">
              Nearest regional capital is {assessment.region.capital}, {assessment.region.name} — a
              guess from the coordinates, not a boundary lookup.
            </p>
          ) : null}

          {/*
            The working, criterion by criterion.

            A ranked queue that shows only a total ranks reports by a number
            nobody can argue with, which is the opposite of what writing the
            criteria down was for. An operator who disagrees that one report
            outranks another can now see which criterion did it — and the five
            the platform cannot evidence are greyed and labelled rather than
            hidden, because a 3 nobody chose looks exactly like a 3 somebody did.
          */}
          <Breakdown assessment={assessment} />
        </>
      )}

      {/*
        The honest half, and it stays visible even when a gate is failing.

        Half the model needs somebody who has read the report. A screen that
        showed the number without this would be presenting a placeholder as a
        judgement — and this desk is where a report gets sent to newsrooms, so
        an inflated impression of it travels.
      */}
      <p className="mt-2.5 flex items-start gap-2 text-2xs leading-relaxed text-text-muted">
        <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-warning" strokeWidth={2.5} />
        <span>
          Triage only. {assessment.unassessed.length} of {NEWS_CRITERIA.length} criteria &mdash;{' '}
          {assessment.unassessed
            .map((id) => NEWS_CRITERIA.find((c) => c.id === id)?.label.toLowerCase())
            .filter(Boolean)
            .join(', ')}{' '}
          &mdash; need somebody who has read the report, and are held at the midpoint here. The full
          assessment is on the editorial desk.
        </span>
      </p>
    </div>
  );
}

/**
 * Every criterion, what it was rated, and what it contributed.
 *
 * Ordered by contribution rather than by the criteria's own order, so the
 * reason a report ranks where it does reads off the top of the list instead of
 * having to be reconstructed from ten rows.
 *
 * The bar is the point of the table. Ten numbers in a column are read as ten
 * numbers; ten bars are read as a shape, and the shape is what tells an
 * operator at a glance that this report is here on impact rather than on
 * pictures. Widths are relative to the largest contribution present, not to the
 * theoretical maximum, because every bar being a third full teaches nothing.
 *
 * Weights are shown because they are the argument. "Visual strength ×5" says,
 * without a sentence, that strong footage is worth a quarter of national impact
 * on this platform — which is a deliberate editorial position and one somebody
 * should be able to disagree with.
 */
function Breakdown({ assessment }: { assessment: RoutingAssessment }) {
  const rows = criterionContributions(assessment.ratings, assessment.unassessed);
  const largest = Math.max(...rows.map((r) => r.points), 1);

  return (
    <details className="group mt-3 border-t border-hairline/[0.07] pt-2.5">
      <summary className="cursor-pointer list-none text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint hover:text-text-muted">
        How this was scored
        <span className="ml-1.5 font-normal normal-case tracking-normal group-open:hidden">
          — show the working
        </span>
      </summary>

      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-2">
            <span
              className={cn(
                'w-[9.5rem] shrink-0 truncate text-2xs',
                row.unassessed ? 'text-text-faint' : 'text-text-secondary',
              )}
              title={NEWS_CRITERIA.find((c) => c.id === row.id)?.fiveLooksLike}
            >
              {row.label}
            </span>

            <span className="tabular w-8 shrink-0 text-right text-2xs text-text-faint">
              {row.rating}/5
            </span>
            <span className="tabular w-7 shrink-0 text-right text-2xs text-text-faint">
              ×{row.weight}
            </span>

            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-canvas-raise">
              <span
                className={cn(
                  'block h-full rounded-pill',
                  row.unassessed ? 'bg-hairline/25' : 'bg-accent/70',
                )}
                style={{ width: `${Math.round((row.points / largest) * 100)}%` }}
              />
            </span>

            <span
              className={cn(
                'tabular w-7 shrink-0 text-right text-2xs',
                row.unassessed ? 'text-text-faint' : 'text-text-secondary',
              )}
            >
              {row.points}
            </span>
          </li>
        ))}
      </ul>

      {/*
        The two rules that are not points, named even where they do not apply.

        An operator who only ever sees them fire will not know they exist, and
        the ownership check in particular is a process obligation rather than
        something the score can express.
      */}
      <p className="mt-2.5 text-2xs leading-relaxed text-text-faint">
        Grey rows are not rated — nobody has read this report yet, so they sit at the midpoint and
        neither help nor hurt. Two further rules never touch the score: a story involving the owner,
        an advertiser or an affiliated party needs a second editor, and during a campaign an
        unanswered partisan claim drops a tier. Both are applied on the editorial desk.
      </p>
    </details>
  );
}
