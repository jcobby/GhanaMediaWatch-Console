/**
 * Institutional onboarding.
 *
 * Registration says who is asking. Onboarding is the evidence, and it is a
 * different shape of thing: a sequence of steps an applicant works through at
 * their own pace, each one submitted and then reviewed by a platform
 * administrator before any of it counts.
 *
 * Two rules give the whole flow its shape:
 *
 *   1. **The applicant submits; the platform approves.** Completing a step
 *      never approves it. An organisation that could mark its own evidence
 *      acceptable is an organisation that has not been checked.
 *
 *   2. **Approval is per step, and the final decision is gated on all of
 *      them.** Reviewing an application as one blob means a reviewer either
 *      accepts everything or rejects everything, and the applicant is told
 *      "declined" with no idea which document was wrong.
 */

// ─── steps ─────────────────────────────────────────────────────────────────

/**
 * Onboarding collects evidence, and only evidence.
 *
 * Categories and the plan are chosen at registration, where an organisation can
 * answer them from memory in under a minute. They were once steps here too, and
 * asking twice made the first pass look pointless and the second look like the
 * form had forgotten.
 */
export type OrganisationStepId = 'organisation' | 'officer' | 'coverage' | 'documents';

/**
 * A blogger's three, as `PersonApplication.stepIds` now names them.
 *
 * `coverage` is in both sets under the same id and asks different things — an
 * organisation's operating radius, a blogger's home town. That collision is the
 * reason nothing may merge the two: a normaliser filtering a blogger's steps
 * against the organisation ids drops `identity` and `presence` silently and
 * keeps `coverage`, leaving a review panel that looks like a half-finished
 * organisation rather than a complete blogger.
 */
export type BloggerStepId = 'identity' | 'presence' | 'coverage';

export type OnboardingStepId = OrganisationStepId | BloggerStepId;

export type StepStatus =
  /** Not opened yet. */
  | 'not_started'
  /** Opened, partly filled, not sent. */
  | 'in_progress'
  /** Sent for review. The applicant can no longer edit it. */
  | 'submitted'
  /** A reviewer accepted it. */
  | 'approved'
  /** A reviewer sent it back, with a reason. */
  | 'rejected';

/** One answer a step collects, as the reviewer and the applicant both see it. */
export interface OnboardingField {
  /** The key the service stores it under. Hand-synced with the phone. */
  key: string;
  label: string;
  required: boolean;
}

export interface OnboardingStepMeta {
  id: OnboardingStepId;
  label: string;
  description: string;
  /** Documents this step expects. */
  documents: DocumentId[];
  /**
   * What the step asks for.
   *
   * Declared here rather than only in the wizard's JSX, because the reviewer
   * needs the same list: the approval panel showed a platform owner that a step
   * had been *submitted* and not one word of what it said, so an organisation's
   * legal name and its officer's ID were being approved unseen. A label that
   * lives in one client cannot be read by the other.
   */
  fields: OnboardingField[];
  /**
   * Whether a platform administrator reviews this step on its own.
   *
   * False for `documents`, which is the applicant's *submit* step: it collects
   * no answers and expects no documents of its own — the three evidence steps
   * each carry theirs. As a reviewable step it put an empty panel in the
   * reviewer's tab strip and, worse, gated the final approval on approving
   * nothing, so every application needed a fourth click that decided nothing.
   */
  requiresReview: boolean;
}


/**
 * What an application is *for*.
 *
 * `/platform/applications` returns both kinds in one queue, discriminated by
 * this — an organisation carries no `kind` at all, a blogger says `"blogger"`.
 * The reviewer's desk is the same desk; only the step set differs.
 */
export type ApplicationKind = 'organisation' | 'blogger';

/**
 * A blogger's three steps, as the phone sends them and the service now names
 * them back on `PersonApplication.stepIds`.
 *
 * **Not the organisation's four, and the difference is the point.** A blogger
 * is one person: there is no legal entity to register, no authorised officer to
 * appoint on anybody's behalf and no premises. Asking for a certificate of
 * incorporation would be asking somebody to prove they are a company.
 *
 * `coverage` appears in both sets under the same id and asks different things,
 * which is exactly why the reviewer must pick the set by kind rather than merge
 * them — see `stepsFor`.
 */
