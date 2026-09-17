import { fieldOf, normaliseOnboarding } from '../onboarding';

/**
 * The onboarding application as the service really sends it.
 *
 * Captured from `GET /org/onboarding` on 15 September, after saving the
 * organisation step, attaching two documents and sending the step for review.
 */
const LIVE = {
  id: 'onb_42b7b32a2f5e',
  orgId: 'org_b7a2479ada69',
  steps: {
    organisation: {
      status: 'submitted',
      payload: { tin: 'C0000000000', legalName: 'Probe Ltd', registrationNumber: 'CS-000000000' },
      updatedAtIso: '2026-09-15T10:28:45.573Z',
      rejectionNote: null,
    },
  },
  documents: [
    {
      id: 'business_registration',
      sha256: 'b4a8',
      fileName: 'probe.pdf',
      uploadedAtIso: '2026-09-15T10:28:44.057Z',
    },
    { id: 'tax_identification', sha256: 'b4a8', fileName: 'tin.pdf', uploadedAtIso: '2026-09-15T10:28:45.291Z' },
  ],
  reference: 'ONB-ORG-000002',
  stepsView: {
    organisation: {
      status: 'submitted',
      payload: { tin: 'C0000000000', legalName: 'Probe Ltd', registrationNumber: 'CS-000000000' },
      updatedAtIso: '2026-09-15T10:28:45.573Z',
      rejectionNote: null,
    },
    officer: { status: 'not_started' },
    coverage: { status: 'not_started' },
    documents: { status: 'not_started' },
  },
  nextStepId: 'officer',
  approvedAtIso: null,
  screeningClear: null,
  submittedAtIso: null,
  screeningRunAtIso: null,
};

test('steps sent as a map become the list the wizard reads', () => {
  const { application } = normaliseOnboarding(LIVE);
  expect(application.steps.map((s) => [s.id, s.status])).toEqual([
    ['organisation', 'submitted'],
    ['officer', 'not_started'],
    ['coverage', 'not_started'],
    ['documents', 'not_started'],
  ]);
  // A sent step has a sent time even though the service calls it `updatedAtIso`.
  expect(application.steps[0]!.submittedAtIso).toBe('2026-09-15T10:28:45.573Z');
  expect(application.steps[1]!.submittedAtIso).toBeNull();
});

test('the identifiers are the ones the routes take', () => {
  const { application } = normaliseOnboarding(LIVE);
  expect(application.id).toBe('onb_42b7b32a2f5e');
  expect(application.businessId).toBe('org_b7a2479ada69');
  expect(application.reference).toBe('ONB-ORG-000002');
});

test('saved answers come back for the form', () => {
  const { payloads } = normaliseOnboarding(LIVE);
  expect(fieldOf(payloads.organisation, 'legalName')).toBe('Probe Ltd');
  expect(fieldOf(payloads.officer, 'name')).toBe('');
});

test('documents keep their names and are not marked reviewed', () => {
  const { application } = normaliseOnboarding(LIVE);
  expect(application.documents).toEqual([
    { id: 'business_registration', fileName: 'probe.pdf', uploadedAtIso: '2026-09-15T10:28:44.057Z', reviewedOk: null },
    { id: 'tax_identification', fileName: 'tin.pdf', uploadedAtIso: '2026-09-15T10:28:45.291Z', reviewedOk: null },
  ]);
});

test('a sent-back step carries its reason', () => {
  const { application } = normaliseOnboarding({
    steps: { officer: { status: 'rejected', rejectionNote: 'ID is expired', updatedAtIso: 'x' } },
  });
  expect(application.steps[0]).toMatchObject({ status: 'rejected', rejectionReason: 'ID is expired' });
});

test('an unrecognised status is never read as approved', () => {
  const { application } = normaliseOnboarding({
    steps: { organisation: { status: 'mystery' }, officer: { status: 'accepted' } },
  });
  expect(application.steps.map((s) => s.status)).toEqual(['in_progress', 'approved']);
});

test('a list of steps and unknown step or document ids are handled', () => {
  const { application } = normaliseOnboarding({
    steps: [{ id: 'coverage', status: 'in_progress' }, { id: 'nonsense', status: 'submitted' }],
    documents: [{ id: 'passport_photo', fileName: 'x.png' }],
  });
  expect(application.steps.map((s) => s.id)).toEqual(['coverage']);
  expect(application.documents).toEqual([]);
});

test('nothing usable is an empty application, not a crash', () => {
  const { application, payloads } = normaliseOnboarding(null, 'Joy News');
  expect(application).toMatchObject({ id: '', steps: [], documents: [], organisationName: 'Joy News' });
  expect(payloads).toEqual({});
});

test('a numeric answer is read back as the text a field holds', () => {
  expect(fieldOf({ radiusKm: 25 }, 'radiusKm')).toBe('25');
});
