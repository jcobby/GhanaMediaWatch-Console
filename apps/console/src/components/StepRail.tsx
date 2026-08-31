'use client';

import { Check, X } from 'lucide-react';
import {
  ONBOARDING_STEPS,
  stepState,
  type OnboardingApplication,
  type OnboardingStepId,
} from '@dawuro/core';
import { cn } from '@/lib/cn';

/**
 * The step list beside an onboarding wizard.
 *
 * Shows the whole journey at once, not just where you are. Someone deciding
 * whether to start gathering documents needs to see that there are six steps
 * and what they are — a wizard that reveals its length one screen at a time
 * gets abandoned at step three.
 *
 * A rejected step is marked in red and stays clickable. It is the one thing on
 * this screen the applicant must act on, so it must never look finished.
 */
export function StepRail({
  application,
  current,
  onSelect,
}: {
  application: OnboardingApplication;
  current: OnboardingStepId | 'review';
  onSelect: (id: OnboardingStepId | 'review') => void;
}) {
  const done = ONBOARDING_STEPS.filter((meta) => {
    const status = stepState(application, meta.id).status;
    return status === 'submitted' || status === 'approved';
  }).length;

  const total = ONBOARDING_STEPS.length;
  const pct = Math.round((done / total) * 100);

  return (
    <nav aria-label="Onboarding steps" className="w-full">
      <p className="text-2xs text-text-muted">
        <span className="tabular font-medium text-text-primary">{done}</span> of {total} complete
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-pill bg-canvas-raise">
        <div
          className="h-full rounded-pill bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* A column beside the form on a wide screen, a wrapping row above it on
          a narrow one. Seven full-width rows stacked vertically would push the
          form itself below the fold on a laptop. */}
      <ol className="mt-4 flex flex-wrap gap-1 lg:block lg:space-y-0.5">
        {ONBOARDING_STEPS.map((meta, index) => {
          const state = stepState(application, meta.id);
          const active = current === meta.id;
          const finished = state.status === 'submitted' || state.status === 'approved';
          const rejected = state.status === 'rejected';

          return (
            <li key={meta.id} className="lg:w-full">
              <button
                type="button"
                onClick={() => onSelect(meta.id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-xs transition',
                  active
                    ? 'bg-canvas-soft font-medium shadow-sm'
                    : 'bg-canvas-raise/40 hover:bg-canvas-soft/60 lg:bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-2xs font-semibold',
                    rejected
                      ? 'bg-danger text-text-on-dark'
                      : finished
                        ? 'bg-success text-text-on-dark'
                        : active
                          ? 'bg-accent text-text-on-dark'
                          : 'bg-canvas-raise text-text-faint',
                  )}
                >
                  {rejected ? (
                    <X className="h-3 w-3" strokeWidth={3} />
                  ) : finished ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    'flex-1 whitespace-nowrap lg:truncate',
                    rejected ? 'text-danger' : finished ? 'text-text-muted' : 'text-text-primary',
                  )}
                >
                  {meta.label}
                </span>
              </button>
            </li>
          );
        })}

        <li className="lg:w-full">
          <button
            type="button"
            onClick={() => onSelect('review')}
            aria-current={current === 'review' ? 'step' : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-xs transition',
              current === 'review'
                ? 'bg-canvas-soft font-medium shadow-sm'
                : 'bg-canvas-raise/40 hover:bg-canvas-soft/60 lg:bg-transparent',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-2xs font-semibold',
                current === 'review'
                  ? 'bg-accent text-text-on-dark'
                  : 'bg-canvas-raise text-text-faint',
              )}
            >
              {total + 1}
            </span>
            <span className="flex-1 whitespace-nowrap lg:truncate">Review &amp; submit</span>
          </button>
        </li>
      </ol>
    </nav>
  );
}
