import {
  DOCUMENT_REQUIREMENTS,
  stepsFor,
  type ApplicationKind,
  type DocumentId,
  type OnboardingApplication,
  type OnboardingStepId,
  type StepState,
  type UploadedDocument,
} from '@dawuro/core';

/**
 * `GET /org/onboarding` and `GET /platform/applications`, in the shape the
 * wizard and the review panel read.
 *
 * **Why a translation exists at all.** Neither endpoint publishes a response
 * schema, and the service does not send what `OnboardingApplication` describes:
 * steps arrive as a *map* keyed by step id, each carrying the answers under
 * `payload` and a sent-back reason under `rejectionNote`. Handed straight to the
 * wizard, `application.steps.find` is not a function and the page crashes.
 * Observed against the live service on 15 September:
 *
 *     { "id": "onb_…", "orgId": "org_…", "reference": "ONB-ORG-000002",
 *       "steps": { "organisation": { "status": "submitted",
 *                  "payload": { "legalName": "…" }, "updatedAtIso": "…",
 *                  "rejectionNote": null } },
 *       "stepsView": { …every step, including not_started… },
 *       "documents": [{ "id": "business_registration", "fileName": "…",
 *                       "sha256": "…", "uploadedAtIso": "…" }],
 *       "submittedAtIso": null, "approvedAtIso": null, … }
 *
 * Pure, and free of `server-only`, so the tests can feed it that payload.
 */

/**
 * A reviewable application: the wizard's shape, the id the platform routes
 * take, and the answers the applicant gave.
 *
 * `payloads` is part of it rather than a second argument because a reviewer
 * deciding a step needs what was submitted in front of them. Passing only the
 * application is what produced a review panel that could say a step had been
 * *sent* and nothing about what it said.
 */
export type ReviewableApplication = OnboardingApplication & {
  id: string;
  payloads?: OnboardingView['payloads'];
  /**
   * Organisation or blogger.
   *
   * `/platform/applications` returns both in one queue and discriminates on
   * `kind` — absent for an organisation, `"blogger"` for a person. Everything
   * downstream branches on this, because the two share a desk and not a step
   * set.
   */
  kind: ApplicationKind;
};

export interface OnboardingView {
  application: ReviewableApplication;
  /**
   * What the applicant already entered, per step.
   *
   * Kept whole rather than narrowed to the wizard's fields, because the
   * organisation step also carries what registration collected — interests,
   * plan, phone — and saving the step again must not erase it.
   */
  payloads: Partial<Record<OnboardingStepId, Record<string, unknown>>>;
}

/**
 * The ids each kind of application may carry.
 *
 * **Per kind, not one merged set.** `coverage` belongs to both and asks
 * different things, so a single set filtered a blogger's steps down to that one
 * — dropping `identity` and `presence` without a word and rendering a complete
 * application as a half-finished organisation.
 */
const stepIdsFor = (kind: ApplicationKind) => new Set<string>(stepsFor(kind).map((s) => s.id));

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

/**
 * A step status in the wizard's vocabulary.
 *
 * `accepted` and `returned` are read as well as the wizard's own words, because
 * the decide endpoint documents no body and the reviewer's side of this has not
 * been observed yet. Anything unrecognised is `in_progress`: never `approved`,
 * which would tell an applicant a step passed review when nobody said so.
 */
function statusOf(value: unknown): StepState['status'] {
  switch (value) {
    case 'not_started':
    case 'in_progress':
    case 'submitted':
    case 'approved':
    case 'rejected':
      return value;
    case 'accepted':
      return 'approved';
    case 'returned':
    case 'sent_back':
      return 'rejected';
    default:
      return 'in_progress';
  }
}

export function normaliseOnboarding(raw: unknown, fallbackName = ''): OnboardingView {
  const source: Loose = isRecord(raw) ? raw : {};

  /*
   * The service says which this is; an organisation says nothing at all.
   *
   * Read before anything else, because every branch below depends on it.
   */
  const kind: ApplicationKind = source.kind === 'blogger' ? 'blogger' : 'organisation';
  const STEP_IDS = stepIdsFor(kind);

  // `stepsView` lists every step; `steps` only those touched. Either may be a
  // map or, from an older build, a list.
  const stepSource = source.stepsView ?? source.steps;
  const entries: [string, Loose][] = Array.isArray(stepSource)
    ? stepSource.filter(isRecord).map((step) => [String(step.id ?? ''), step])
    : isRecord(stepSource)
      ? Object.entries(stepSource).filter((entry): entry is [string, Loose] => isRecord(entry[1]))
      : [];

  const steps: StepState[] = [];
  const payloads: OnboardingView['payloads'] = {};

  for (const [id, step] of entries) {
    if (!STEP_IDS.has(id)) continue;
    const status = statusOf(step.status);
    const sent = status === 'submitted' || status === 'approved' || status === 'rejected';

    steps.push({
      id: id as OnboardingStepId,
      status,
      rejectionReason: text(step.rejectionNote) ?? text(step.rejectionReason),
      submittedAtIso: text(step.submittedAtIso) ?? (sent ? text(step.updatedAtIso) : null),
      reviewedAtIso: text(step.reviewedAtIso) ?? text(step.decidedAtIso),
      reviewedBy: text(step.reviewedBy) ?? text(step.decidedBy),
    });
    if (isRecord(step.payload)) payloads[id as OnboardingStepId] = step.payload;
  }

  const documents: UploadedDocument[] = (Array.isArray(source.documents) ? source.documents : [])
    .filter(isRecord)
    // A document type this console does not know has no slot to show it in.
    .filter((document) => typeof document.id === 'string' && document.id in DOCUMENT_REQUIREMENTS)
    .map((document) => ({
      id: document.id as DocumentId,
      fileName: text(document.fileName) ?? 'Attached file',
      uploadedAtIso: text(document.uploadedAtIso) ?? '',
      reviewedOk: typeof document.reviewedOk === 'boolean' ? document.reviewedOk : null,
    }));

  const organisation = isRecord(source.organisation) ? source.organisation : {};

  return {
    application: {
      id: text(source.id) ?? text(source.applicationId) ?? '',
      kind,
      reference: text(source.reference) ?? '',
      // A blogger has no organisation; `userId` is the party this is about.
      businessId: text(source.orgId) ?? text(source.userId) ?? '',
      /*
       * Whose application this is, in the one place a reviewer reads first.
       *
       * A `PersonApplication` carries no name field at all — only `userId` and
       * a reference — so the name has to come out of the `identity` step the
       * blogger filled in, which is the same trick this already does for an
       * organisation's `legalName`. Without it a platform owner decides whether
       * somebody may publish under a checked byline while looking at
       * `ONB-PER-FB2036`.
       */
      organisationName:
        text(source.organisationName) ??
        text(source.orgName) ??
        text(organisation.name) ??
        (kind === 'blogger' ? text(payloads.identity?.legalName) : null) ??
        fallbackName,
      steps,
      documents,
      screeningRunAtIso: text(source.screeningRunAtIso),
      screeningClear: typeof source.screeningClear === 'boolean' ? source.screeningClear : null,
      submittedAtIso: text(source.submittedAtIso),
      approvedAtIso: text(source.approvedAtIso),
    },
    payloads,
  };
}

/** One answer out of a saved payload, as the string a form field holds. */
export function fieldOf(payload: Record<string, unknown> | undefined, key: string): string {
  const value = payload?.[key];
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}