export const BLOGGER_STEPS: OnboardingStepMeta[] = [
  {
    id: 'identity',
    label: 'Who they are',
    description: 'Legal name and government ID, checked against the document attached.',
    documents: ['officer_id'],
    fields: [
      { key: 'legalName', label: 'Full legal name', required: true },
      { key: 'idNumber', label: 'Ghana Card number', required: true },
      { key: 'phone', label: 'Phone number', required: true },
    ],
    requiresReview: true,
  },
  {
    /*
     * The substance of the check.
     *
     * A Ghana Card proves who somebody is; it does not prove they are a
     * publisher. This step is what separates a verified byline from an ID
     * check, and it is the one a reviewer should spend their time on.
     */
    id: 'presence',
    label: 'Where they publish',
    description: 'The site, page or channel they already publish on, and its reach.',
    documents: [],
    fields: [
      { key: 'publicationName', label: 'Publishes as', required: true },
      { key: 'url', label: 'Site or channel', required: true },
      { key: 'audience', label: 'Followers', required: false },
      { key: 'about', label: 'What they cover', required: false },
    ],
    requiresReview: true,
  },
  {
    id: 'coverage',
    label: 'Where they report from',
    description: 'Where they are based, with something recent carrying the address.',
    documents: ['utility_bill', 'premises_proof'],
    fields: [
      { key: 'city', label: 'City or town', required: true },
      { key: 'areaLabel', label: 'Areas covered', required: false },
    ],
    requiresReview: true,
  },
];

/** The step set for one kind of application. */
export function stepsFor(kind: ApplicationKind): OnboardingStepMeta[] {
  return kind === 'blogger' ? BLOGGER_STEPS : ONBOARDING_STEPS;
}

/** The steps a reviewer decides, for one kind. */
export function reviewableStepsFor(kind: ApplicationKind): OnboardingStepMeta[] {
  return stepsFor(kind).filter((step) => step.requiresReview);
}

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  {
    id: 'organisation',
    label: 'Organisation',
    description: 'Legal name, sector and registration number.',
    documents: ['business_registration', 'tax_identification'],
    fields: [
      { key: 'legalName', label: 'Registered legal name', required: true },
      { key: 'registrationNumber', label: 'Registration number', required: true },
      { key: 'tin', label: 'Tax identification number', required: false },
    ],
    requiresReview: true,
  },
  {
    id: 'officer',
    label: 'Authorised officer',
    description: 'The person who signs for this account and their identification.',
    documents: ['officer_id', 'authorisation_letter'],
    fields: [
      { key: 'name', label: 'Full name', required: true },
      { key: 'role', label: 'Position', required: false },
      { key: 'idNumber', label: 'Ghana Card / passport', required: true },
      { key: 'phone', label: 'Direct phone', required: false },
    ],
    requiresReview: true,
  },
  {
    id: 'coverage',
    label: 'Coverage',
    description: 'Where you operate. Areas decide which incidents can reach your staff.',
    documents: ['premises_proof'],
    fields: [
      { key: 'address', label: 'Main office address', required: true },
      { key: 'city', label: 'City', required: true },
      { key: 'areaLabel', label: 'Area covered', required: false },
      { key: 'radiusKm', label: 'Operating radius (km)', required: false },
    ],
    requiresReview: true,
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Everything attached so far, and anything still missing.',
    /*
     * None of its own. Every file is asked for by the step it belongs to, so
     * this list stays empty and the review panel special-cases this step to
     * show the whole set together — see `StepReview`.
     */
    documents: [],
    // The last step collects no answers of its own; it is the paperwork.
    fields: [],
    requiresReview: true,
  },
];

/**
 * The steps a reviewer actually works through.
 *
 * **`documents` was left out, and that made every organisation unapprovable.**
 * The reasoning was that it collects no answers and asks for no files of its
 * own, so as a reviewable step it put an empty panel in the tab strip and
 * gated approval on approving nothing.
 *
 * The service does not agree, and it is the one enforcing the gate. Read off
 * the live queue on 29 September, both organisations waiting for a decision
 * sat at:
 *
 *     organisation -> approved      officer   -> approved
 *     coverage     -> approved      documents -> submitted
 *
 * while the one already-approved organisation had `documents -> approved`.
 * `POST /platform/applications/{id}/approve` answered `steps_not_approved` for
 * the other two, and the console had no control anywhere that could send that
 * decision — so it showed three green ticks, "Everything is in order", an
 * enabled Approve button, and then a server error the reviewer could do
 * nothing about. Approving those two took one `decide` call each that this
 * console could not make.
 *
 * So it is reviewed, and the empty-panel problem is solved where it belongs:
 * the panel shows every document attached to the application and anything
 * still missing, which is a genuinely useful last look before granting an
 * organisation access to footage filed by the public.
 */
export const REVIEWABLE_STEPS: OnboardingStepMeta[] = ONBOARDING_STEPS.filter(
  (step) => step.requiresReview,
);

