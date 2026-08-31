import { placeholderImage } from '../lib/placeholder';
import type { Invite, OrgAffiliation } from '../types/affiliation';
import type { EditorialCase } from '../logic/editorial';
import { onboardingReference, type OnboardingApplication } from '../logic/onboarding';
import type { Branch, Employee, InternalSubmission, MembershipRequest } from '../types/org';

/**
 * Seeded branches, staff and join requests.
 *
 * Built around one organisation — the Accra Metropolitan Assembly — with enough
 * variety in the staff list that the assignment scoring has something real to
 * decide between: people on and off shift, specialists and generalists, someone
 * at capacity, someone unreliable, and two branches whose jurisdictions do not
 * overlap. A staff list where everyone is identical proves nothing.
 */

const minutesAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString();
const daysAgo = (d: number): string => new Date(Date.now() - d * 86_400_000).toISOString();

export const BRANCHES: Branch[] = [
  {
    id: 'br_ama_central',
    businessId: 'biz_ama',
    name: 'Central Sub-Metro',
    location: { latitude: 5.5563, longitude: -0.1969 },
    // Greater Accra Metropolitan reaches Spintex and Achimota but not Adenta,
    // which is its own municipal assembly — the gate is meant to model real
    // authority, not an arbitrary circle.
    jurisdictionRadiusM: 15_000,
    areaLabel: 'Accra Central',
  },
  {
    id: 'br_ama_ablekuma',
    businessId: 'biz_ama',
    name: 'Ablekuma Sub-Metro',
    location: { latitude: 5.59, longitude: -0.27 },
    jurisdictionRadiusM: 10_000,
    areaLabel: 'Ablekuma',
  },
  {
    id: 'br_ecg_east',
    businessId: 'biz_ecg',
    name: 'Accra East District',
    location: { latitude: 5.66, longitude: -0.18 },
    // A distribution utility follows its network, not a council boundary, so
    // its district reaches well past any one assembly.
    jurisdictionRadiusM: 30_000,
    areaLabel: 'Accra East',
  },
  {
    id: 'br_nadmo_gar',
    businessId: 'biz_nadmo',
    name: 'Greater Accra Regional Office',
    location: { latitude: 5.6037, longitude: -0.187 },
    // A national disaster body operates across the whole region, which is what
    // makes it the organisation of last resort when a sub-metro cannot act.
    jurisdictionRadiusM: 40_000,
    areaLabel: 'Greater Accra Region',
  },
  {
    id: 'br_joy_newsroom',
    businessId: 'biz_joy',
    name: 'Kokomlemle Newsroom',
    location: { latitude: 5.572, longitude: -0.209 },
    jurisdictionRadiusM: 25_000,
    areaLabel: 'Greater Accra',
  },
];

