import type { IncidentCategory } from './api';
import type { LatLng } from '../lib/geo';
import type { OrgRole } from '../logic/permissions';

/**
 * Organisations, their branches, and the people who work in them.
 *
 * An organisation on Dawuro is rarely one office. A metropolitan assembly has
 * sub-metros, a utility has district depots, a media house has regional
 * bureaux — and an incident that belongs to one of them does not belong to the
 * others. Modelling a business as a flat list of users would make it impossible
 * to route a Tema report to the people who can actually go to Tema.
 */

// ─── branches ──────────────────────────────────────────────────────────────

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  /** Where the branch operates from. */
  location: LatLng;
  /**
   * How far from that point the branch is responsible for, in metres.
   *
   * A circle is a crude stand-in for a real administrative boundary, which is a
   * polygon. It is deliberately crude for now: the shape of these boundaries is
   * a decision for each organisation, and guessing at polygons would bake in
   * borders nobody agreed to. The scoring code treats this as a hard limit, so
   * replacing it with real geometry later changes one function.
   */
  jurisdictionRadiusM: number;
  /** Human-readable area, shown instead of coordinates. */
  areaLabel: string;
}

// ─── employees ─────────────────────────────────────────────────────────────

/**
 * What someone does in the field.
 *
 * Deliberately separate from {@link OrgRole}, which is what they may do in the
 * software. A dispatcher and a field responder may both be "analyst" in
 * permission terms while being completely different people to send to a fire.
 * Collapsing the two would mean granting someone software access in order to
 * describe their job, which is how permission systems rot.
 */
export type EmployeeDuty =
  | 'field_response'
  | 'dispatch'
  | 'investigation'
  | 'inspection'
  | 'media'
  | 'community_liaison'
  | 'admin';

export type ShiftStatus = 'on_duty' | 'off_duty' | 'on_leave';

/** Languages that matter for calling a reporter back in Ghana. */
export type WorkingLanguage = 'en' | 'twi' | 'ga' | 'ewe' | 'dagbani' | 'hausa';

export interface Employee {
  id: string;
  businessId: string;
  /** Null while unassigned to a branch — they can still be routed org-wide. */
  branchId: string | null;
  displayName: string;
  email: string;
  phone: string | null;

  /** Software permissions. */
  role: OrgRole;
  /** Field responsibilities. */
  duties: EmployeeDuty[];
  /**
   * Categories this person handles.
   *
   * Empty means generalist — they are eligible for anything rather than
   * nothing. An empty list is far more likely to mean "not filled in yet" than
   * "qualified for no incident on earth", and defaulting to exclusion would
   * quietly empty an organisation's routing.
   */
  specialisations: IncidentCategory[];
  languages: WorkingLanguage[];

  shiftStatus: ShiftStatus;
  /** Assignments currently open on this person. */
  openAssignments: number;
  /** How many they can hold at once. */
  maxConcurrentAssignments: number;

  /**
   * Last position reported by their device, for field staff who share it.
   *
   * Null for office staff and for anyone who has not consented. Never inferred
   * from a branch address — a desk is not a person, and pretending otherwise
   * would send a patrol to a building.
   */
  lastKnownLocation: LatLng | null;
  lastSeenAtIso: string | null;

  /**
   * Share of assignments this person acknowledged, 0..1.
   *
   * Reliability, not productivity. Someone who never acknowledges should stop
   * receiving urgent work regardless of how close they are.
   */
  acknowledgementRate: number;

  joinedAtIso: string;
  active: boolean;
}

// ─── joining an organisation ───────────────────────────────────────────────

export type MembershipStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Someone asking to join an organisation.
 *
 * Employees sign themselves up and name their employer; the organisation
 * decides whether that is true. Self-service in both directions would let
 * anyone claim to work for the Electoral Commission and start receiving
 * election footage, so acceptance is always an act by someone already inside.
 */
export interface MembershipRequest {
  id: string;
  businessId: string;
  requestedBranchId: string | null;
  displayName: string;
  email: string;
  phone: string | null;
  /** What they say they do, pending confirmation by the organisation. */
  statedRole: string;
  /** How the account was created, for the reviewer's context. */
  signUpMethod: 'password' | 'google';
  /** True when the identity provider vouched for the address. */
  emailVerified: boolean;
  requestedAtIso: string;
  status: MembershipStatus;
  note: string | null;
}

// ─── employee submissions ──────────────────────────────────────────────────

/**
 * A report an employee sent straight to their own organisation.
 *
 * These bypass the marketplace entirely: the organisation already employs the
 * person, so there is nothing to license and no commission to pay. What matters
 * instead is attribution — an internal report is only actionable if you know
 * which of your staff filed it, so these are never anonymous.
 */
export interface InternalSubmission {
  id: string;
  businessId: string;
  employeeId: string;
  employeeName: string;
  branchId: string | null;
  category: IncidentCategory;
  summary: string;
  posterUrl: string;
  locationLabel: string | null;
  location: LatLng | null;
  capturedAtIso: string;
  submittedAtIso: string;
  status: 'new' | 'assigned' | 'resolved' | 'dismissed';
  /** Set once someone in the organisation picks it up. */
  assignedToEmployeeId: string | null;
}
