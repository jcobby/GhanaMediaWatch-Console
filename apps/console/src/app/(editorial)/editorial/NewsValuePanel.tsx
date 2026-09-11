'use client';

import { AlertTriangle, Ban, Check, Minus, ShieldQuestion } from 'lucide-react';
import {
  NEWS_CRITERIA,
  NEWS_GATES,
  NEWS_MODIFIERS,
  NEWS_TIER_META,
  SCORE_SCALE,
  applyElectionFairness,
  failedGates,
  needsSecondEditor,
  passesAllGates,
  scoreNews,
  unansweredGates,
  type GateVerdict,
  type GhanaRegion,
  type NewsCriterionId,
  type NewsGateAnswers,
  type NewsGateId,
  type NewsModifierFlags,
  type NewsModifierId,
  type NewsRatings,
  type Rating,
} from '@dawuro/core';
import { Panel } from '@/components/ui';
import type { SaveState } from './useStoredNewsValue';
import { cn } from '@/lib/cn';

export interface NewsValueState {
  gates: NewsGateAnswers;
  ratings: NewsRatings;
  modifiers: NewsModifierFlags;
  unassessed: NewsCriterionId[];
  election: { inCampaignPeriod: boolean; partisanClaim: boolean; hasSameCycleResponse: boolean };
  ownership: {
    involvesOwner: boolean;
    involvesAdvertiser: boolean;
    involvesAffiliatedParty: boolean;
  };
}

/**
 * What makes this a top story, argued rather than asserted.
 *
 * Every report arriving on this desk is scored from the record before anybody
 * opens it — severity, category, age, destination, the file itself and where it
 * was filmed are all things the platform knows. That number orders the queue.
 * It is not an editorial judgement and this panel never lets it pretend to be:
 * the five criteria nothing in the data speaks to are shown as unrated, in
 * amber, with a count at the top.
 *
 * **Gates come before the score, and suppress it.** An unverified, unlawful or
 * harmful report is not a low-scoring top story — it is not a top story. The
 * score is hidden entirely while a gate is failing, because a number sitting
 * beside a failed harm check invites somebody to argue that 412 outweighs a
 * child's identity, and that argument should not be available to start.
 *
 * **The two rules are not points.** An ownership conflict does not lower a
 * score — discounting would bury exactly the stories an outlet is least willing
 * to run about itself. It requires a second editor. And during a campaign an
 * unanswered partisan claim drops a tier, applied identically whichever party
 * it favours.
 */