export const EMPLOYEES: Employee[] = [
  {
    id: 'emp_ama_01',
    businessId: 'biz_ama',
    branchId: 'br_ama_central',
    displayName: 'Ama Serwaa',
    email: 'a.serwaa@ama.gov.gh',
    phone: '+233 20 111 0001',
    role: 'dispatcher',
    duties: ['dispatch', 'field_response'],
    specialisations: ['flood', 'infrastructure'],
    languages: ['en', 'twi'],
    shiftStatus: 'on_duty',
    openAssignments: 1,
    maxConcurrentAssignments: 6,
    lastKnownLocation: { latitude: 5.559, longitude: -0.199 },
    lastSeenAtIso: minutesAgo(4),
    acknowledgementRate: 0.94,
    joinedAtIso: daysAgo(420),
    active: true,
  },
  {
    id: 'emp_ama_02',
    businessId: 'biz_ama',
    branchId: 'br_ama_central',
    displayName: 'Kwabena Osei',
    email: 'k.osei@ama.gov.gh',
    phone: '+233 20 111 0002',
    role: 'analyst',
    duties: ['inspection'],
    specialisations: ['fire', 'health', 'accident'],
    languages: ['en', 'ga'],
    shiftStatus: 'on_duty',
    openAssignments: 0,
    maxConcurrentAssignments: 4,
    lastKnownLocation: { latitude: 5.5501, longitude: -0.211 },
    lastSeenAtIso: minutesAgo(11),
    acknowledgementRate: 0.88,
    joinedAtIso: daysAgo(300),
    active: true,
  },
  {
    id: 'emp_ama_03',
    businessId: 'biz_ama',
    branchId: 'br_ama_ablekuma',
    displayName: 'Efua Mensah',
    email: 'e.mensah@ama.gov.gh',
    phone: '+233 20 111 0003',
    role: 'analyst',
    duties: ['field_response', 'community_liaison'],
    specialisations: [],
    languages: ['en', 'twi', 'ewe'],
    shiftStatus: 'on_duty',
    openAssignments: 2,
    maxConcurrentAssignments: 5,
    lastKnownLocation: { latitude: 5.592, longitude: -0.268 },
    lastSeenAtIso: minutesAgo(2),
    acknowledgementRate: 0.97,
    joinedAtIso: daysAgo(180),
    active: true,
  },
  {
    id: 'emp_ama_04',
    businessId: 'biz_ama',
    branchId: 'br_ama_central',
    displayName: 'Yaw Boateng',
    email: 'y.boateng@ama.gov.gh',
    phone: null,
    role: 'viewer',
    duties: ['field_response'],
    specialisations: ['flood'],
    languages: ['en'],
    // At capacity — the nearest person is not always an available one.
    shiftStatus: 'on_duty',
    openAssignments: 5,
    maxConcurrentAssignments: 5,
    lastKnownLocation: { latitude: 5.557, longitude: -0.1975 },
    lastSeenAtIso: minutesAgo(7),
    acknowledgementRate: 0.62,
    joinedAtIso: daysAgo(95),
    active: true,
  },
  {
    id: 'emp_ama_05',
    businessId: 'biz_ama',
    branchId: 'br_ama_central',
    displayName: 'Adjoa Nyarko',
    email: 'a.nyarko@ama.gov.gh',
    phone: '+233 20 111 0005',
    role: 'admin',
    duties: ['admin', 'dispatch'],
    specialisations: [],
    languages: ['en'],
    // Off shift — deliberately close to the seeded incidents, so the gate is
    // demonstrable rather than theoretical.
    shiftStatus: 'off_duty',
    openAssignments: 0,
    maxConcurrentAssignments: 8,
    lastKnownLocation: { latitude: 5.5566, longitude: -0.1971 },
    lastSeenAtIso: minutesAgo(240),
    acknowledgementRate: 0.91,
    joinedAtIso: daysAgo(600),
    active: true,
  },
  {
    id: 'emp_ecg_01',
    businessId: 'biz_ecg',
    branchId: 'br_ecg_east',
    displayName: 'Daniel Ofori',
    email: 'd.ofori@ecg.com.gh',
    phone: '+233 27 777 0001',
    role: 'analyst',
    duties: ['field_response', 'inspection'],
    specialisations: ['utility', 'infrastructure'],
    languages: ['en', 'twi'],
    shiftStatus: 'on_duty',
    openAssignments: 2,
    maxConcurrentAssignments: 6,
    lastKnownLocation: { latitude: 5.701, longitude: -0.172 },
    lastSeenAtIso: minutesAgo(6),
    acknowledgementRate: 0.92,
    joinedAtIso: daysAgo(330),
    active: true,
  },
  {
    id: 'emp_ecg_02',
    businessId: 'biz_ecg',
    branchId: 'br_ecg_east',
    displayName: 'Comfort Aidoo',
    email: 'c.aidoo@ecg.com.gh',
    phone: '+233 27 777 0002',
    role: 'dispatcher',
    duties: ['dispatch'],
    specialisations: ['utility'],
    languages: ['en', 'ga'],
    shiftStatus: 'on_duty',
    openAssignments: 1,
    maxConcurrentAssignments: 10,
    // Desk-based, so no shared position — she still ranks on speciality and
    // her district covering the fault.
    lastKnownLocation: null,
    lastSeenAtIso: minutesAgo(14),
    acknowledgementRate: 0.87,
    joinedAtIso: daysAgo(410),
    active: true,
  },
  {
    id: 'emp_nadmo_01',
    businessId: 'biz_nadmo',
    branchId: 'br_nadmo_gar',
    displayName: 'Isaac Tetteh',
    email: 'i.tetteh@nadmo.gov.gh',
    phone: '+233 24 333 0001',
    role: 'dispatcher',
    duties: ['dispatch', 'field_response'],
    // A disaster responder is a generalist by definition — the emergency
    // decides what they attend, not a declared speciality.
    specialisations: [],
    languages: ['en', 'twi', 'ga'],
    shiftStatus: 'on_duty',
    openAssignments: 1,
    maxConcurrentAssignments: 8,
    lastKnownLocation: { latitude: 5.612, longitude: -0.14 },
    lastSeenAtIso: minutesAgo(3),
    acknowledgementRate: 0.96,
    joinedAtIso: daysAgo(510),
    active: true,
  },
  {
    id: 'emp_nadmo_02',
    businessId: 'biz_nadmo',
    branchId: 'br_nadmo_gar',
    displayName: 'Grace Amponsah',
    email: 'g.amponsah@nadmo.gov.gh',
    phone: '+233 24 333 0002',
    role: 'analyst',
    duties: ['field_response'],
    specialisations: ['flood', 'fire'],
    languages: ['en', 'twi'],
    shiftStatus: 'on_duty',
    openAssignments: 3,
    maxConcurrentAssignments: 6,
    lastKnownLocation: { latitude: 5.598, longitude: -0.22 },
    lastSeenAtIso: minutesAgo(26),
    acknowledgementRate: 0.79,
    joinedAtIso: daysAgo(200),
    active: true,
  },
  {
    id: 'emp_nadmo_03',
    businessId: 'biz_nadmo',
    branchId: 'br_nadmo_gar',
    displayName: 'Mohammed Sulley',
    email: 'm.sulley@nadmo.gov.gh',
    phone: null,
    role: 'viewer',
    duties: ['community_liaison'],
    specialisations: [],
    languages: ['en', 'hausa', 'dagbani'],
    shiftStatus: 'on_duty',
    openAssignments: 0,
    maxConcurrentAssignments: 4,
    // No shared position — proves the ranking still works without one.
    lastKnownLocation: null,
    lastSeenAtIso: minutesAgo(52),
    acknowledgementRate: 0.9,
    joinedAtIso: daysAgo(140),
    active: true,
  },
  {
    id: 'emp_joy_01',
    businessId: 'biz_joy',
    branchId: 'br_joy_newsroom',
    displayName: 'Nii Armah',
    email: 'n.armah@joynews.gh',
    phone: '+233 24 222 0001',
    role: 'analyst',
    duties: ['media', 'investigation'],
    specialisations: ['corruption', 'disorder'],
    languages: ['en', 'ga'],
    shiftStatus: 'on_duty',
    openAssignments: 1,
    maxConcurrentAssignments: 5,
    lastKnownLocation: { latitude: 5.574, longitude: -0.205 },
    lastSeenAtIso: minutesAgo(18),
    acknowledgementRate: 0.85,
    joinedAtIso: daysAgo(240),
    active: true,
  },
];

