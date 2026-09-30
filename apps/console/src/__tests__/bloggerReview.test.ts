import fs from 'fs';
import path from 'path';
import {
  ALL_STEP_IDS,
  approvalProblem,
  outstandingForApproval,
  reviewableStepsFor,
  stepsFor,
  type OnboardingApplication,
} from '@dawuro/core';
import { normaliseOnboarding } from '@/lib/onboarding';

/**
 * A blogger can be reviewed, and could not be until now.
 *
 * **The dead end this closes.** Blogger verification shipped on the phone with
 * only the applicant's half: somebody could register, fill in three steps,
 * attach their Ghana Card and press Send, and the application landed where no
 * endpoint could read it and no person could act on it. Nothing errored. The
 * request succeeded. It simply could never be approved.
 *
 * `/platform/applications` now returns both kinds in one queue, discriminated
 * by `kind`. This file guards the three places the console would otherwise
 * quietly treat a blogger as an organisation — and each of them failed
 * *silently*, which is why they are worth a test rather than a glance:
 *
 *   1. The normaliser filtered steps against the organisation's ids, so
 *      `identity` and `presence` vanished while `coverage` survived — it is in
 *      both sets. A complete application rendered as a half-finished
 *      organisation.
 *   2. The review panel read the organisation's step set, so a blogger's tabs
 *      were three headings with their answers nowhere.
 *   3. `approvalProblem` checked the organisation's steps for approval, so a
 *      blogger's `organisation` and `officer` steps — which do not exist —
 *      could never be approved and the gate never opened.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** What `/platform/applications` sends for a blogger, read off the live spec. */
const personApplication = (overrides: Record<string, unknown> = {}) => ({
  id: 'pva_a693bc8b4781',
  userId: 'usr_f94b9afb2036',
  kind: 'blogger',
  reference: 'ONB-PER-FB2036',
  stepIds: ['identity', 'presence', 'coverage'],
  steps: {
    identity: { status: 'submitted', payload: { legalName: 'Ama Kufuor', idNumber: 'GHA-1' } },
    presence: { status: 'submitted', payload: { publicationName: 'Accra Daily' } },
    coverage: { status: 'submitted', payload: { city: 'Accra' } },
  },
  documents: [{ id: 'officer_id', fileName: 'card.jpg' }],
  missingDocuments: [],
  submittedAtIso: '2026-09-29T09:00:00.000Z',
  approvedAtIso: null,
  screeningRunAtIso: null,
  screeningClear: null,
  ...overrides,
});

describe('the step sets stay apart', () => {
  test('a blogger has three steps, and none of them is an organisation’s', () => {
    expect(reviewableStepsFor('blogger').map((s) => s.id)).toEqual([
      'identity',
      'presence',
      'coverage',
    ]);
    const ids = stepsFor('blogger').map((s) => s.id);
    expect(ids).not.toContain('organisation');
    expect(ids).not.toContain('officer');
  });

  test('`coverage` means different things in each, so the sets must not merge', () => {
    /*
     * The collision that makes a merged set dangerous rather than merely
     * untidy. An organisation's coverage is an operating radius; a blogger's is
     * the town they live in. Reading one from the other's set shows a reviewer
     * the wrong question with the right answers under it.
     */
    const org = stepsFor('organisation').find((s) => s.id === 'coverage')!;
    const blogger = stepsFor('blogger').find((s) => s.id === 'coverage')!;
    expect(org.fields.map((f) => f.key)).not.toEqual(blogger.fields.map((f) => f.key));
    expect(blogger.fields.map((f) => f.key)).toContain('city');
    expect(org.fields.map((f) => f.key)).toContain('address');
  });
});

describe('normalising what the service sends', () => {
  test('every step survives, with its answers', () => {
    const { application, payloads } = normaliseOnboarding(personApplication());
    expect(application.kind).toBe('blogger');
    expect(application.steps.map((s) => s.id).sort()).toEqual([
      'coverage',
      'identity',
      'presence',
    ]);
    expect(payloads.identity?.legalName).toBe('Ama Kufuor');
    expect(payloads.presence?.publicationName).toBe('Accra Daily');
  });

  test('the reviewer is told whose application it is', () => {
    /*
     * `PersonApplication` carries no name field — only `userId` and a
     * reference — so the name has to come out of the `identity` step. Without
     * it a platform owner decides whether somebody may publish under a checked
     * byline while looking at `ONB-PER-FB2036`.
     */
    const { application } = normaliseOnboarding(personApplication());
    expect(application.organisationName).toBe('Ama Kufuor');
  });

  test('an organisation is still read as one', () => {
    // No `kind` on the wire for an organisation; absent must not become blogger.
    const { application } = normaliseOnboarding({
      id: 'onb_1',
      reference: 'ONB-ORG-000002',
      orgId: 'org_1',
      organisationName: 'Accra Metropolitan Assembly',
      steps: { organisation: { status: 'submitted', payload: { legalName: 'AMA' } } },
      documents: [],
    });
    expect(application.kind).toBe('organisation');
    expect(application.steps.map((s) => s.id)).toEqual(['organisation']);
  });
});