export function NewsValuePanel({
  state,
  region,
  provisionalScore,
  saveState,
  onChange,
}: {
  state: NewsValueState;
  /** Guessed from the coordinates, so it can be shown as a guess. */
  region: GhanaRegion | null;
  /** The score the report arrived with, for comparison once an editor rates it. */
  provisionalScore: number;
  /** Whether this assessment has reached the service. See `useStoredNewsValue`. */
  saveState: SaveState;
  onChange: (next: NewsValueState) => void;
}) {
  const scored = scoreNews(state.ratings, state.modifiers, state.unassessed);
  const result = applyElectionFairness(scored, state.election);
  const eligible = passesAllGates(state.gates);
  const failed = failedGates(state.gates);
  const unanswered = unansweredGates(state.gates);
  const secondEditor = needsSecondEditor(state.ownership);
  const demoted = result.tier !== scored.tier;
  const tier = NEWS_TIER_META[result.tier];

  const set = (patch: Partial<NewsValueState>) => onChange({ ...state, ...patch });

  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        {/*
          Named for whose judgement it is.
          It read "News value" while sitting beside a derived score under the
          same words — two different kinds of claim wearing one heading.
        */}
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          Editor&rsquo;s assessment
        </p>
        {state.unassessed.length > 0 ? (
          <span className="text-2xs text-warning">
            {state.unassessed.length} of {NEWS_CRITERIA.length} not rated yet
          </span>
        ) : (
          <span className="text-2xs text-text-faint">All ten rated</span>
        )}
      </div>

      {/* ── the answer ─────────────────────────────────────────────────── */}
      {failed.length > 0 ? (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger-wash/40 p-3.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-danger">
            <Ban className="h-3.5 w-3.5" strokeWidth={2.5} />
            Not eligible to be a top story
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
            {failed.map((id) => NEWS_GATES.find((g) => g.id === id)?.label).join(' and ')}{' '}
            {failed.length > 1 ? 'gates are' : 'gate is'} failing. There is no score to weigh
            against that, so none is shown.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-end gap-4">
          <div>
            <p className="tabular text-3xl font-semibold leading-none">
              {result.score}
              <span className="ml-1 text-sm font-normal text-text-faint">/ {SCORE_SCALE}</span>
            </p>
            <p className="mt-1.5 text-xs font-medium text-text-secondary">{tier.label}</p>
            <p className="text-2xs text-text-faint">{tier.placement}</p>
          </div>

          <div className="min-w-0 flex-1 space-y-1 text-2xs text-text-muted">
            {/*
              The gap between the two panels, stated as a number.

              The automatic score is beside this one in full, so repeating it
              here would be the third place the same figure appears. What is not
              visible from either panel alone is the *distance* — an editor who
              rates ten criteria and lands eighty points below where the report
              arrived has learned something about how the queue is ordering
              itself, and that is exactly what a side-by-side pair hides.
            */}
            <p>
              {result.score === provisionalScore ? (
                'Level with the automatic score.'
              ) : (
                <>
                  <span
                    className={cn(
                      'tabular font-medium',
                      result.score > provisionalScore ? 'text-success' : 'text-warning',
                    )}
                  >
                    {result.score > provisionalScore ? '+' : ''}
                    {result.score - provisionalScore}
                  </span>{' '}
                  against the automatic score.
                </>
              )}
            </p>
            {result.applied.length > 0 ? (
              <p>
                {result.baseScore} then{' '}
                {result.applied
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
            {unanswered.length > 0 ? (
              <p className="text-warning">
                {unanswered.length} gate{unanswered.length > 1 ? 's' : ''} still unanswered — this
                cannot run until {unanswered.length > 1 ? 'they are' : 'it is'} cleared.
              </p>
            ) : eligible ? (
              <p className="text-success">All four gates cleared.</p>
            ) : null}
          </div>
        </div>
      )}

      {demoted ? (
        <p className="mt-3 flex items-start gap-2 rounded-sm bg-warning-wash/50 px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-warning" strokeWidth={2.5} />
          <span>
            Dropped a tier: a partisan claim during a campaign with no response from the other side
            in the same cycle. The score is untouched — get the response and it goes back.
          </span>
        </p>
      ) : null}

      {secondEditor ? (
        <p className="mt-2 flex items-start gap-2 rounded-sm bg-info-wash/50 px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
          <ShieldQuestion className="mt-px h-3 w-3 shrink-0 text-info" strokeWidth={2.5} />
          <span>
            A second editor signs this off. It involves the owner, an advertiser or an affiliated
            party — the score is not adjusted for that, the process is.
          </span>
        </p>
      ) : null}

      {/* ── Stage 1 ────────────────────────────────────────────────────── */}
      <Section title="Gates" hint="Pass all four, or it is not a top story at all.">
        <ul className="space-y-1.5">
          {NEWS_GATES.map((gate) => (
            <li key={gate.id} className="rounded-sm px-2 py-1.5 hover:bg-canvas-raise/40">
              <div className="flex items-start gap-2.5">
                <GateControl
                  verdict={state.gates[gate.id]}
                  onSet={(verdict) =>
                    set({ gates: { ...state.gates, [gate.id]: verdict } as NewsGateAnswers })
                  }
                  label={gate.label}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{gate.label}</p>
                  <p className="mt-px text-2xs leading-relaxed text-text-muted">{gate.question}</p>
                  <p className="mt-px text-2xs italic text-text-faint">{gate.because}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Stage 2 ────────────────────────────────────────────────────── */}
      <Section title="Rating" hint="1 is weakest, 5 is strongest. The weight is in the middle.">
        <ul className="space-y-0.5">
          {NEWS_CRITERIA.map((criterion) => {
            const unrated = state.unassessed.includes(criterion.id);
            return (
              <li
                key={criterion.id}
                className="flex items-center gap-3 rounded-sm px-2 py-1.5 hover:bg-canvas-raise/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={criterion.fiveLooksLike}>
                    {criterion.label}
                  </p>
                  <p className="mt-px truncate text-2xs text-text-faint">
                    {unrated ? 'Not rated — needs a person' : criterion.fiveLooksLike}
                  </p>
                </div>
                <span className="tabular w-6 shrink-0 text-right text-2xs text-text-faint">
                  ×{criterion.weight}
                </span>
                <RatingPicker
                  value={state.ratings[criterion.id]}
                  unrated={unrated}
                  label={criterion.label}
                  onPick={(value) =>
                    set({
                      ratings: { ...state.ratings, [criterion.id]: value },
                      unassessed: state.unassessed.filter((id) => id !== criterion.id),
                    })
                  }
                />
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ── Stage 3 ────────────────────────────────────────────────────── */}
      <Section title="Ghana modifiers" hint="Corrections to known distortions, applied after.">
        <ul className="space-y-1">
          {NEWS_MODIFIERS.map((modifier) => (
            <li key={modifier.id}>
              <Toggle
                on={state.modifiers[modifier.id]}
                onToggle={() =>
                  set({
                    modifiers: {
                      ...state.modifiers,
                      [modifier.id]: !state.modifiers[modifier.id],
                    } as NewsModifierFlags,
                  })
                }
                label={modifier.label}
                points={modifier.points}
                why={
                  modifier.id === 'regional_balance' && region
                    ? `${modifier.why} Nearest regional capital is ${region.capital}, ${region.name}.`
                    : modifier.why
                }
              />
            </li>
          ))}
        </ul>
        {region ? (
          <p className="mt-2 px-2 text-2xs leading-relaxed text-text-faint">
            {region.name} is a guess from the coordinates — nearest regional capital, not a boundary
            lookup. Correct it with the toggle if it is wrong.
          </p>
        ) : null}
      </Section>

      {/* ── the two rules ──────────────────────────────────────────────── */}
      <Section title="Rules" hint="Neither of these changes the score.">
        <ul className="space-y-1">
          <li>
            <Toggle
              on={state.election.inCampaignPeriod}
              onToggle={() =>
                set({
                  election: {
                    ...state.election,
                    inCampaignPeriod: !state.election.inCampaignPeriod,
                  },
                })
              }
              label="Campaign period"
              why="Set by the newsroom, not by the calendar."
            />
          </li>
          {state.election.inCampaignPeriod ? (
            <>
              <li className="pl-5">
                <Toggle
                  on={state.election.partisanClaim}
                  onToggle={() =>
                    set({
                      election: { ...state.election, partisanClaim: !state.election.partisanClaim },
                    })
                  }
                  label="Carries a partisan claim"
                  why="Applies to the NPP and the NDC identically."
                />
              </li>
              <li className="pl-5">
                <Toggle
                  on={state.election.hasSameCycleResponse}
                  onToggle={() =>
                    set({
                      election: {
                        ...state.election,
                        hasSameCycleResponse: !state.election.hasSameCycleResponse,
                      },
                    })
                  }
                  label="Other side has responded this cycle"
                  why="Without this, anything above the top-five floor drops a tier."
                />
              </li>
            </>
          ) : null}
          <li>
            <Toggle
              on={state.ownership.involvesOwner}
              onToggle={() =>
                set({
                  ownership: { ...state.ownership, involvesOwner: !state.ownership.involvesOwner },
                })
              }
              label="Involves the owner"
              why="Requires a second editor's sign-off."
            />
          </li>
          <li>
            <Toggle
              on={state.ownership.involvesAdvertiser}
              onToggle={() =>
                set({
                  ownership: {
                    ...state.ownership,
                    involvesAdvertiser: !state.ownership.involvesAdvertiser,
                  },
                })
              }
              label="Involves an advertiser"
              why="Requires a second editor's sign-off."
            />
          </li>
          <li>
            <Toggle
              on={state.ownership.involvesAffiliatedParty}
              onToggle={() =>
                set({
                  ownership: {
                    ...state.ownership,
                    involvesAffiliatedParty: !state.ownership.involvesAffiliatedParty,
                  },
                })
              }
              label="Involves an affiliated party"
              why="Requires a second editor's sign-off."
            />
          </li>
        </ul>
      </Section>

      {/*
        What became of this assessment, said plainly.

        For as long as this panel existed it carried a permanent amber box
        admitting that ten ratings would be gone on reload and no colleague
        would ever see them. `PUT /editorial/{id}/news-value` exists now, so
        the box is replaced by the only thing an editor needs from it: whether
        their judgement is on the record.

        A conflict is the case worth spelling out. Two editors on one report is
        an ordinary Monday, and `If-Match` turning that into a refusal is the
        point — the alternative is one of them silently losing the other's work,
        including a harm gate somebody set to fail.
      */}
      <SaveNotice state={saveState} />
    </Panel>
  );
}

/**
 * Whether this editor's judgement is on the record.
 *
 * Replaces the amber box that used to sit here permanently, saying the
 * assessment was not saved and no colleague could see it. That was honest for
 * as long as there was no endpoint; it is not the sentence to leave on screen
 * now that there is one.
 *
 * Silent while idle. A line that says "saved" about work nobody has done yet
 * is noise, and a panel of ten controls does not need a status bar until
 * something has happened to report.
 */
function SaveNotice({ state }: { state: SaveState }) {
  if (state.status === 'idle' || state.status === 'loading') return null;

  if (state.status === 'conflict' || state.status === 'failed') {
    return (
      <p
        role="status"
        className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-wash p-3 text-2xs leading-relaxed text-text-secondary"
      >
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={2} />
        <span>
          <span className="font-semibold text-text-primary">
            {state.status === 'conflict' ? 'Not saved — somebody got there first.' : 'Not saved.'}
          </span>{' '}
          {state.message}
        </span>
      </p>
    );
  }

  return (
    <p role="status" className="mt-4 flex items-center gap-1.5 text-2xs text-text-faint">
      {state.status === 'saving' ? (
        'Saving…'
      ) : (
        <>
          <Check className="h-3 w-3 text-success" strokeWidth={3} />
          Saved. Colleagues on this report see it.
        </>
      )}
    </p>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-hairline/[0.07] pt-3.5">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">{title}</p>
      <p className="mb-2 mt-0.5 text-2xs text-text-muted">{hint}</p>
      {children}
    </div>
  );
}

/**
 * Pass, fail, or not yet looked at.
 *
 * Three states rather than a checkbox, because "nobody has checked the legal
 * position" and "the legal position is bad" call for opposite actions and a
 * checkbox reports them identically. Unanswered is the default and is visibly
 * not a pass.
 */
function GateControl({
  verdict,
  onSet,
  label,
}: {
  verdict: GateVerdict;
  onSet: (verdict: GateVerdict) => void;
  label: string;
}) {
  const options: { value: GateVerdict; icon: React.ReactNode; title: string; on: string }[] = [
    {
      value: 'pass',
      icon: <Check className="h-2.5 w-2.5" strokeWidth={3.5} />,
      title: 'Passes',
      on: 'border-success bg-success text-text-on-dark',
    },
    {
      value: 'unanswered',
      icon: <Minus className="h-2.5 w-2.5" strokeWidth={3.5} />,
      title: 'Not checked yet',
      on: 'border-hairline/40 bg-canvas-raise text-text-muted',
    },
    {
      value: 'fail',
      icon: <Ban className="h-2.5 w-2.5" strokeWidth={3} />,
      title: 'Fails',
      on: 'border-danger bg-danger text-text-on-dark',
    },
  ];

  return (
    <span className="mt-0.5 flex shrink-0 gap-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSet(option.value)}
          aria-pressed={verdict === option.value}
          aria-label={`${label}: ${option.title}`}
          title={option.title}
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-xs border transition',
            verdict === option.value
              ? option.on
              : 'border-hairline/15 text-transparent hover:border-hairline/35',
          )}
        >
          {option.icon}
        </button>
      ))}
    </span>
  );
}

function RatingPicker({
  value,
  unrated,
  label,
  onPick,
}: {
  value: Rating;
  unrated: boolean;
  label: string;
  onPick: (value: Rating) => void;
}) {
  return (
    <span className="flex shrink-0 gap-0.5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          aria-pressed={value === n}
          aria-label={`${label}: ${n} of 5`}
          className={cn(
            'tabular h-5 w-5 rounded-xs border text-2xs transition',
            value === n
              ? unrated
                ? // Amber while it is still the neutral default nobody chose.
                  'border-warning bg-warning-wash text-warning'
                : 'border-accent bg-accent text-text-on-dark'
              : 'border-hairline/15 text-text-faint hover:border-hairline/35',
          )}
        >
          {n}
        </button>
      ))}
    </span>
  );
}

function Toggle({
  on,
  onToggle,
  label,
  points,
  why,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
  points?: number;
  why: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="flex w-full items-start gap-2.5 rounded-sm px-2 py-1.5 text-left transition hover:bg-canvas-raise/50"
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border',
          on ? 'border-accent bg-accent' : 'border-hairline/25',
        )}
      >
        {on ? <Check className="h-2.5 w-2.5 text-text-on-dark" strokeWidth={3.5} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{label}</span>
          {points !== undefined ? (
            <span
              className={cn(
                'tabular rounded-pill px-1.5 text-2xs',
                points > 0 ? 'bg-success-wash text-success' : 'bg-danger-wash text-danger',
              )}
            >
              {points > 0 ? '+' : ''}
              {points}
            </span>
          ) : null}
        </span>
        <span className="mt-px block text-2xs leading-relaxed text-text-muted">{why}</span>
      </span>
    </button>
  );
}

export type { NewsModifierId, NewsGateId };
