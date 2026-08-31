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
export type OnboardingStepId = 'organisation' | 'officer' | 'coverage' | 'documents';

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

export interface OnboardingStepMeta {
  id: OnboardingStepId;
  label: string;
  description: string;
  /** Documents this step expects. */
  documents: DocumentId[];
}

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  {
    id: 'organisation',
    label: 'Organisation',
    description: 'Legal name, sector and registration number.',
    documents: ['business_registration', 'tax_identification'],
  },
  {
    id: 'officer',
    label: 'Authorised officer',
    description: 'The person who signs for this account and their identification.',
    documents: ['officer_id', 'authorisation_letter'],
  },
  {
    id: 'coverage',
    label: 'Coverage',
    description: 'Where you operate. Areas decide which incidents can reach your staff.',
    documents: ['premises_proof'],
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Everything attached so far, and anything still missing.',
    documents: [],
  },
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

  const unapproved = ONBOARDING_STEPS.some(
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
  for (const meta of ONBOARDING_STEPS) {
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
