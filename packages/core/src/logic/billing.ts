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

export function planFor(tier: SubscriptionTier): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[tier];
}

/** True when downloads carry no per-item charge. */
export function isUnlimited(plan: SubscriptionPlan): boolean {
  return plan.perDownloadPesewas === null;
}

/**
 * What one more download costs on this plan, right now.
 *
 * This is the number that belongs on the download button. An organisation
 * should never discover the price of a report on next month's invoice.
 */
export function downloadCharge(plan: SubscriptionPlan): number {
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
  return plan.feePesewas + downloadCharge(plan) * taken;
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
  return plan.feePesewas * periods + downloadCharge(plan) * taken;
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
