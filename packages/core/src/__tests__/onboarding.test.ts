import {
  DOCUMENT_REQUIREMENTS,
  ONBOARDING_STEPS,
  REVIEWABLE_STEPS,
  applicantProgress,
  approvalProblem,
  completedByApplicant,
  documentSatisfied,
  missingDocuments,
  nextStepFor,
  onboardingReference,
  outstandingForApproval,
  stepState,
  submitProblem,
  type DocumentId,
  type OnboardingApplication,
  type OnboardingStepId,
  type StepStatus,
} from '../logic/onboarding';

const NOW = '2026-06-01T10:00:00.000Z';

function application(over: Partial<OnboardingApplication> = {}): OnboardingApplication {
  return {
    reference: onboardingReference(1),
    businessId: 'biz_1',
    organisationName: 'Test Org',
    steps: [],
    documents: [],
    screeningRunAtIso: null,
    screeningClear: null,
    submittedAtIso: null,
    approvedAtIso: null,
    ...over,
  };
}

const allSteps = (status: StepStatus) =>
  ONBOARDING_STEPS.map((meta) => ({
    id: meta.id,
    status,
    rejectionReason: null,
    submittedAtIso: NOW,
    reviewedAtIso: null,
    reviewedBy: null,
  }));

const allDocs = () =>
  (Object.keys(DOCUMENT_REQUIREMENTS) as DocumentId[])
    .filter((id) => DOCUMENT_REQUIREMENTS[id].required)
    .map((id) => ({
      id,
      fileName: `${id}.pdf`,
      uploadedAtIso: NOW,
      reviewedOk: null,
    }));

