import type { IncidentCategory } from '../types/api';
import type { Branch, Employee, EmployeeDuty, WorkingLanguage } from '../types/org';
import { haversineMetres, type LatLng } from '../lib/geo';

/**
 * Choosing which employee an incident goes to.
 *
 * Proximity is the obvious input and the least sufficient one. The nearest
 * officer is the wrong choice when they finished their shift an hour ago, when
 * the incident is across a boundary they have no authority in, when they are
 * already holding six open cases, or when the report needs a fire inspector and
 * they investigate procurement fraud.
 *
 * So this runs in two stages, and the order is the point:
 *
 *   1. **Gates.** Facts that make someone ineligible no matter how good the
 *      rest of the fit is. A gated employee is returned with the reason rather
 *      than silently dropped — a dispatcher looking at an empty list needs to
 *      know it is empty because everyone is off shift, not because the software
 *      failed.
 *
 *   2. **Score.** Among those who *can* take it, who *should*. Weighted so that
 *      being right for the job outranks being near it.
 *
 * Everything here is pure. Given the same incident and the same staff list it
 * returns the same ranking on a phone, in the console, and in a test.
 */

export interface AssignableIncident {
  category: IncidentCategory;
  /** Null when the reporter hid their location. */
  location: LatLng | null;
  /** Urgent work prefers seniority and penalises unreliability harder. */
  urgent?: boolean;
  /** Language the reporter used, when a call-back may be needed. */
  reporterLanguage?: WorkingLanguage;
}

export type AssignmentBlock =
  'off_duty' | 'on_leave' | 'inactive' | 'at_capacity' | 'outside_jurisdiction' | 'not_qualified';

export type AssignmentReason =
  | 'specialisation_match'
  | 'field_duty'
  | 'nearby'
  | 'in_branch_area'
  | 'has_capacity'
  | 'reliable'
  | 'language_match'
  | 'senior_for_urgent';

export interface AssignmentCandidate {
  employeeId: string;
  score: number;
  reasons: AssignmentReason[];
  /** Metres from the incident, when both positions are known. */
  distanceM: number | null;
}

export interface BlockedCandidate {
  employeeId: string;
  blockedBy: AssignmentBlock;
}

export interface AssignmentResult {
  /** Eligible staff, best first. */
  candidates: AssignmentCandidate[];
  /** Ineligible staff and why, so an empty list is explainable. */
  blocked: BlockedCandidate[];
}

/** Duties that mean someone physically attends an incident. */
const FIELD_DUTIES: EmployeeDuty[] = [
  'field_response',
  'inspection',
  'investigation',
  'community_liaison',
];

/** Roles trusted with urgent work. */
const SENIOR_ROLES = new Set(['dispatcher', 'admin', 'owner']);

const WEIGHTS = {
  specialisation: 40,
  fieldDuty: 25,
  proximity: 30,
  branchArea: 15,
  capacity: 20,
  reliability: 15,
  language: 10,
  seniorUrgent: 20,
} as const;

/** Distance beyond which proximity contributes nothing. */
const PROXIMITY_RANGE_M = 15_000;

/**
 * Why an employee cannot take this incident, or null if they can.
 *
 * Exported so a UI can explain one person's ineligibility without re-running
 * the whole ranking.
 */
export function blockingReason(
  employee: Employee,
  incident: AssignableIncident,
  branch: Branch | null,
): AssignmentBlock | null {
  if (!employee.active) return 'inactive';
  if (employee.shiftStatus === 'on_leave') return 'on_leave';
  if (employee.shiftStatus === 'off_duty') return 'off_duty';

  if (employee.openAssignments >= employee.maxConcurrentAssignments) return 'at_capacity';

  /*
   * An empty specialisation list means generalist, not "qualified for nothing".
   * Treating a blank field as exclusion would empty an organisation's routing
   * the moment someone skipped that step on a form.
   */
  if (
    employee.specialisations.length > 0 &&
    !employee.specialisations.includes(incident.category)
  ) {
    return 'not_qualified';
  }

  /*
   * Jurisdiction is a hard limit rather than a penalty. An officer of one
   * assembly has no authority in another's area, and sending them is not a
   * slightly worse assignment — it is one that cannot be carried out.
   * Only applied when both the boundary and the incident position are known.
   */
  if (branch && incident.location) {
    const fromBranch = haversineMetres(branch.location, incident.location);
    if (fromBranch > branch.jurisdictionRadiusM) return 'outside_jurisdiction';
  }

  return null;
}