/**
 * Every step id either kind of application can carry, as a runtime list.
 *
 * **The types said both kinds; the validators said one.** `OnboardingStepId` is
 * the union of an organisation's four and a blogger's three, but a type is gone
 * at runtime — so the two route handlers that validate a decision each wrote
 * their own `z.enum(['organisation', 'officer', 'coverage', 'documents'])`,
 * copied from the organisation list, and nothing connected them to the union
 * they were supposed to be enforcing.
 *
 * The result was a blogger who could be reviewed on screen and never decided.
 * Approving their first step sent `stepId: 'identity'`, the enum rejected it
 * with *"Invalid enum value. Expected 'organisation' | 'officer' | 'coverage' |
 * 'documents', received 'identity'"*, and the reviewer was shown a Zod parser
 * error about an enum they had no way to know existed. Every blogger
 * application was undecidable, and the message explained nothing.
 *
 * Derived from the step lists rather than typed out again, because a third
 * hand-written copy is how this happened in the first place. `Set` because
 * `coverage` is in both.
 */
export const ALL_STEP_IDS: OnboardingStepId[] = [
  ...new Set([...ONBOARDING_STEPS, ...BLOGGER_STEPS].map((step) => step.id)),
];

// ─── documents ─────────────────────────────────────────────────────────────

export type DocumentId =
  | 'business_registration'
  | 'tax_identification'
  | 'officer_id'
  | 'authorisation_letter'
  | 'premises_proof'
  | 'utility_bill'
  | 'lease_agreement';

export interface DocumentRequirement {
  id: DocumentId;
  label: string;
  hint: string;
  required: boolean;
  /**
   * Documents that satisfy the same requirement.
   *
   * A lease and a utility bill both prove occupancy, and demanding both is how
   * an application stalls on paperwork that adds nothing. Any one member of a
   * group satisfies it.
   */
  alternativeGroup?: string;
}

export const DOCUMENT_REQUIREMENTS: Record<DocumentId, DocumentRequirement> = {
  business_registration: {
    id: 'business_registration',
    label: 'Certificate of incorporation',
    hint: 'Or the equivalent registration document for a public body.',
    required: true,
  },
  tax_identification: {
    id: 'tax_identification',
    label: 'Tax identification',
    hint: 'TIN certificate.',
    required: true,
  },
  officer_id: {
    id: 'officer_id',
    label: 'Photo ID of the authorised officer',
    hint: 'Ghana Card, passport or driver’s licence.',
    required: true,
  },
  authorisation_letter: {
    id: 'authorisation_letter',
    label: 'Letter of authorisation',
    hint: 'On letterhead, confirming this person may act for the organisation.',
    required: true,
  },
  premises_proof: {
    id: 'premises_proof',
    label: 'Proof of premises',
    hint: 'A lease agreement or a recent utility bill. Either one satisfies this.',
    required: true,
    alternativeGroup: 'premises',
  },
  lease_agreement: {
    id: 'lease_agreement',
    label: 'Lease or tenancy agreement',
    hint: 'For the address you gave.',
    required: false,
    alternativeGroup: 'premises',
  },
  utility_bill: {
    id: 'utility_bill',
    label: 'Recent utility bill',
    hint: 'Within the last three months.',
    required: false,
    alternativeGroup: 'premises',
  },
};

export interface UploadedDocument {
  id: DocumentId;
  fileName: string;
  uploadedAtIso: string;
  /** Set once a reviewer has looked at this specific file. */
  reviewedOk: boolean | null;
}

// ─── the application ───────────────────────────────────────────────────────

export interface StepState {
  id: OnboardingStepId;
  status: StepStatus;
  /** Set when a reviewer sends it back. */
  rejectionReason: string | null;
  submittedAtIso: string | null;
  reviewedAtIso: string | null;
  reviewedBy: string | null;
}

export interface OnboardingApplication {
  /**
   * Organisation or blogger.
   *
   * Optional, and absent reads as `organisation` — an application written
   * before this existed, and the service's own payload for an organisation,
   * both carry no `kind` at all. The gates below branch on it, so a wrong
   * default is not cosmetic: reading a blogger as an organisation asks them to
   * approve an `officer` step they never had, and the application can never be
   * approved at all.
   */
  kind?: ApplicationKind;
  /** Quoted in every email about this application. */
  reference: string;
  businessId: string;
  organisationName: string;
  steps: StepState[];
  documents: UploadedDocument[];
  /** Sanctions and adverse-media check on the organisation and its officer. */
  screeningRunAtIso: string | null;
  screeningClear: boolean | null;
  submittedAtIso: string | null;
  approvedAtIso: string | null;
}

export function stepState(application: OnboardingApplication, id: OnboardingStepId): StepState {
  return (
    application.steps.find((s) => s.id === id) ?? {
      id,
      status: 'not_started',
      rejectionReason: null,
      submittedAtIso: null,
      reviewedAtIso: null,
      reviewedBy: null,
    }
  );
}