export const MEMBERSHIP_REQUESTS: MembershipRequest[] = [
  {
    id: 'mem_01',
    businessId: 'biz_ama',
    requestedBranchId: 'br_ama_ablekuma',
    displayName: 'Kofi Antwi',
    email: 'kofi.antwi@gmail.com',
    phone: '+233 26 555 0101',
    statedRole: 'Sanitation inspector, Ablekuma',
    signUpMethod: 'google',
    emailVerified: true,
    requestedAtIso: minutesAgo(45),
    status: 'pending',
    note: 'Joined the sanitation team last month.',
  },
  {
    id: 'mem_02',
    businessId: 'biz_ama',
    requestedBranchId: 'br_ama_central',
    displayName: 'Abena Owusu',
    email: 'a.owusu@ama.gov.gh',
    phone: null,
    statedRole: 'Drainage engineer',
    signUpMethod: 'password',
    emailVerified: false,
    requestedAtIso: minutesAgo(310),
    status: 'pending',
    note: null,
  },
  {
    id: 'mem_03',
    businessId: 'biz_joy',
    requestedBranchId: 'br_joy_newsroom',
    displayName: 'Selorm Agbo',
    email: 'selorm.agbo@gmail.com',
    phone: '+233 27 444 0202',
    statedRole: 'Field reporter',
    signUpMethod: 'google',
    emailVerified: true,
    requestedAtIso: minutesAgo(1_200),
    status: 'pending',
    note: null,
  },
];

