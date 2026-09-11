import { SUBSCRIPTION_PLANS, type SubscriptionPlan, type SubscriptionTier } from '../types/dawuro';

/**
 * Subscription billing.
 *
 * Two shapes of plan share this module: metered tiers that charge a recurring
 * fee plus a price per download, and an unlimited tier that charges once a year
 * and nothing per download.
 *
 * Every amount is integer pesewas. Cedis are never used in arithmetic — a
 * floating-point cedi accumulates error across a month of downloads, and the
 * error lands in someone's invoice.
 */

/**
 * The plan for a tier, or null when there is no tier to look one up by.
 *
 * **Nullable because the lookup genuinely fails, and it took down a page.**
 * This was typed as total — `SUBSCRIPTION_PLANS[tier]` returning a
 * `SubscriptionPlan` — so every caller believed it had one. Against the live
 * service the organisation's tier is frequently absent (`/org/dashboard`
 * carries no organisation at all), the index returned `undefined`, and the
 * first thing to touch it threw `Cannot read properties of undefined (reading
 * 'perDownloadPesewas')` on the inbox. Six pages had the same crash waiting in
 * them.
 *
 * The type now says what is true, so TypeScript makes every caller decide what
 * to show when the tier is unknown. On a page that quotes a price that decision
 * matters: guessing a number where somebody is about to spend money is worse
 * than saying nothing, and the callers that print charges say nothing.
 *
 * `unknown` rather than `SubscriptionTier` on the parameter, because the value
 * arrives from a network and the declared type is a hope, not a guarantee.
 */
export function planFor(tier: unknown): SubscriptionPlan | null {
  if (typeof tier !== 'string') return null;
  return SUBSCRIPTION_PLANS[tier as SubscriptionTier] ?? null;
}

/**
 * True when downloads carry no per-item charge.
 *
 * Takes a nullable plan and answers **false** for a missing one, which is the
 * only safe direction: "unlimited" is a claim, and telling an organisation
 * their downloads are already paid for when we do not know their plan invites
 * spending they will be invoiced for.
 */
export function isUnlimited(plan: SubscriptionPlan | null | undefined): boolean {
  return plan?.perDownloadPesewas === null;
}

/**
 * What one more download costs on this plan, right now.
 *
 * This is the number that belongs on the download button. An organisation
 * should never discover the price of a report on next month's invoice.
 *
 * **Null means "we do not know", and zero means "free".** They are not the same
 * statement and conflating them is how a button comes to say a report costs
 * nothing because the plan failed to load. Callers that print a price have to
 * decide what to show when there is none — and saying nothing is the right
 * answer on a screen where the next click spends money.
 */
export function downloadCharge(plan: SubscriptionPlan | null | undefined): number | null {
  if (!plan) return null;
  return plan.perDownloadPesewas ?? 0;
}

/**
 * Total cost of one billing period, given how many downloads were taken.
 *
 * Negative or fractional download counts are a programming error rather than a
 * user input, so they are clamped rather than allowed to produce a negative
 * invoice.
 */
export function periodCost(plan: SubscriptionPlan, downloads: number): number {
  const taken = Math.max(0, Math.floor(downloads));
  return plan.feePesewas + (downloadCharge(plan) ?? 0) * taken;
}

/**
 * Cost of a year on this plan, for comparing tiers side by side.
 *
 * Comparing a monthly fee against an annual one is the single most confusing
 * thing about this pricing page, so the comparison is computed rather than left
 * to the reader.
 */
export function annualCost(plan: SubscriptionPlan, downloadsPerYear: number): number {
  const taken = Math.max(0, Math.floor(downloadsPerYear));
  const periods = plan.billingPeriod === 'annual' ? 1 : 12;
  return plan.feePesewas * periods + (downloadCharge(plan) ?? 0) * taken;
}

/**
 * Downloads per year at which an unlimited plan becomes the cheaper choice.
 *
 * Returns null when the metered plan never loses — either it is already
 * unlimited, or its fees are high enough that metering always wins. Shown to a
 * buyer so the upgrade is an arithmetic fact rather than a sales claim.
 */
export function breakEvenDownloads(
  metered: SubscriptionPlan,
  unlimited: SubscriptionPlan,
): number | null {
  const perDownload = metered.perDownloadPesewas;
  if (perDownload === null || perDownload <= 0) return null;

  const meteredAnnualFee = metered.feePesewas * (metered.billingPeriod === 'annual' ? 1 : 12);
  const unlimitedAnnualFee = unlimited.feePesewas * (unlimited.billingPeriod === 'annual' ? 1 : 12);

  const gap = unlimitedAnnualFee - meteredAnnualFee;
  if (gap <= 0) return 0; // Unlimited already costs no more in fees alone.

  return Math.ceil(gap / perDownload);
}
