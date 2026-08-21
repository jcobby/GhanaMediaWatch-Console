/**
 * Shared business rules for the Dawuro platform.
 *
 * Everything here is pure TypeScript with no React, React Native, Next.js or
 * DOM dependency, so the phone app and the web console compute identical
 * answers from identical inputs. That matters most for money: the commission a
 * reporter is quoted on their phone and the amount a business is billed in the
 * console are the same function, not two implementations that agree today.
 *
 * Rules that belong here: routing, commission, permissions, survey validation.
 * Rules that do not: anything touching a camera, a filesystem, a network, or a
 * screen.
 */

// ─── types ─────────────────────────────────────────────────────────────────

export {
  INCIDENT_CATEGORIES,
  type IncidentCategory,
  type VettingState,
  type MediaKind,
  type LocationConfidence,
  type TimePrecision,
  type IncidentMedia,
  type PublicLocation,
  type PreciseLocation,
  type Publisher,
  type DisplayFlags,
  type IncidentCounts,
  type Incident,
  type AuthoredIncident,
  type Page,
  type FeedQuery,
  type ApiErrorCode,
} from './types/api';

export {
  type AccountType,
  type SubmissionDestination,
  SUBMISSION_DESTINATIONS,
  type BusinessSector,
  type SubscriptionTier,
  type BillingPeriod,
  type SubscriptionPlan,
  SUBSCRIPTION_PLANS,
  type BusinessAccount,
  type CommissionStatus,
  type CommissionEntry,
  type EarningsSummary,
  type SurveyQuestionKind,
  type SurveyQuestion,
  type Survey,
  type RoutingItem,
  formatCedis,
} from './types/dawuro';

// ─── business rules ────────────────────────────────────────────────────────

export {
  type RoutableSubmission,
  type BusinessWatchArea,
  type RouteMatch,
  type RouteReason,
  canReceive,
  autoRoute,
  needsReview,
} from './logic/autoRoute';

export {
  PLATFORM_FEE_RATE,
  type CommissionInput,
  type CommissionBreakdown,
  estimateCommission,
  isEarning,
  sumPesewas,
  payoutProgress,
} from './logic/commission';

export {
  type SurveyIssue,
  MIN_REWARD_PESEWAS,
  MAX_QUESTIONS,
  validateSurvey,
  canPublish,
  type SurveyCost,
  estimateSurveyCost,
  type AnswerValue,
  isAnswered,
  isSubmittable,
  completionProgress,
  fillRate,
  isAcceptingResponses,
} from './logic/surveyLogic';

export {
  planFor,
  isUnlimited,
  downloadCharge,
  periodCost,
  annualCost,
  breakEvenDownloads,
} from './logic/billing';

export {
  type OrgRole,
  type OrgCapability,
  can,
  capabilitiesFor,
  canChangeRole,
  canRemoveMember,
  assignableRoles,
} from './logic/permissions';

// ─── formatting and geography ──────────────────────────────────────────────

export { type LatLng, haversineMetres, regionContaining } from './lib/geo';

export {
  formatRelativeTime,
  formatDistance,
  formatCount,
  formatCoordinate,
  formatExactCapture,
  formatFullTimestamp,
} from './lib/format';

// ─── simulated data ────────────────────────────────────────────────────────
//
// Seeded fixtures, exported so the console is demonstrable before the backend
// exists. Screens must never fall back to these silently when the API is
// unreachable — an outage has to look like an outage.

export {
  PLATFORM_OWNERS,
  DEMO_PASSWORD,
  type DemoLogin,
  DEMO_LOGINS,
  findDemoLogin,
  BUSINESSES,
  EARNINGS_SUMMARY,
  COMMISSION_LEDGER,
  ROUTING_QUEUE,
  SURVEYS,
  type BusinessApplication,
  BUSINESS_APPLICATIONS,
  type PayoutBatch,
  PAYOUT_BATCHES,
  PLATFORM_METRICS,
} from './data/dawuroData';

export { SAMPLE_INCIDENTS } from './data/fixtures';