export const INTERNAL_SUBMISSIONS: InternalSubmission[] = [
  {
    id: 'int_01',
    businessId: 'biz_ama',
    employeeId: 'emp_ama_03',
    employeeName: 'Efua Mensah',
    branchId: 'br_ama_ablekuma',
    category: 'infrastructure',
    summary: 'Drain cover missing outside the Ablekuma market entrance. Two near misses today.',
    posterUrl: placeholderImage('int-1', 'infrastructure', {
      width: 720,
      height: 1280,
    }),
    locationLabel: 'Ablekuma, Accra',
    location: { latitude: 5.5905, longitude: -0.2695 },
    capturedAtIso: minutesAgo(70),
    submittedAtIso: minutesAgo(64),
    status: 'new',
    assignedToEmployeeId: null,
  },
  {
    id: 'int_02',
    businessId: 'biz_ama',
    employeeId: 'emp_ama_02',
    employeeName: 'Kwabena Osei',
    branchId: 'br_ama_central',
    category: 'health',
    summary: 'Refuse piling up behind the lorry station. Flies and standing water.',
    posterUrl: placeholderImage('int-2', 'health', {
      width: 720,
      height: 1280,
    }),
    locationLabel: 'Accra Central',
    location: { latitude: 5.551, longitude: -0.21 },
    capturedAtIso: minutesAgo(200),
    submittedAtIso: minutesAgo(190),
    status: 'assigned',
    assignedToEmployeeId: 'emp_ama_01',
  },
];

/** Staff of one organisation, active first. */
export function employeesOf(businessId: string): Employee[] {
  return EMPLOYEES.filter((e) => e.businessId === businessId);
}

export function branchesOf(businessId: string): Branch[] {
  return BRANCHES.filter((b) => b.businessId === businessId);
}

export function pendingMembershipsOf(businessId: string): MembershipRequest[] {
  return MEMBERSHIP_REQUESTS.filter((m) => m.businessId === businessId && m.status === 'pending');
}

export function internalSubmissionsOf(businessId: string): InternalSubmission[] {
  return INTERNAL_SUBMISSIONS.filter((s) => s.businessId === businessId);
}

// ─── invites and affiliations ──────────────────────────────────────────────

export const INVITES: Invite[] = [
  {
    token: 'inv_ama_team_7fk2',
    businessId: 'biz_ama',
    kind: 'employee',
    createdByEmployeeId: 'emp_ama_05',
    createdAtIso: daysAgo(3),
    expiresAtIso: new Date(Date.now() + 11 * 86_400_000).toISOString(),
    maxUses: null,
    usedCount: 4,
    revokedAtIso: null,
    presetBranchId: 'br_ama_central',
    presetRole: 'viewer',
    presetDuties: ['field_response'],
    note: 'Sanitation team — Central Sub-Metro',
  },
  {
    token: 'inv_ama_agent_9dq1',
    businessId: 'biz_ama',
    kind: 'agent',
    createdByEmployeeId: 'emp_ama_05',
    createdAtIso: daysAgo(9),
    expiresAtIso: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    maxUses: 10,
    usedCount: 10,
    revokedAtIso: null,
    presetBranchId: null,
    presetRole: 'viewer',
    presetDuties: ['community_liaison'],
    note: 'Zoomlion supervisors',
  },
  {
    token: 'inv_joy_org_3mx8',
    businessId: 'biz_joy',
    kind: 'affiliate_org',
    createdByEmployeeId: 'emp_joy_01',
    createdAtIso: daysAgo(1),
    expiresAtIso: new Date(Date.now() + 29 * 86_400_000).toISOString(),
    maxUses: 1,
    usedCount: 0,
    revokedAtIso: null,
    presetBranchId: null,
    presetRole: 'viewer',
    presetDuties: [],
    note: 'Regional stringer network',
  },
];

export const ORG_AFFILIATIONS: OrgAffiliation[] = [
  {
    id: 'aff_1',
    parentBusinessId: 'biz_ama',
    affiliateBusinessId: 'biz_nadmo',
    kind: 'partner',
    // Partners of equal standing: neither reads the other's inbox.
    sharesReports: false,
    status: 'active',
    createdAtIso: daysAgo(120),
    endedAtIso: null,
  },
  {
    id: 'aff_2',
    parentBusinessId: 'biz_star',
    affiliateBusinessId: 'biz_ecg',
    kind: 'agent',
    // An insurer that can see what its assessing agent licensed.
    sharesReports: true,
    status: 'active',
    createdAtIso: daysAgo(60),
    endedAtIso: null,
  },
  {
    id: 'aff_3',
    parentBusinessId: 'biz_joy',
    affiliateBusinessId: 'biz_ec',
    kind: 'partner',
    sharesReports: false,
    status: 'pending',
    createdAtIso: daysAgo(2),
    endedAtIso: null,
  },
];

export function invitesOf(businessId: string): Invite[] {
  return INVITES.filter((i) => i.businessId === businessId);
}

