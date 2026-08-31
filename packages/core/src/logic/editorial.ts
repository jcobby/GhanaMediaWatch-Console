import {
  ASSURANCE_META,
  canTransition,
  type AssuranceClass,
  type VerificationState,
} from '../types/assurance';

/**
 * What editorial does between a report arriving and anyone being told it is
 * true.
 *
 * The single rule this module exists to enforce: **a verification decision is
 * earned, not clicked.** Moving a report to "verified" requires corroboration
 * that has actually been done, and the strength required rises when the capture
 * itself is weaker. Without that, the eight-state model is decoration — an
 * editor under deadline pressure clicks the last state and the platform has
 * published an unchecked claim with a green badge on it.
 */

// ─── corroboration ─────────────────────────────────────────────────────────

export type CorroborationCheckId =
  | 'source_contacted'
  | 'independent_witness'
  | 'official_record'
  | 'landmark_match'
  | 'weather_light_match'
  | 'other_media_match'
  | 'field_followup';

export interface CorroborationCheck {
  id: CorroborationCheckId;
  label: string;
  description: string;
  /**
   * Contribution to confidence.
   *
   * Uneven on purpose. Speaking to the source and getting an independent
   * witness are worth far more than confirming a landmark, which only shows the
   * footage was taken where it claims — something the GPS already suggested.
   */
  weight: number;
  /**
   * Whether this check is independent of the reporter.
   *
   * Class C material needs at least one of these. Everything a reporter tells
   * you about their own footage corroborates nothing.
   */
  independent: boolean;
}

export const CORROBORATION_CHECKS: CorroborationCheck[] = [
  {
    id: 'source_contacted',
    label: 'Source contacted',
    description: 'Spoke to the reporter and their account is consistent.',
    weight: 25,
    independent: false,
  },
  {
    id: 'independent_witness',
    label: 'Independent witness',
    description: 'Someone unconnected to the reporter confirms it.',
    weight: 30,
    independent: true,
  },
  {
    id: 'official_record',
    label: 'Official record',
    description: 'A police, agency, utility or court record matches.',
    weight: 30,
    independent: true,
  },
  {
    id: 'landmark_match',
    label: 'Landmark matches',
    description: 'Buildings, signage or terrain match the stated place.',
    weight: 10,
    independent: true,
  },
  {
    id: 'weather_light_match',
    label: 'Weather and light match',
    description: 'Conditions in the footage match records for that time.',
    weight: 10,
    independent: true,
  },
  {
    id: 'other_media_match',
    label: 'Other media agrees',
    description: 'Separate footage or reporting of the same event.',
    weight: 25,
    independent: true,
  },
  {
    id: 'field_followup',
    label: 'Field follow-up',
    description: 'Someone went and looked.',
    weight: 35,
    independent: true,
  },
];

export interface CorroborationRecord {
  completed: CorroborationCheckId[];
  notes: string | null;
}

export const EMPTY_CORROBORATION: CorroborationRecord = {
  completed: [],
  notes: null,
};

const MAX_WEIGHT = CORROBORATION_CHECKS.reduce((sum, c) => sum + c.weight, 0);

/** Corroboration done so far, 0..1. */
export function corroborationStrength(record: CorroborationRecord): number {
  const done = new Set(record.completed);
  const earned = CORROBORATION_CHECKS.filter((c) => done.has(c.id)).reduce(
    (sum, c) => sum + c.weight,
    0,
  );
  return Math.min(1, earned / MAX_WEIGHT);
}

/** Whether anything independent of the reporter has been established. */
export function hasIndependentCorroboration(record: CorroborationRecord): boolean {
  const done = new Set(record.completed);
  return CORROBORATION_CHECKS.some((c) => c.independent && done.has(c.id));
}

// ─── decisions ─────────────────────────────────────────────────────────────

/**
 * Corroboration required before each verified state.
 *
 * "Verified in part" asks less because it claims less — it is the honest
 * landing place for a report where some elements stand up and others do not,
 * and making it as hard to reach as full verification would push editors to
 * over-claim rather than under-claim.
 */
const REQUIRED_STRENGTH: Partial<Record<VerificationState, number>> = {
  verified_high_confidence: 0.5,
  // Low on purpose. "Partly verified" claims that *some* elements stand up, so
  // one solid check behind a trusted capture is an honest bar for it. Setting
  // it near the full-verification bar would leave editors with nowhere to land
  // an incomplete story except "verified".
  verified_in_part: 0.15,
};