/** Steps done from the applicant's side — submitted counts, rejected does not. */
export function completedByApplicant(application: OnboardingApplication): number {
  return ONBOARDING_STEPS.filter((meta) => {
    const status = stepState(application, meta.id).status;
    return status === 'submitted' || status === 'approved';
  }).length;
}

/** Progress across the whole wizard, 0..1. */
export function applicantProgress(application: OnboardingApplication): number {
  return completedByApplicant(application) / ONBOARDING_STEPS.length;
}

/**
 * The next step the applicant should open.
 *
 * A rejected step jumps the queue, because everything after it may depend on
 * the thing that was wrong, and leaving it buried behind later steps is how an
 * application sits untouched for a fortnight.
 */
export function nextStepFor(application: OnboardingApplication): OnboardingStepId | null {
  const rejected = ONBOARDING_STEPS.find(
    (meta) => stepState(application, meta.id).status === 'rejected',
  );
  if (rejected) return rejected.id;

  const outstanding = ONBOARDING_STEPS.find((meta) => {
    const status = stepState(application, meta.id).status;
    return status === 'not_started' || status === 'in_progress';
  });
  return outstanding?.id ?? null;
}

// ─── documents ─────────────────────────────────────────────────────────────

/** Whether a requirement is satisfied, counting alternatives. */
export function documentSatisfied(application: OnboardingApplication, id: DocumentId): boolean {
  const requirement = DOCUMENT_REQUIREMENTS[id];
  const uploaded = new Set(application.documents.map((d) => d.id));

  if (uploaded.has(id)) return true;
  if (!requirement.alternativeGroup) return false;

  return Object.values(DOCUMENT_REQUIREMENTS).some(
    (other) => other.alternativeGroup === requirement.alternativeGroup && uploaded.has(other.id),
  );
}

/** Required documents still missing, as ids. */
export function missingDocuments(application: OnboardingApplication): DocumentId[] {
  return Object.values(DOCUMENT_REQUIREMENTS)
    .filter(
      (requirement) => requirement.required && !documentSatisfied(application, requirement.id),
    )
    .map((requirement) => requirement.id);
}

// ─── gates ─────────────────────────────────────────────────────────────────

export type SubmitProblem = 'steps_outstanding' | 'documents_missing' | 'already_submitted';

/** Why the applicant cannot submit yet, or null when they can. */
export function submitProblem(application: OnboardingApplication): SubmitProblem | null {
  if (application.submittedAtIso) return 'already_submitted';

  const outstanding = ONBOARDING_STEPS.some((meta) => {
    const status = stepState(application, meta.id).status;
    return status !== 'submitted' && status !== 'approved';
  });
  if (outstanding) return 'steps_outstanding';

  if (missingDocuments(application).length > 0) return 'documents_missing';
  return null;
}

export type ApprovalProblem =
  | 'not_submitted'
  | 'steps_not_approved'
  | 'screening_not_run'
  | 'screening_not_clear'
  | 'already_approved';

/**
 * Why an administrator cannot approve yet, or null when they can.
 *
 * Every step approved *and* screening run and clear. Approval is what grants
 * an organisation access to footage of the public, so it is the one decision
 * in the product that no single click should be able to reach.
 */
export function approvalProblem(application: OnboardingApplication): ApprovalProblem | null {
  if (application.approvedAtIso) return 'already_approved';
  if (!application.submittedAtIso) return 'not_submitted';

  /*
   * The steps this application actually has.
   *
   * Hardcoding the organisation's set here made a blogger unapprovable: their
   * `organisation` and `officer` steps do not exist, so they could never reach
   * `approved` and this returned `steps_not_approved` forever — a dead end one
   * layer below the desk, where nothing on screen would have explained it.
   */
  const unapproved = reviewableStepsFor(application.kind ?? 'organisation').some(
    (meta) => stepState(application, meta.id).status !== 'approved',
  );
  if (unapproved) return 'steps_not_approved';

  if (application.screeningRunAtIso === null) return 'screening_not_run';
  if (application.screeningClear !== true) return 'screening_not_clear';

  return null;
}

/** Everything an administrator still has to do, in order. */
export function outstandingForApproval(application: OnboardingApplication): string[] {
  const out: string[] = [];
  for (const meta of reviewableStepsFor(application.kind ?? 'organisation')) {
    if (stepState(application, meta.id).status !== 'approved') {
      out.push(`Review and approve the ${meta.label} step.`);
    }
  }
  if (application.screeningRunAtIso === null)
    out.push('Run sanctions and adverse-media screening.');
  else if (application.screeningClear !== true) out.push('Screening returned a hit. Escalate it.');
  return out;
}

/** Reference like ONB-ORG-000042, quoted in every email about the application. */
export function onboardingReference(sequence: number): string {
  return `ONB-ORG-${String(Math.max(1, Math.floor(sequence))).padStart(6, '0')}`;
}
