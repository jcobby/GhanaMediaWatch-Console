import type { IncidentCategory } from './api';

/**
 * The Dawuro platform model.
 *
 * "Dawuro" is the gong-gong — the town crier's bell used across Ghana to
 * summon people and announce news. The public rings it; institutions listen.
 *
 * Three parties, and the whole design follows from keeping them distinct:
 *
 *   reporter        members of the public who capture and submit, and earn a
 *                   commission when an organisation licenses their report
 *   organisation        agencies, media houses and companies who subscribe to
 *                   receive reports, run surveys, and pay royalties
 *   platform_owner  operators who route submissions, approve organisations, and
 *                   settle payouts. Seeded, never self-registered.
 */

/**
 * Who someone is on the platform.
 *
 * `editor` is separate from `platform_owner` on purpose. Operating the service
 * and deciding whether a claim is true are different jobs held by different
 * organisations — the platform routes and bills, the editorial desk verifies.
 * One account able to do both could route a report to itself and publish it
 * unchecked.
 */
/**
 * What kind of account this is.
 *
 * `organisation` was `business`, renamed with the rest of the vocabulary: the
 * party it names is a district assembly or NADMO as often as it is a company,
 * and every screen calls it an organisation.
 *
 * Derived by the console from what `/me` reports, so it crosses no wire
 * contract — but it *is* written into the signed session cookie, which is why
 * `verifySessionToken` accepts the old spelling on the way in.
 */
export type AccountType = 'reporter' | 'organisation' | 'platform_owner' | 'editor';

// ─── where a submission goes ───────────────────────────────────────────────

/**
 * A reporter chooses this at review time, and it changes everything downstream:
 * who sees the report, whether it earns, and who reviews it.
 */
export type SubmissionDestination =
  /** The public feed. No commission — visibility is the reward. */
  | 'public'
  /** Offered to subscribing organisations. Earns a commission if licensed. */
  | 'marketplace'
  /** Sent to named organisations only. Never appears publicly. */
  | 'directed'
  /** Public *and* offered to organisations. */
  | 'both';

export const SUBMISSION_DESTINATIONS: readonly SubmissionDestination[] = [
  'public',
  'marketplace',
  'directed',
  'both',
];

// ─── organisations ────────────────────────────────────────────────────────────

export type OrganisationSector =
  'government' | 'media' | 'utility' | 'insurance' | 'ngo' | 'research' | 'other';

export type SubscriptionTier = 'basic' | 'standard' | 'enterprise';

export type BillingPeriod = 'monthly' | 'annual';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  /** How often the recurring fee falls due. */
  billingPeriod: BillingPeriod;
  /** The recurring fee for one billing period, in pesewas. */
  feePesewas: number;
  /**
   * Charge per downloaded report, in pesewas.
   *
   * `null` means unlimited — downloads cost nothing beyond the recurring fee.
   * Deliberately null rather than 0: a zero price and an uncapped plan are
   * different things, and a nullable field forces every caller to decide which
   * one it is meant to be handling.
   */
  perDownloadPesewas: number | null;
  seats: number;
  /** Surveys the organisation may have running at once. 0 disables the feature. */
  concurrentSurveys: number;
  canDirectRequest: boolean;
}

/**
 * Prices are placeholders pending a commercial decision.
 *
 * The *shape* is the commitment: two metered tiers where a subscription buys
 * access and each download is billed, and one annual tier where the fee buys
 * everything. That lets a district assembly that needs six reports a month and
 * a national broadcaster that needs six hundred share one product without the
 * small buyer subsidising the large one.
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  basic: {
    tier: 'basic',
    billingPeriod: 'monthly',
    feePesewas: 45_000,
    perDownloadPesewas: 2_000,
    seats: 3,
    concurrentSurveys: 1,
    canDirectRequest: false,
  },
  standard: {
    tier: 'standard',
    billingPeriod: 'monthly',
    feePesewas: 180_000,
    perDownloadPesewas: 1_200,
    seats: 12,
    concurrentSurveys: 5,
    canDirectRequest: true,
  },
  enterprise: {
    tier: 'enterprise',
    billingPeriod: 'annual',
    feePesewas: 2_400_000,
    perDownloadPesewas: null,
    seats: 50,
    concurrentSurveys: 25,
    canDirectRequest: true,
  },
};

export interface OrganisationAccount {
  id: string;
  name: string;
  sector: OrganisationSector;
  /** Verified accounts may be credited publicly when they action a report. */
  verified: boolean;
  tier: SubscriptionTier;
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'cancelled';
  renewsAtIso: string;
  seatsUsed: number;
  /**
   * Billable downloads taken in the current period.
   *
   * Downloading is the billable event, not receiving — a report arriving in an
   * inbox costs nothing, because an organisation cannot be charged for what
   * routing chose to show it.
   */
  reportsUsedThisPeriod: number;
  /** Categories this organisation is interested in — drives routing suggestions. */
  interests: IncidentCategory[];
  logoUrl: string | null;
}