export type DecisionProblem =
  | 'transition_not_allowed'
  | 'insufficient_corroboration'
  | 'needs_independent_corroboration'
  | 'reason_required';

/**
 * Why this decision cannot be recorded, or null if it can.
 *
 * Returns the blocking reason rather than a bare false so the interface can
 * tell an editor what is missing instead of disabling a button silently.
 */
export function decisionProblem(
  from: VerificationState,
  to: VerificationState,
  record: CorroborationRecord,
  assurance: AssuranceClass,
  reason: string,
): DecisionProblem | null {
  if (!canTransition(from, to)) return 'transition_not_allowed';

  // Every decision is auditable, and an audit entry with no reason is a record
  // that someone clicked something.
  if (reason.trim().length < 4) return 'reason_required';

  const required = REQUIRED_STRENGTH[to];
  if (required !== undefined) {
    /*
     * Independence before strength, in that order.
     *
     * Material that cannot stand alone needs something from outside the
     * reporter, and no amount of the reporter's own corroboration substitutes
     * for it — so this is a prerequisite rather than a contribution. Checking
     * strength first would also make the rule unreachable, since any record
     * strong enough to pass already contains an independent check, and it
     * would tell an editor to "find more corroboration" when what they
     * actually need is one specific kind.
     */
    if (!ASSURANCE_META[assurance].usableAlone && !hasIndependentCorroboration(record)) {
      return 'needs_independent_corroboration';
    }

    if (corroborationStrength(record) < required) return 'insufficient_corroboration';
  }

  return null;
}

export function canRecordDecision(
  from: VerificationState,
  to: VerificationState,
  record: CorroborationRecord,
  assurance: AssuranceClass,
  reason: string,
): boolean {
  return decisionProblem(from, to, record, assurance, reason) === null;
}

// ─── the editorial record on a report ──────────────────────────────────────

export type ContactMethod = 'call' | 'sms' | 'in_app' | 'email';
export type ContactOutcome = 'reached' | 'no_answer' | 'declined' | 'unreachable';

export interface SourceContact {
  id: string;
  attemptedAtIso: string;
  method: ContactMethod;
  outcome: ContactOutcome;
  note: string | null;
  byEditorName: string;
}

export interface EditorialNote {
  id: string;
  authorName: string;
  body: string;
  createdAtIso: string;
}

/** One state change, kept forever. */
export interface DecisionRecord {
  id: string;
  from: VerificationState;
  to: VerificationState;
  editorName: string;
  reason: string;
  decidedAtIso: string;
}

export interface EditorialCase {
  incidentId: string;
  assignedToEditorName: string | null;
  corroboration: CorroborationRecord;
  contacts: SourceContact[];
  notes: EditorialNote[];
  /** Oldest first. Never edited, never removed. */
  decisions: DecisionRecord[];
  /** Set once someone has obscured faces or plates. */
  redactionApplied: boolean;
}

/** Whether the source has actually been spoken to, as opposed to called. */
export function sourceWasReached(editorialCase: EditorialCase): boolean {
  return editorialCase.contacts.some((c) => c.outcome === 'reached');
}

/**
 * How long this has been waiting, in hours.
 *
 * Measured from submission rather than from assignment, because a report nobody
 * picked up has still been waiting — measuring from assignment would make an
 * ignored queue look healthy.
 */
export function hoursWaiting(submittedAtIso: string, nowIso: string): number {
  const submitted = Date.parse(submittedAtIso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(submitted) || !Number.isFinite(now)) return 0;
  return Math.max(0, (now - submitted) / 3_600_000);
}

/**
 * Queue ordering for the triage desk.
 *
 * Expedited classes first, then severity, then age. Age last on purpose: an
 * old low-severity observation must never outrank a fresh emergency just for
 * having sat there, which is what a pure first-in-first-out queue does.
 */
export function triageScore(
  assurance: AssuranceClass,
  severityWeight: number,
  waitingHours: number,
): number {
  const expedited = ASSURANCE_META[assurance].expeditedReview ? 40 : 0;
  // Age contributes but saturates, so nothing can win on age alone.
  const age = Math.min(20, waitingHours);
  return expedited + severityWeight * 15 + age;
}