// ─── editorial cases ───────────────────────────────────────────────────────

/**
 * Editorial work in progress, keyed by incident.
 *
 * Deliberately uneven: one case barely started, one with the source reached and
 * partial corroboration, one already decided. A fixture set where every case is
 * at the same stage cannot show whether the workbench handles the hard ones.
 */
export const EDITORIAL_CASES: EditorialCase[] = [
  {
    incidentId: 'inc_01JBX7R4M2',
    assignedToEditorName: 'Nana Adjei',
    corroboration: {
      completed: ['source_contacted', 'landmark_match'],
      notes: 'Reporter says traffic was already backed up when she arrived.',
    },
    contacts: [
      {
        id: 'sc_1',
        attemptedAtIso: minutesAgo(95),
        method: 'call',
        outcome: 'no_answer',
        note: null,
        byEditorName: 'Nana Adjei',
      },
      {
        id: 'sc_2',
        attemptedAtIso: minutesAgo(48),
        method: 'call',
        outcome: 'reached',
        note: 'Confirmed she filmed it herself and was not involved.',
        byEditorName: 'Nana Adjei',
      },
    ],
    notes: [
      {
        id: 'en_1',
        authorName: 'Nana Adjei',
        body: 'Waiting on MTTD for the incident log before going further.',
        createdAtIso: minutesAgo(40),
      },
    ],
    decisions: [
      {
        id: 'dr_1',
        from: 'received_unreviewed',
        to: 'integrity_passed',
        editorName: 'Automated checks',
        reason: 'Signature valid, clock within tolerance, fix accurate to 8m.',
        decidedAtIso: minutesAgo(110),
      },
      {
        id: 'dr_2',
        from: 'integrity_passed',
        to: 'corroboration_in_progress',
        editorName: 'Nana Adjei',
        reason: 'Picked up for verification — road incident with injury claim.',
        decidedAtIso: minutesAgo(100),
      },
    ],
    redactionApplied: false,
  },
];

export function editorialCaseFor(incidentId: string): EditorialCase | null {
  return EDITORIAL_CASES.find((c) => c.incidentId === incidentId) ?? null;
}

// ─── onboarding applications ───────────────────────────────────────────────

/**
 * One application mid-review.
 *
 * Deliberately uneven: two steps approved, one sent back, one awaiting review,
 * two untouched, and screening not yet run. An application where every step is
 * in the same state cannot show whether the review screen handles the case a
 * reviewer actually meets.
 */
export const ONBOARDING_APPLICATIONS: OnboardingApplication[] = [
  {
    reference: onboardingReference(1),
    businessId: 'biz_gwcl',
    organisationName: 'Ghana Water Company Limited',
    steps: [
      {
        id: 'organisation',
        status: 'approved',
        rejectionReason: null,
        submittedAtIso: minutesAgo(400),
        reviewedAtIso: minutesAgo(300),
        reviewedBy: 'Platform Operations',
      },
      {
        id: 'officer',
        status: 'rejected',
        rejectionReason: 'The authorisation letter is unsigned.',
        submittedAtIso: minutesAgo(380),
        reviewedAtIso: minutesAgo(290),
        reviewedBy: 'Platform Operations',
      },
      {
        id: 'coverage',
        status: 'approved',
        rejectionReason: null,
        submittedAtIso: minutesAgo(360),
        reviewedAtIso: minutesAgo(280),
        reviewedBy: 'Platform Operations',
      },
      {
        id: 'documents',
        status: 'submitted',
        rejectionReason: null,
        submittedAtIso: minutesAgo(120),
        reviewedAtIso: null,
        reviewedBy: null,
      },
    ],
    documents: [
      {
        id: 'business_registration',
        fileName: 'gwcl-incorporation.pdf',
        uploadedAtIso: minutesAgo(400),
        reviewedOk: true,
      },
      {
        id: 'tax_identification',
        fileName: 'gwcl-tin.pdf',
        uploadedAtIso: minutesAgo(400),
        reviewedOk: true,
      },
      {
        id: 'officer_id',
        fileName: 'adjei-ghanacard.jpg',
        uploadedAtIso: minutesAgo(380),
        reviewedOk: null,
      },
      {
        id: 'lease_agreement',
        fileName: 'head-office-lease.pdf',
        uploadedAtIso: minutesAgo(360),
        reviewedOk: true,
      },
    ],
    screeningRunAtIso: null,
    screeningClear: null,
    submittedAtIso: null,
    approvedAtIso: null,
  },
];
