'use client';

import { Lock } from 'lucide-react';
import {
  NEWS_CRITERIA,
  NEWS_MODIFIERS,
  NEWS_TIER_META,
  SCORE_SCALE,
  criterionContributions,
  type GhanaRegion,
  type ProvisionalAssessment,
} from '@dawuro/core';
import { Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The machine's score, and only the machine's.
 *
 * Every report is scored the moment it lands, from things the platform already
 * knows — severity, category, age, destination, the file itself, where it was
 * filmed, what corroboration is recorded. That number orders the intake queue.
 *
 * **It used to appear as one clause inside the editor's own panel** — "Arrived
 * at 412 from the record alone" — sharing a heading, a border and a score with
 * the ratings a person had just typed. Two different kinds of claim, presented
 * as one. An editor could not point at the derived number without also pointing
 * at their own, and nobody reading over their shoulder could tell which of the
 * two the desk had actually decided.
 *
 * So it is its own panel, beside the editor's, and it is **read only by
 * construction**: this component takes no `onChange` and renders no control.
 * Nothing an editor does here can change it, because there is nothing to do.
 *
 * **What it cannot judge, it says.** Five of the ten criteria need a person —
 * originality, continuity, and the rest have no evidence in a record — and they
 * sit at the neutral midpoint. They are listed as unrated rather than folded
 * silently into the total, because a score that hides its own guesses is the
 * one thing worse than no score.
 */
export function AutomaticScorePanel({
  assessment,
  region,
}: {
  assessment: ProvisionalAssessment;
  /** Guessed from the coordinates, so it is shown as a guess. */
  region: GhanaRegion | null;
}) {
  const { score } = assessment;
  const tier = NEWS_TIER_META[score.tier];
  const contributions = criterionContributions(assessment.ratings, assessment.unassessed);
  const derived = contributions.filter((c) => !c.unassessed);
  const unrated = contributions.filter((c) => c.unassessed);

  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          Automatic
        </p>
        <span className="flex items-center gap-1 text-2xs text-text-faint">
          <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
          Read only
        </span>
      </div>

      <p className="tabular mt-3 text-3xl font-semibold leading-none">
        {score.score}
        <span className="ml-1 text-sm font-normal text-text-faint">/ {SCORE_SCALE}</span>
      </p>
      <p className="mt-1.5 text-xs font-medium text-text-secondary">{tier.label}</p>
      <p className="text-2xs text-text-faint">{tier.placement}</p>

      <p className="mt-2.5 text-2xs leading-relaxed text-text-muted">
        From the record alone, before anybody opened it. This orders the queue; it does not decide
        the bulletin.
      </p>

      {/* ── what it could work out ───────────────────────────────────────── */}
      <div className="mt-3.5 border-t border-hairline/[0.07] pt-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          Worked out from the record
        </p>
        <ul className="mt-1.5 space-y-1">
          {derived.map((c) => (
            <li key={c.id} className="flex items-baseline gap-2 text-2xs">
              <span className="min-w-0 flex-1 truncate text-text-secondary" title={c.label}>
                {c.label}
              </span>
              <span className="tabular shrink-0 text-text-faint">×{c.weight}</span>
              <span className="tabular w-5 shrink-0 text-right font-medium">{c.rating}</span>
            </li>
          ))}
        </ul>
      </div>

      {/*
        The half a record cannot speak to, named one by one.
        A count alone ("5 of 10 not rated") tells an editor how much is missing
        and never which — so the criteria they are the only source for stay
        invisible at the moment they are being asked to supply them.
      */}
      {unrated.length > 0 ? (
        <div className="mt-3 border-t border-hairline/[0.07] pt-3">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-warning">
            Needs a person
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-text-muted">
            {unrated.length} of {NEWS_CRITERIA.length} held at the midpoint. Nothing in the record
            evidences these.
          </p>
          <ul className="mt-1.5 space-y-1">
            {unrated.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 text-2xs">
                <span className="min-w-0 flex-1 truncate text-warning" title={c.label}>
                  {c.label}
                </span>
                <span className="tabular shrink-0 text-text-faint">×{c.weight}</span>
                <span className="tabular w-5 shrink-0 text-right text-text-faint">—</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── modifiers the record implied ─────────────────────────────────── */}
      {score.applied.length > 0 ? (
        <div className="mt-3 border-t border-hairline/[0.07] pt-3">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
            Applied after
          </p>
          <ul className="mt-1.5 space-y-1">
            {score.applied.map((m) => (
              <li key={m.id} className="flex items-baseline gap-2 text-2xs">
                <span className="min-w-0 flex-1 truncate text-text-secondary">
                  {NEWS_MODIFIERS.find((x) => x.id === m.id)?.label ?? m.id}
                </span>
                <span
                  className={cn(
                    'tabular shrink-0 rounded-pill px-1.5',
                    m.points > 0 ? 'bg-success-wash text-success' : 'bg-danger-wash text-danger',
                  )}
                >
                  {m.points > 0 ? '+' : ''}
                  {m.points}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-2xs text-text-faint">
            {score.baseScore} before, {score.score} after.
          </p>
        </div>
      ) : null}

      {region ? (
        <p className="mt-3 border-t border-hairline/[0.07] pt-3 text-2xs leading-relaxed text-text-faint">
          Nearest regional capital is {region.capital}, {region.name} — a guess from the
          coordinates, not a boundary lookup.
        </p>
      ) : null}
    </Panel>
  );
}