// ─── earnings ──────────────────────────────────────────────────────────────

export type CommissionStatus =
  /** Submitted; no organisation has licensed it yet. */
  | 'pending'
  /** An organisation licensed the report. Amount is fixed at this point. */
  | 'earned'
  /** Included in a payout batch. */
  | 'paid'
  /** Report rejected or withdrawn — nothing owed. */
  | 'void';

export interface CommissionEntry {
  id: string;
  incidentId: string;
  /** Short label of the report, so the ledger reads without a second lookup. */
  incidentSummary: string;
  category: IncidentCategory;
  /** Null while pending — no organisation has licensed it. */
  businessName: string | null;
  status: CommissionStatus;
  /** Pesewas. Integer arithmetic only; money never touches a float. */
  amountPesewas: number;
  createdAtIso: string;
  paidAtIso: string | null;
}

export interface EarningsSummary {
  /** Licensed but not yet paid out. */
  pendingPesewas: number;
  /** Settled to the reporter. */
  paidPesewas: number;
  lifetimePesewas: number;
  reportsLicensed: number;
  /** Payouts run once a reporter clears this floor. */
  payoutThresholdPesewas: number;
  nextPayoutIso: string | null;
}

// ─── surveys ───────────────────────────────────────────────────────────────

export type SurveyQuestionKind = 'single_choice' | 'multi_choice' | 'scale' | 'text' | 'photo';

export interface SurveyQuestion {
  id: string;
  kind: SurveyQuestionKind;
  prompt: string;
  /** Present for choice questions. */
  options?: string[];
  required: boolean;
}

export interface Survey {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  /** Pesewas paid to each reporter who completes it. */
  rewardPesewas: number;
  /** Null means anywhere in the country. */
  targetArea: { latitude: number; longitude: number; radiusM: number } | null;
  responsesTarget: number;
  responsesReceived: number;
  closesAtIso: string;
  status: 'draft' | 'live' | 'closed';
}

// ─── platform routing ──────────────────────────────────────────────────────

/**
 * A submission waiting on the platform owner to route it.
 *
 * Reports do not reach organisations automatically. An operator decides which
 * organisations a marketplace submission is offered to — that judgement is the
 * platform's actual product, and it is what a subscription buys.
 */
export interface RoutingItem {
  id: string;
  incidentId: string;
  summary: string;
  category: IncidentCategory;
  destination: SubmissionDestination;
  /** Organisations the reporter named, on a directed submission. */
  requestedBusinessIds: string[];
  /** Organisations the platform suggests, from sector and interest matching. */
  suggestedBusinessIds: string[];
  reporterHandle: string;
  /**
   * When the footage was filmed, which is not when it was uploaded.
   *
   * An operator routing an accident needs the capture time — a clip submitted
   * an hour late is still an hour-old incident, and the two timestamps can
   * differ by days when a reporter was offline.
   */
  capturedAtIso: string;
  submittedAtIso: string;
  status: 'awaiting_routing' | 'routed' | 'rejected';
  locationLabel: string | null;
  /**
   * Where the incident is, when the reporter allowed it.
   *
   * Separate from `locationLabel` because they answer different questions: the
   * label is what an operator reads, the coordinate is what decides which
   * employee is near enough to attend. A label alone cannot be measured
   * against a branch boundary or a responder's position.
   */
  location: { latitude: number; longitude: number } | null;
  thumbnailUrl: string;
}

// ─── money formatting ──────────────────────────────────────────────────────

/**
 * Format pesewas as cedis.
 *
 * Integer minor units throughout: floating-point cedis accumulate rounding
 * error across a payout batch, and a ledger that does not balance is worse than
 * no ledger at all.
 */
export function formatCedis(pesewas: number, options: { compact?: boolean } = {}): string {
  const cedis = pesewas / 100;
  if (options.compact && cedis >= 1000) {
    return `GH₵${(cedis / 1000).toFixed(1)}k`;
  }
  return `GH₵${cedis.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