describe('a blogger can actually reach approval', () => {
  const approved = (app: ReturnType<typeof personApplication>): OnboardingApplication => {
    const { application } = normaliseOnboarding(app);
    return {
      ...application,
      steps: application.steps.map((s) => ({ ...s, status: 'approved' as const })),
      screeningRunAtIso: '2026-09-29T10:00:00.000Z',
      screeningClear: true,
    };
  };

  test('the gate opens once their own steps are approved and screening is clear', () => {
    /*
     * The assertion this whole file exists for. Against the organisation's step
     * set this returned `steps_not_approved` forever, because `organisation`
     * and `officer` are steps a blogger never had and could never approve.
     */
    expect(approvalProblem(approved(personApplication()))).toBeNull();
  });

  test('and not before', () => {
    const { application } = normaliseOnboarding(personApplication());
    expect(approvalProblem(application)).toBe('steps_not_approved');
    /*
     * Two distinct refusals, and the order matters to a reviewer: "not run" is
     * work still to do, "not clear" is a hit to escalate. Setting only
     * `screeningClear` to null leaves the run timestamp in place, which is the
     * second of the two — this asserted the first and was simply wrong about
     * the fixture, not about the rule.
     */
    expect(approvalProblem({ ...approved(personApplication()), screeningClear: null })).toBe(
      'screening_not_clear',
    );
    expect(
      approvalProblem({
        ...approved(personApplication()),
        screeningRunAtIso: null,
        screeningClear: null,
      }),
    ).toBe('screening_not_run');
  });

  test('the outstanding list names their steps, not an organisation’s', () => {
    const { application } = normaliseOnboarding(personApplication());
    const outstanding = outstandingForApproval(application).join(' ');
    expect(outstanding).toMatch(/Who they are/);
    expect(outstanding).toMatch(/Where they publish/);
    expect(outstanding).not.toMatch(/Authorised officer/);
  });
});

describe('a decision about a blogger step can actually be sent', () => {
  /*
   * **The panel rendered and no decision could be recorded through it.**
   *
   * The platform queue carries both kinds, but the route that records a
   * decision validated `stepId` against a hand-written copy of the
   * organisation's four. So approving a blogger's first step sent
   * `stepId: 'identity'`, Zod refused it, and the reviewer was shown the
   * parser's own words — "Invalid enum value. Expected 'organisation' |
   * 'officer' | 'coverage' | 'documents', received 'identity'" — naming an
   * enum they had no way to know existed. Every blogger was undecidable and
   * the message explained nothing.
   *
   * The service takes `stepId` as a free-form path segment and its own
   * summary says so: "For blogger applications, stepId is one of identity |
   * presence | coverage." The refusal was entirely the console's.
   */
  const route = read('app/api/platform/applications/[id]/route.ts');
  const wizard = read('app/api/onboarding/route.ts');

  test('the platform route accepts every step id both kinds use', () => {
    expect(route).toMatch(/stepId: z\.enum\(ALL_STEP_IDS/);
    expect(route).toMatch(/import \{ ALL_STEP_IDS \} from '@dawuro\/core'/);
    // The hand-written organisation list is what went wrong; it must not return.
    expect(route).not.toMatch(/z\.enum\(\['organisation', 'officer'/);
  });

  test('and that list is derived from the step definitions, not typed again', () => {
    /*
     * A third hand-written copy is exactly how this happened. `ALL_STEP_IDS`
     * comes off the two step lists, so a step added to either kind is accepted
     * without anybody remembering to come back here.
     */
    expect(ALL_STEP_IDS).toEqual(expect.arrayContaining(['identity', 'presence', 'coverage']));
    expect(ALL_STEP_IDS).toEqual(
      expect.arrayContaining(['organisation', 'officer', 'coverage', 'documents']),
    );
    // `coverage` is in both sets and must appear once, not twice.
    expect(ALL_STEP_IDS.filter((id) => id === 'coverage')).toHaveLength(1);
  });

  test("the organisation's own wizard stays organisation-only", () => {
    /*
     * The opposite mistake. `api/onboarding` is an organisation filling in its
     * own form against `/org/onboarding/*`; a blogger never reaches it, since
     * they verify on the phone through `/me/verification*`. Widening this one
     * to `ALL_STEP_IDS` would forward a blogger step id to an org-scoped
     * endpoint and turn a clear refusal into a confusing server error.
     */
    expect(wizard).toMatch(/z\.enum\(\['organisation', 'officer', 'coverage', 'documents'\]\)/);
    // Comments stripped: the note explaining why this route does *not* use
    // `ALL_STEP_IDS` names it, and a rule that reads its own rationale as a
    // violation fails on prose rather than on code.
    const wizardCode = wizard
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    expect(wizardCode).not.toMatch(/ALL_STEP_IDS/);
  });
});

test('the approvals header counts applications, not organisations', () => {
  /*
   * It read "1 organisation waiting for a decision" over a queue whose only
   * entry was a blogger. The count was right and the noun was wrong, which is
   * worse than vague: the header denied the existence of the one thing
   * actually waiting.
   */
  const page = read('app/(platform)/platform/approvals/page.tsx');
  expect(page).toMatch(/waiting === 1 \? 'application' : 'applications'/);
});

test('the review panel picks its step set from the application', () => {
  /*
   * Source-read, because the alternative is standing up the whole panel to
   * prove one lookup. Hardcoding `REVIEWABLE_STEPS` here is the regression:
   * the tabs would read `Organisation / Authorised officer / Coverage` over a
   * blogger's answers, every one of them empty.
   */
  const panel = read('components/ApplicationReview.tsx');
  expect(panel).toMatch(/reviewableStepsFor\(application\.kind\)/);
  expect(panel).toMatch(/stepsFor\(kind\)\.find/);
  expect(panel).not.toMatch(/REVIEWABLE_STEPS/);
  // And a reviewer can tell the two apart without reading the tab labels.
  expect(panel).toMatch(/isBlogger \? 'Blogger' : 'Organisation'/);
});