/** Free capacity as a 0..1 share. */
function capacityShare(employee: Employee): number {
  const max = Math.max(1, employee.maxConcurrentAssignments);
  const free = Math.max(0, max - employee.openAssignments);
  return free / max;
}

/** Proximity as a 0..1 share, decaying linearly to nothing at the range limit. */
function proximityShare(distanceM: number | null): number {
  if (distanceM === null) return 0;
  if (distanceM >= PROXIMITY_RANGE_M) return 0;
  return 1 - distanceM / PROXIMITY_RANGE_M;
}

/**
 * Rank an organisation's staff for one incident.
 *
 * `branches` is looked up by id; an employee with no branch is not gated on
 * jurisdiction, which is correct for org-wide staff such as a duty dispatcher.
 */
export function assignToEmployee(
  incident: AssignableIncident,
  employees: Employee[],
  branches: Branch[],
): AssignmentResult {
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const candidates: AssignmentCandidate[] = [];
  const blocked: BlockedCandidate[] = [];

  for (const employee of employees) {
    const branch = employee.branchId ? (branchById.get(employee.branchId) ?? null) : null;

    const block = blockingReason(employee, incident, branch);
    if (block) {
      blocked.push({ employeeId: employee.id, blockedBy: block });
      continue;
    }

    const reasons: AssignmentReason[] = [];
    let score = 0;

    // Right person for this kind of incident.
    if (employee.specialisations.includes(incident.category)) {
      score += WEIGHTS.specialisation;
      reasons.push('specialisation_match');
    }

    if (employee.duties.some((d) => FIELD_DUTIES.includes(d))) {
      score += WEIGHTS.fieldDuty;
      reasons.push('field_duty');
    }

    // Where they actually are, not where their office is.
    const distanceM =
      incident.location && employee.lastKnownLocation
        ? Math.round(haversineMetres(employee.lastKnownLocation, incident.location))
        : null;

    const nearness = proximityShare(distanceM);
    if (nearness > 0) {
      score += WEIGHTS.proximity * nearness;
      reasons.push('nearby');
    }

    // Their branch covering the area is weaker evidence than their own
    // position, but it is evidence — and it is all we have for office staff.
    if (branch && incident.location) {
      const fromBranch = haversineMetres(branch.location, incident.location);
      if (fromBranch <= branch.jurisdictionRadiusM) {
        score += WEIGHTS.branchArea;
        reasons.push('in_branch_area');
      }
    }

    const free = capacityShare(employee);
    if (free > 0) {
      score += WEIGHTS.capacity * free;
      if (free >= 0.5) reasons.push('has_capacity');
    }

    const reliability = Math.min(1, Math.max(0, employee.acknowledgementRate));
    // Urgent work weighs reliability twice as heavily: the cost of an
    // unanswered assignment is much higher when something is on fire.
    score += WEIGHTS.reliability * reliability * (incident.urgent ? 2 : 1);
    if (reliability >= 0.8) reasons.push('reliable');

    if (incident.reporterLanguage && employee.languages.includes(incident.reporterLanguage)) {
      score += WEIGHTS.language;
      reasons.push('language_match');
    }

    if (incident.urgent && SENIOR_ROLES.has(employee.role)) {
      score += WEIGHTS.seniorUrgent;
      reasons.push('senior_for_urgent');
    }

    candidates.push({
      employeeId: employee.id,
      score: Math.round(score * 100) / 100,
      reasons,
      distanceM,
    });
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Ties break toward whoever is physically closer; someone with no known
    // position sorts last rather than winning by default.
    const da = a.distanceM ?? Number.POSITIVE_INFINITY;
    const db = b.distanceM ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.employeeId.localeCompare(b.employeeId);
  });

  return { candidates, blocked };
}

/** The single best assignee, or null when nobody is eligible. */
export function bestAssignee(result: AssignmentResult): AssignmentCandidate | null {
  return result.candidates[0] ?? null;
}