describe('steps', () => {
  it('defines a label and description for each', () => {
    for (const meta of ONBOARDING_STEPS) {
      expect(meta.label).toBeTruthy();
      expect(meta.description.length).toBeGreaterThan(10);
    }
  });

  it('has no duplicate ids', () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('treats an unknown step as not started rather than throwing', () => {
    expect(stepState(application(), 'organisation').status).toBe('not_started');
  });
});

describe('applicant progress', () => {
  it('is zero on a fresh application', () => {
    expect(completedByApplicant(application())).toBe(0);
    expect(applicantProgress(application())).toBe(0);
  });

  it('counts submitted and approved, not in-progress', () => {
    const app = application({
      steps: [
        { ...allSteps('submitted')[0]!, id: 'organisation' },
        { ...allSteps('in_progress')[0]!, id: 'officer' },
        { ...allSteps('approved')[0]!, id: 'coverage' },
      ],
    });
    expect(completedByApplicant(app)).toBe(2);
  });

  it('does not count a rejected step', () => {
    // It is back with the applicant. Counting it would show progress that has
    // just been undone.
    const app = application({
      steps: [{ ...allSteps('rejected')[0]!, id: 'organisation' }],
    });
    expect(completedByApplicant(app)).toBe(0);
  });

  it('is complete when every step is submitted', () => {
    expect(applicantProgress(application({ steps: allSteps('submitted') }))).toBe(1);
  });
});

describe('next step', () => {
  it('is the first step on a fresh application', () => {
    expect(nextStepFor(application())).toBe(ONBOARDING_STEPS[0]!.id);
  });

  it('skips finished steps', () => {
    const app = application({
      steps: [{ ...allSteps('approved')[0]!, id: 'organisation' }],
    });
    expect(nextStepFor(app)).toBe('officer');
  });

  it('sends a rejected step to the front of the queue', () => {
    // Later steps may depend on what was wrong, and a rejection buried behind
    // them is how an application sits untouched for a fortnight.
    const steps = allSteps('submitted');
    const app = application({
      steps: steps.map((s) =>
        s.id === 'coverage' ? { ...s, status: 'rejected' as StepStatus } : s,
      ),
    });
    expect(nextStepFor(app)).toBe('coverage');
  });

  it('is null when nothing is outstanding', () => {
    expect(nextStepFor(application({ steps: allSteps('approved') }))).toBeNull();
  });
});

describe('documents', () => {
  it('is satisfied by the exact document', () => {
    const app = application({
      documents: [
        {
          id: 'officer_id',
          fileName: 'id.jpg',
          uploadedAtIso: NOW,
          reviewedOk: null,
        },
      ],
    });
    expect(documentSatisfied(app, 'officer_id')).toBe(true);
  });

  it('accepts either member of an alternative group', () => {
    // A lease and a utility bill both prove occupancy; demanding both is how an
    // application stalls on paperwork that adds nothing.
    const withLease = application({
      documents: [
        {
          id: 'lease_agreement',
          fileName: 'lease.pdf',
          uploadedAtIso: NOW,
          reviewedOk: null,
        },
      ],
    });
    expect(documentSatisfied(withLease, 'premises_proof')).toBe(true);

    const withBill = application({
      documents: [
        {
          id: 'utility_bill',
          fileName: 'ecg.pdf',
          uploadedAtIso: NOW,
          reviewedOk: null,
        },
      ],
    });
    expect(documentSatisfied(withBill, 'premises_proof')).toBe(true);
  });

  it('does not let an unrelated document satisfy a requirement', () => {
    const app = application({
      documents: [
        {
          id: 'tax_identification',
          fileName: 'tin.pdf',
          uploadedAtIso: NOW,
          reviewedOk: null,
        },
      ],
    });
    expect(documentSatisfied(app, 'officer_id')).toBe(false);
  });

  it('lists what is still missing', () => {
    expect(missingDocuments(application()).length).toBeGreaterThan(0);
    expect(missingDocuments(application({ documents: allDocs() }))).toEqual([]);
  });
});

describe('submitting', () => {
  it('is blocked while steps are outstanding', () => {
    expect(submitProblem(application())).toBe('steps_outstanding');
  });

  it('is blocked while required documents are missing', () => {
    const app = application({ steps: allSteps('submitted') });
    expect(submitProblem(app)).toBe('documents_missing');
  });

  it('is allowed once every step is sent and every document attached', () => {
    const app = application({
      steps: allSteps('submitted'),
      documents: allDocs(),
    });
    expect(submitProblem(app)).toBeNull();
  });

  it('cannot be submitted twice', () => {
    const app = application({
      steps: allSteps('submitted'),
      documents: allDocs(),
      submittedAtIso: NOW,
    });
    expect(submitProblem(app)).toBe('already_submitted');
  });

  it('is blocked by a rejected step even when everything else is done', () => {
    const steps = allSteps('submitted').map((s) =>
      s.id === 'officer' ? { ...s, status: 'rejected' as StepStatus } : s,
    );
    expect(submitProblem(application({ steps, documents: allDocs() }))).toBe('steps_outstanding');
  });
});

describe('approving', () => {
  const submitted = () =>
    application({
      steps: allSteps('submitted'),
      documents: allDocs(),
      submittedAtIso: NOW,
    });

  it('refuses before the applicant has submitted', () => {
    expect(approvalProblem(application())).toBe('not_submitted');
  });

  it('refuses while any step is unapproved', () => {
    // Completing a step never approves it. An organisation that could mark its
    // own evidence acceptable has not been checked.
    expect(approvalProblem(submitted())).toBe('steps_not_approved');
  });

  it('refuses before screening has been run', () => {
    const app = { ...submitted(), steps: allSteps('approved') };
    expect(approvalProblem(app)).toBe('screening_not_run');
  });

  it('refuses when screening returned a hit', () => {
    const app = {
      ...submitted(),
      steps: allSteps('approved'),
      screeningRunAtIso: NOW,
      screeningClear: false,
    };
    expect(approvalProblem(app)).toBe('screening_not_clear');
  });

  it('allows approval once every gate is passed', () => {
    const app = {
      ...submitted(),
      steps: allSteps('approved'),
      screeningRunAtIso: NOW,
      screeningClear: true,
    };
    expect(approvalProblem(app)).toBeNull();
  });

  it('cannot approve twice', () => {
    const app = {
      ...submitted(),
      steps: allSteps('approved'),
      screeningRunAtIso: NOW,
      screeningClear: true,
      approvedAtIso: NOW,
    };
    expect(approvalProblem(app)).toBe('already_approved');
  });

  it('lists everything the administrator still has to do', () => {
    const outstanding = outstandingForApproval(submitted());
    /*
     * One line per unapproved step, plus screening — and `documents` is a step.
     *
     * **This asserted the opposite, and the opposite was unapprovable.** The
     * reasoning was that `documents` is the applicant's submit step, carrying
     * no answers and no files of its own, so reviewing it decided nothing.
     * The service does not agree, and it holds the gate. Read off the live
     * queue on 29 September, both organisations waiting for a decision sat at
     * `organisation/officer/coverage -> approved`, `documents -> submitted`,
     * and `POST /platform/applications/{id}/approve` answered
     * `steps_not_approved` for both — while the one already-approved
     * organisation had `documents -> approved`.
     *
     * So the reviewer does have a fourth thing to do, and leaving it off this
     * list is what left them with three green ticks, "Everything is in order"
     * and a server refusal they had no control to answer.
     */
    expect(outstanding).toHaveLength(REVIEWABLE_STEPS.length + 1);
    expect(outstanding.join(' ')).toMatch(/Documents step/);
    expect(outstanding[outstanding.length - 1]).toMatch(/screening/i);
  });

  it('every organisation step is reviewed, including the paperwork', () => {
    /*
     * All four, because the service counts all four.
     */
    expect(REVIEWABLE_STEPS.map((s) => s.id)).toEqual([
      'organisation',
      'officer',
      'coverage',
      'documents',
    ]);
    expect(ONBOARDING_STEPS.filter((s) => !s.requiresReview)).toEqual([]);
  });

  it('the paperwork step asks for nothing of its own, and that is why its panel is special', () => {
    /*
     * The empty-panel problem was real — it was solved in the wrong place.
     *
     * `documents` declares no fields and no documents, because every file is
     * collected by the step it belongs to. Filtering the review panel by
     * `meta.documents` therefore rendered it blank, and the response was to
     * drop it from review entirely, which broke approval.
     *
     * It stays empty here, deliberately: the panel special-cases this id and
     * shows the whole attached set plus anything still missing. This pins the
     * shape that special case depends on — if a future edit gives this step
     * documents of its own, the panel would list them twice.
     */
    const paperwork = ONBOARDING_STEPS.find((s) => s.id === 'documents')!;
    expect(paperwork.fields).toEqual([]);
    expect(paperwork.documents).toEqual([]);

    // Every other step earns its panel the ordinary way.
    for (const step of REVIEWABLE_STEPS.filter((s) => s.id !== 'documents')) {
      expect([step.id, step.fields.length + step.documents.length > 0]).toEqual([step.id, true]);
    }
  });

  it('says to escalate rather than to re-run when screening hit', () => {
    const app = {
      ...submitted(),
      steps: allSteps('approved'),
      screeningRunAtIso: NOW,
      screeningClear: false,
    };
    expect(outstandingForApproval(app).join(' ')).toMatch(/escalate/i);
  });
});

describe('reference', () => {
  it('is zero-padded and stable', () => {
    expect(onboardingReference(1)).toBe('ONB-ORG-000001');
    expect(onboardingReference(42)).toBe('ONB-ORG-000042');
  });

  it('never produces a zero or negative reference', () => {
    expect(onboardingReference(0)).toBe('ONB-ORG-000001');
    expect(onboardingReference(-5)).toBe('ONB-ORG-000001');
  });
});
