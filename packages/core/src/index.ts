/**
 * Shared organisation rules for the Dawuro platform.
 *
 * Everything here is pure TypeScript with no React, React Native, Next.js or
 * DOM dependency, so the phone app and the web console compute identical
 * answers from identical inputs. That matters most for money: the commission a
 * reporter is quoted on their phone and the amount an organisation is billed in the
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
  type ItemOrigin,
  type NewsSection,
  NEWS_SECTIONS,
  NEWS_SECTION_LABEL,
  type DisplayFlags,
  type IncidentCounts,
  type Incident,
  type AuthoredIncident,
  type Page,
  type FeedQuery,
  type ApiErrorCode,
} from './types/api';

export {
  type Severity,
  type SeverityMeta,
  SEVERITY_META,
  severityMeta,
  SEVERITIES,
  EMERGENCY_NUMBER,
  warnsAboutEmergencyServices,
  type ConsentFlags,
  EMPTY_CONSENT,
  type HandlingRequirement,
  handlingRequirements,
  needsRedaction,
  needsEditorialReview,
  type IncidentContext,
  EMPTY_CONTEXT,
  formatReportId,
} from './types/context';

export {
  type AssuranceClass,
  type AssuranceMeta,
  ASSURANCE_META,
  assuranceMeta,
  type CaptureFacts,
  assuranceClass,
  failedChecks,
  type VerificationState,
  type VerificationMeta,
  VERIFICATION_META,
  verificationMeta,
  VERIFICATION_STATES,
  canTransition,
  nextStates,
  canPublishReport,
  canLicenseReport,
  vettingStateFor,
} from './types/assurance';

export {
  type CategoryGroup,
  type CategoryMeta,
  CATEGORY_META,
  CATEGORY_GROUPS,
  CATEGORY_GROUP_LABEL,
  categoriesInGroup,
  categoryHue,
  categoryLabel,
} from './types/categories';

export {
  type AccountType,
  type SubmissionDestination,
  SUBMISSION_DESTINATIONS,
  type OrganisationSector,
  type SubscriptionTier,
  type BillingPeriod,
  type SubscriptionPlan,
  SUBSCRIPTION_PLANS,
  type OrganisationAccount,
  type CommissionStatus,
  type CommissionEntry,
  type EarningsSummary,
  type SurveyQuestionKind,
  type SurveyQuestion,
  type Survey,
  type RoutingItem,
  formatCedis,
} from './types/dawuro';

// ─── organisation rules ────────────────────────────────────────────────────────

export {
  type RoutableSubmission,
  type OrganisationWatchArea,
  type RouteMatch,
  type RouteReason,
  canReceive,
  autoRoute,
  needsReview,
} from './logic/autoRoute';

export {
  PLATFORM_FEE_RATE,
  COMMISSION_BOUNDS,
  DEFAULT_COMMISSION_RATES,
  type CommissionRates,
  type OrganisationOffer,
  sanitiseCommissionRates,
  sanitiseOffer,
  bestOffer,
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
  type Branch,
  type EmployeeDuty,
  type ShiftStatus,
  type WorkingLanguage,
  type Employee,
  type MembershipStatus,
  type MembershipRequest,
  type InternalSubmission,
} from './types/org';

export {
  type InviteKind,
  type Invite,
  type InviteProblem,
  type AffiliationKind,
  type OrgAffiliation,
  type ReporterAffiliation,
} from './types/affiliation';

export {
  type ClusterPoint,
  type Cluster,
  clusterPoints,
  hotspots,
  type TimeBucket,
  type BucketSize,
  bucketByTime,
  trend,
} from './logic/clusters';

export {
  type ResponseAction,
  type ResponseActionMeta,
  RESPONSE_META,
  responseMeta,
  type ResponseEntry,
  latestResponse,
  isClosed,
  canRecordResponse,
  ACK_TARGET_HOURS,
  type SlaStatus,
  type SlaState,
  slaState,
  needsEscalation,
} from './logic/response';

export {
  type CorroborationCheckId,
  type CorroborationCheck,
  CORROBORATION_CHECKS,
  type CorroborationRecord,
  EMPTY_CORROBORATION,
  corroborationStrength,
  hasIndependentCorroboration,
  type DecisionProblem,
  decisionProblem,
  canRecordDecision,
  type ContactMethod,
  type ContactOutcome,
  type SourceContact,
  type EditorialNote,
  type DecisionRecord,
  type EditorialCase,
  sourceWasReached,
  hoursWaiting,
  triageScore,
} from './logic/editorial';

export {
  // gates
  type NewsGateId,
  type NewsGate,
  type GateVerdict,
  type NewsGateAnswers,
  NEWS_GATES,
  GATES_UNANSWERED,
  passesAllGates,
  failedGates,
  unansweredGates,
  deriveGates,
  // the weighted score
  type NewsCriterionId,
  type NewsCriterion,
  type Rating,
  type NewsRatings,
  type NewsScore,
  NEWS_CRITERIA,
  NEUTRAL_RATING,
  NEUTRAL_RATINGS,
  SCORE_SCALE,
  MAX_RAW_TOTAL,
  MIN_PLAUSIBLE_MEDIA_BYTES,
  scoreNews,
  type CriterionContribution,
  criterionContributions,
  leadingReasons,
  // modifiers and rules
  type NewsModifierId,
  type NewsModifier,
  type NewsModifierFlags,
  NEWS_MODIFIERS,
  NO_MODIFIERS,
  type ElectionFairnessInput,
  applyElectionFairness,
  needsSecondEditor,
  // tiers
  type NewsTier,
  type NewsTierMeta,
  NEWS_TIERS,
  NEWS_TIER_META,
  tierFor,
  demoteTier,
  // tie-breaks
  type TieBreakReason,
  type TieBreakCandidate,
  type TieBreakOutcome,
  TIE_BREAK_LABEL,
  TIE_BREAK_WINDOW,
  breakTie,
  // Ghana's regions
  type GhanaRegionId,
  type GhanaRegion,
  GHANA_REGIONS,
  GHANA_REGION_META,
  nearestRegion,
  regionFromCoordinates,
  // the score every report gets on arrival
  type ProvisionalInput,
  type ProvisionalAssessment,
  DERIVABLE_CRITERIA,
  provisionalAssessment,
} from './logic/newsValue';

export {
  inviteProblem,
  isInviteUsable,
  remainingUses,
  affiliationsOf,
  visibleAffiliateIds,
  canAffiliate,
} from './logic/affiliation';

export {
  type OnboardingStepId,
  type StepStatus,
  type OnboardingStepMeta,
  type OnboardingField,
  ONBOARDING_STEPS,
  REVIEWABLE_STEPS,
  type DocumentId,
  type DocumentRequirement,
  DOCUMENT_REQUIREMENTS,
  type UploadedDocument,
  type StepState,
  type OnboardingApplication,
  stepState,
  completedByApplicant,
  applicantProgress,
  nextStepFor,
  documentSatisfied,
  missingDocuments,
  type SubmitProblem,
  submitProblem,
  type ApprovalProblem,
  approvalProblem,
  outstandingForApproval,
  onboardingReference,
} from './logic/onboarding';

export {
  type AssignableIncident,
  type AssignmentBlock,
  type AssignmentReason,
  type AssignmentCandidate,
  type BlockedCandidate,
  type AssignmentResult,
  blockingReason,
  assignToEmployee,
  bestAssignee,
} from './logic/assignment';

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
  formatCaptureDay,
  formatPlace,
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
  ORGANISATIONS,
  EARNINGS_SUMMARY,
  COMMISSION_LEDGER,
  ROUTING_QUEUE,
  SURVEYS,
  type OrganisationApplication,
  ORGANISATION_APPLICATIONS,
  type PayoutBatch,
  PAYOUT_BATCHES,
  PLATFORM_METRICS,
} from './data/dawuroData';

export { SAMPLE_INCIDENTS } from './data/fixtures';

export {
  BRANCHES,
  EMPLOYEES,
  MEMBERSHIP_REQUESTS,
  INTERNAL_SUBMISSIONS,
  INVITES,
  ORG_AFFILIATIONS,
  EDITORIAL_CASES,
  ONBOARDING_APPLICATIONS,
  editorialCaseFor,
  invitesOf,
  employeesOf,
  branchesOf,
  pendingMembershipsOf,
  internalSubmissionsOf,
} from './data/orgData';

export { placeholderImage } from './lib/placeholder';

// ─── roles and navigation ──────────────────────────────────────────────────
export {
  MODULE_META,
  PLATFORM_MODULES,
  VISIBLE_MODULES,
  isModuleVisible,
  visibleRoles,
  ROLE_META,
  ADMIN_ROLES,
  SERVICE_ROLES,
  PLATFORM_ROLES,
  rolesInModule,
  isAdminRole,
  roleCan,
  rolesWith,
  isReadOnly,
  type PlatformModule,
  type ModuleMeta,
  type ConsoleCapability,
  type AdminRole,
  type ServiceRole,
  type PlatformRole,
  type RoleMeta,
} from './types/roles';

export type { NavIconName, NavItem, NavSection } from './types/nav';
export {
  navigationFor,
  reachableHrefs,
  organisationNavigation,
  organisationHrefs,
} from './logic/navigation';

export { ROLE_LOGINS, ALL_DEMO_LOGINS } from './data/dawuroData';
