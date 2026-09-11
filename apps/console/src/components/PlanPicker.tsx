'use client';

import { Check, Infinity as InfinityIcon } from 'lucide-react';
import {
  SUBSCRIPTION_PLANS,
  annualCost,
  breakEvenDownloads,
  downloadCharge,
  formatCedis,
  isUnlimited,
  planFor,
  type SubscriptionTier,
} from '@dawuro/core';
import { cn } from '@/lib/cn';

const ORDER: SubscriptionTier[] = ['basic', 'standard', 'enterprise'];

const BLURB: Record<SubscriptionTier, string> = {
  basic: 'For a single office acting on a handful of reports a month.',
  standard: 'For a newsroom or agency working reports daily.',
  enterprise: 'For a national body where nobody should be counting downloads.',
};

/**
 * Choosing a subscription.
 *
 * The hard part of this pricing is that two tiers bill monthly with a charge
 * per download and one bills annually with none, so the sticker prices are not
 * comparable. Rather than leave a buyer to work that out, each card states its
 * yearly cost at a realistic volume, and the metered tiers state the download
 * count above which enterprise becomes cheaper — computed from the prices, not
 * asserted by a salesperson.
 */
export function PlanPicker({
  value,
  onChange,
  /** Downloads a month the buyer expects, which makes the comparison real. */
  expectedMonthlyDownloads = 20,
}: {
  value: SubscriptionTier;
  onChange: (tier: SubscriptionTier) => void;
  expectedMonthlyDownloads?: number;
}) {
  const perYear = Math.max(0, Math.round(expectedMonthlyDownloads)) * 12;
  // A literal tier, so the table always has it — unlike an organisation's own
  // tier, which arrives from the network and often does not.
  const unlimited = planFor('enterprise')!;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ORDER.map((tier) => {
        const plan = SUBSCRIPTION_PLANS[tier];
        const selected = value === tier;
        const uncapped = isUnlimited(plan);
        const yearly = annualCost(plan, perYear);
        const breakEven = uncapped ? null : breakEvenDownloads(plan, unlimited);

        return (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            aria-pressed={selected}
            className={cn(
              'flex flex-col rounded-md border p-4 text-left transition',
              selected
                ? 'border-accent bg-accent-wash/40 shadow-sm'
                : 'border-hairline/[0.10] hover:border-accent/30 hover:bg-canvas-raise/40',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold capitalize">{tier}</span>
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-pill border',
                  selected ? 'border-accent bg-accent' : 'border-hairline/25',
                )}
              >
                {selected ? (
                  <Check className="h-2.5 w-2.5 text-text-on-dark" strokeWidth={3.5} />
                ) : null}
              </span>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-text-muted">{BLURB[tier]}</p>

            <div className="mt-4">
              <p className="tabular truncate text-xl font-semibold tracking-[-0.02em]">
                {formatCedis(plan.feePesewas)}
              </p>
              <p className="text-2xs text-text-faint">
                per {plan.billingPeriod === 'annual' ? 'year' : 'month'}
              </p>
            </div>

            <ul className="mt-4 flex-1 space-y-1.5 text-xs leading-snug text-text-secondary">
              <li className="flex items-start gap-1.5">
                {uncapped ? (
                  <InfinityIcon className="mt-0.5 h-3 w-3 shrink-0 text-accent" strokeWidth={2.5} />
                ) : (
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" strokeWidth={3} />
                )}
                <span>
                  {uncapped
                    ? 'Unlimited downloads'
                    : `${formatCedis(downloadCharge(plan) ?? 0)} per download`}
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" strokeWidth={3} />
                <span>{plan.seats} team members</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" strokeWidth={3} />
                <span>
                  {plan.concurrentSurveys} survey
                  {plan.concurrentSurveys === 1 ? '' : 's'} at a time
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                {plan.canDirectRequest ? (
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" strokeWidth={3} />
                ) : (
                  <span className="mt-0.5 h-3 w-3 shrink-0 text-center text-text-faint">–</span>
                )}
                <span className={plan.canDirectRequest ? undefined : 'text-text-faint'}>
                  Request reports directly
                </span>
              </li>
            </ul>

            {/* The comparison the sticker prices cannot make on their own. */}
            <div className="mt-4 border-t border-hairline/[0.08] pt-3">
              <p className="tabular text-xs font-medium">
                {formatCedis(yearly)} <span className="font-normal text-text-muted">a year</span>
              </p>
              <p className="mt-0.5 text-2xs text-text-faint">
                at {expectedMonthlyDownloads} download
                {expectedMonthlyDownloads === 1 ? '' : 's'} a month
              </p>
              {breakEven !== null ? (
                <p className="mt-1.5 text-2xs leading-snug text-text-muted">
                  Past <span className="tabular font-medium">{breakEven}</span> downloads a year,
                  enterprise costs less than this.
                </p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
