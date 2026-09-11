import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applicationFor,
  applicationsAwaitingDecision,
  decideApplication,
  heldApplications,
  registerApplication,
  saveOnboarding,
  submitApplication,
  type OnboardingProgress,
} from '../applications';

/**
 * Registration reaches somebody.
 *
 * The flow, in the product owner's words: the organisation registers, goes
 * straight to fill in the onboarding forms, and after that it comes to the
 * Dawuro owner to approve or reject.
 *
 * None of it worked. Registration wrote the organisation's details into a
 * session cookie and nowhere else — invisible to every operator, gone on
 * sign-out. The onboarding wizard was worse: four steps and five document slots
 * in React state with no request behind any of it, so an applicant could fill
 * everything in, press submit, see "Application submitted", and have all of it
 * discarded on navigation. Approvals then carried a banner admitting that
 * approving or declining "is not sent to the service".
 *
 * The console holds the application until the backend can take it — no endpoint
 * files one today, verified against the live spec. These pin the properties
 * that make the flow real: it survives, it moves between the three states in
 * one direction, and it never invents an applicant.
 */

let store: string;

beforeEach(() => {
  store = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dawuro-apps-')), 'applications.json');
  process.env.DAWURO_APPLICATIONS_FILE = store;
});

const registration = {
  accountEmail: 'news@example.gh',
  organisationName: 'BBC News',
  sector: 'government',
  contactName: 'Jay Cobby',
  email: 'news@example.gh',
  phone: '+233557459158',
  interests: ['fire', 'flood'],
  tier: 'standard',
  registeredAtIso: '2026-09-07T14:25:04.283Z',
};

const progress: OnboardingProgress = {
  organisation: { legalName: 'BBC News Ghana Ltd', registrationNumber: 'CS123', tin: 'TIN9' },
  officer: { name: 'Jay Cobby', role: 'Editor', idNumber: 'GHA-1', phone: '+233557459158' },
  coverage: {
    address: '12 Spintex Road',
    city: 'Accra',
    areaLabel: 'Greater Accra',
    radiusKm: '25',
  },
  documents: [
    {
      id: 'business_registration',
      fileName: 'cert.pdf',
      storedAs: 'held_x/business_registration-abc.pdf',
      byteSize: 4096,
      contentType: 'application/pdf',
      uploadedAtIso: '2026-09-08T09:00:00.000Z',
    },
  ],
  steps: [],
};

test('a registration survives being written and read back', async () => {
  await registerApplication(registration);

  const found = await applicationFor('news@example.gh');
  expect(found?.organisationName).toBe('BBC News');
  // The field routing matches against. An organisation created without it has
  // an inbox that stays empty for reasons nobody can see.
  expect(found?.interests).toEqual(['fire', 'flood']);
});

test('an applicant is found again after signing out', async () => {
  /*
   * What made registering a one-way door. The next sign-in produced a bare
   * reporter account, middleware sent them to `/no-console`, and the newsroom
   * they registered a day earlier left no trace.
   */
  await registerApplication(registration);
  expect((await applicationFor('NEWS@Example.GH'))?.organisationName).toBe('BBC News');
  expect(await applicationFor('somebody@else.gh')).toBeNull();
});

test('a fresh registration is not in the approvals queue', async () => {
  /*
   * The heart of the flow. An operator sees an application once its forms are
   * filled in — not while somebody is still typing. Otherwise a reviewer
   * rejects a newsroom for not yet having attached a document.
   */
  await registerApplication(registration);
  expect(await applicationsAwaitingDecision()).toEqual([]);
});

test('onboarding answers are kept as they are filled in', async () => {
  // The wizard had no equivalent of this at all.
  await registerApplication(registration);
  await saveOnboarding('news@example.gh', progress);

  const found = await applicationFor('news@example.gh');
  expect(found?.onboarding?.organisation.registrationNumber).toBe('CS123');
  expect(found?.onboarding?.documents).toHaveLength(1);
  // Still a draft: filling a form in is not sending it.
  expect(found?.status).toBe('draft');
});

test('submitting is what puts it in front of an operator', async () => {
  await registerApplication(registration);
  await saveOnboarding('news@example.gh', progress);
  await submitApplication('news@example.gh', '2026-09-08T10:00:00.000Z');

  const queue = await applicationsAwaitingDecision();
  expect(queue).toHaveLength(1);
  expect(queue[0]?.organisationName).toBe('BBC News');
  // The evidence travels with it, or the operator has nothing to decide on.
  expect(queue[0]?.onboarding?.documents).toHaveLength(1);
});

test('a submitted application can no longer be edited', async () => {
  /*
   * Otherwise the evidence changes under a reviewer mid-decision — they approve
   * one certificate and a different one is what was stored.
   */
  await registerApplication(registration);
  await submitApplication('news@example.gh', '2026-09-08T10:00:00.000Z');

  expect(await saveOnboarding('news@example.gh', progress)).toBeNull();
});

test('submitting twice does not move a newsroom down the queue', async () => {
  await registerApplication(registration);
  await submitApplication('news@example.gh', '2026-09-08T10:00:00.000Z');
  await submitApplication('news@example.gh', '2026-09-09T10:00:00.000Z');

  expect((await applicationFor('news@example.gh'))?.submittedAtIso).toBe(
    '2026-09-08T10:00:00.000Z',
  );
});

test('an operator decides, and the decision sticks', async () => {
  await registerApplication(registration);
  await submitApplication('news@example.gh', '2026-09-08T10:00:00.000Z');
  const filed = await applicationFor('news@example.gh');

  await decideApplication(filed!.id, 'rejected', {
    email: 'owner@dawuro.local',
    atIso: '2026-09-08T11:00:00.000Z',
    note: 'Registration number does not resolve.',
  });

  const after = await applicationFor('news@example.gh');
  expect(after?.status).toBe('rejected');
  // The only part of a rejection with any use in it.
  expect(after?.decisionNote).toBe('Registration number does not resolve.');
  expect(await applicationsAwaitingDecision()).toEqual([]);
});

test('a draft cannot be approved', async () => {
  /*
   * It has no documents attached yet. Approving one would grant access to the
   * public's footage on the strength of a registration form.
   */
  await registerApplication(registration);
  const filed = await applicationFor('news@example.gh');

  expect(
    await decideApplication(filed!.id, 'approved', {
      email: 'owner@dawuro.local',
      atIso: '2026-09-08T11:00:00.000Z',
    }),
  ).toBeNull();
});

test('re-registering cannot reopen a decision or wipe the forms', async () => {
  /*
   * The likely second attempt — somebody loses a session and registers again.
   * Losing four steps of typing to that would be its own bug.
   */
  await registerApplication(registration);
  await saveOnboarding('news@example.gh', progress);
  await submitApplication('news@example.gh', '2026-09-08T10:00:00.000Z');

  await registerApplication({ ...registration, organisationName: 'Something Else' });

  const after = await applicationFor('news@example.gh');
  expect(after?.status).toBe('submitted');
  expect(after?.organisationName).toBe('BBC News');
  expect(after?.onboarding?.organisation.registrationNumber).toBe('CS123');
});

test('one newsroom is never two rows', async () => {
  await registerApplication(registration);
  await registerApplication({ ...registration, phone: '+233000000000' });

  const queue = await heldApplications();
  expect(queue).toHaveLength(1);
  expect(queue[0]?.phone).toBe('+233000000000');
  // And they keep their place in the queue.
  expect(queue[0]?.registeredAtIso).toBe(registration.registeredAtIso);
});

test('an empty queue is empty, not invented', async () => {
  // The rule the whole console is built on: never substitute seeded data.
  expect(await heldApplications()).toEqual([]);
});

test('a corrupt store is a fault, not an empty queue', async () => {
  /*
   * The failure mode this module exists to end. Swallowing a read error would
   * silently show zero applications waiting — indistinguishable from nobody
   * having applied, and the operator would never know to look.
   */
  fs.writeFileSync(store, '{ not a list }', 'utf8');
  await expect(heldApplications()).rejects.toThrow();
});

// ─── the wiring, which the unit tests above cannot see ─────────────────────

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

test('registration files the application', () => {
  expect(read('app/api/auth/register/route.ts')).toMatch(/await registerApplication\(/);
});

test('registration refuses rather than pretending it was filed', () => {
  const src = read('app/api/auth/register/route.ts');
  expect(src.slice(src.indexOf('await registerApplication('))).toMatch(/could not be saved/);
});

test('signing in restores an application already filed', () => {
  const src = read('app/api/auth/login/route.ts');
  expect(src).toMatch(/applicationFor\(user\.email\)/);
  // Middleware routes on `businessName`; without it they land on /no-console.
  expect(src).toMatch(/user\.businessName = application\.organisationName/);
});

test('a registered organisation lands in the wizard, not a dead end', () => {
  /*
   * The flow: register, then fill the forms. This page used to answer a fresh
   * applicant with a panel explaining that setting up an organisation was not
   * something they could do — a wall, one screen after they typed the details.
   */
  const page = read('app/(organisation)/onboarding/page.tsx');
  expect(page).toMatch(/await applicationFor\(session\.email\)/);
  const draftBranch = page.slice(page.indexOf("held.status !== 'draft'"));
  expect(draftBranch).toMatch(/<OnboardingWizard/);
  expect(draftBranch).toMatch(/held=\{held\}/);
});

test('the wizard saves instead of holding everything in the browser', () => {
  /*
   * Four steps and five document slots in React state with no request behind
   * any of it, discarded on navigation — under a screen reading "Application
   * submitted".
   */
  const wizard = read('app/(organisation)/onboarding/OnboardingWizard.tsx');
  expect(wizard).toMatch(/fetch\('\/api\/onboarding'/);
  // `action` is passed as a variable, so the literal appears at the call site.
  expect(wizard).toMatch(/JSON\.stringify\(\{ action, progress \}\)/);
  expect(wizard).toMatch(/'submit'\)/);
});

test('a step is only marked sent once the server has it', () => {
  // Otherwise the rail advances and nothing was written, which is the bug.
  const wizard = read('app/(organisation)/onboarding/OnboardingWizard.tsx');
  const send = wizard.slice(wizard.indexOf('const send = async'), wizard.indexOf('const upload ='));
  expect(send).toContain('await save(');
  expect(send).toContain('setApplication(');
  expect(send.indexOf('await save(')).toBeLessThan(send.indexOf('setApplication('));
});

test('a document upload sends the file, not its name', () => {
  /*
   * `onUpload(file.name)` dropped the bytes on the floor. A certificate of
   * incorporation recorded as the string "cert.pdf" is not evidence, and a
   * reviewer approving on it is approving a filename.
   */
  const slot = read('components/DocumentSlot.tsx');
  expect(slot).toMatch(/onUpload: \(file: File\) => void/);
  expect(slot).toMatch(/if \(file\) onUpload\(file\)/);
  expect(read('app/(organisation)/onboarding/OnboardingWizard.tsx')).toMatch(
    /form\.append\('file', file\)/,
  );
});

test('the approvals queue shows submitted applications and can decide them', () => {
  const page = read('app/(platform)/platform/approvals/page.tsx');
  expect(page).toMatch(/applicationsAwaitingDecision\(\)/);
  expect(page).toMatch(/<HeldApplications/);

  const panel = read('app/(platform)/platform/approvals/HeldApplications.tsx');
  expect(panel).toMatch(/fetch\(`\/api\/platform\/applications\//);
  expect(panel).toMatch(/decision: 'approved'|'approved'/);
});

test('a rejection cannot be sent without a reason', () => {
  /*
   * An applicant told only "declined" applies again with the same problem.
   * Enforced on the server, because the button is not the boundary.
   */
  const route = read('app/api/platform/applications/[id]/route.ts');
  expect(route).toMatch(/note: z\.string\(\)\.trim\(\)\.min\(1/);
});

test('only a platform owner may decide', () => {
  // Middleware gates the page; this endpoint is reachable directly.
  const route = read('app/api/platform/applications/[id]/route.ts');
  expect(route).toMatch(/accountType !== 'platform_owner'/);
  expect(route).toMatch(/status: 403/);
});

test('evidence is not served to anyone who asks for it', () => {
  /*
   * Certificates of incorporation and photo ID of a named person. Served
   * through a handler that checks the caller, never from a static folder.
   */
  const route = read('app/api/platform/applications/[id]/documents/[documentId]/route.ts');
  expect(route).toMatch(/accountType !== 'platform_owner'/);
  // The path comes from the stored record, never from the request.
  expect(route).toMatch(/document\.storedAs/);
  expect(route).toMatch(/startsWith\(path\.resolve\(root\)/);
});

test('approving is presented as what it now actually does', () => {
  /*
   * Reversed, and the reversal is the whole point.
   *
   * This used to warn that approving did *not* create the organisation, because
   * nothing in the API could. `POST /platform/organisations` exists now, so
   * approving creates it and adds the applicant as its owner in one action.
   *
   * Leaving the old warning would send an operator off to do by hand a job that
   * is already done — and doing it twice is how one newsroom ends up with two
   * organisations, splitting its reports, licences and payouts with nothing to
   * merge them.
   */
  const panel = read('app/(platform)/platform/approvals/HeldApplications.tsx');
  expect(panel).not.toMatch(/still a separate manual step/);
  expect(panel).toMatch(/Approving creates the organisation/);
  expect(panel).toMatch(/end of their setup/);

  /*
   * And the button says what the wait is for. The old label read "Recording…",
   * which beside a video product looks like a camera rolling — and approving
   * takes visibly longer now that it also creates the organisation, so the
   * spinner is on screen long enough to be misread.
   *
   * Comments stripped first: the note explaining this names the old label, so
   * matching the raw file would fail on its own documentation.
   */
  const code = panel.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
  expect(code).toMatch(/'Setting up…'/);
  expect(code).not.toMatch(/'Recording…'/);
});

test('no screen still tells an applicant their details will be lost', () => {
  /*
   * The onboarding page warned them not to sign out. That was true and is now
   * false — copy describing a fixed bug is its own bug.
   */
  const page = read('app/(organisation)/onboarding/page.tsx');
  expect(page).not.toMatch(/held only while you stay signed in/);
  expect(page).not.toMatch(/reporting happens on the phone/);
});

test('approval is presented as the end of setup, not the first of two steps', () => {
  /*
   * Corrected against the product owner: "after filling the onboarding, the
   * admin approves the organization — that is the end. Setting up their account
   * is complete after they are approved."
   *
   * Both screens said the account still had to be "switched on", and called
   * that a separate step on our side. There is no such step. What there is, is
   * a missing endpoint — and describing a defect as a workflow is the surest
   * way for it never to be fixed, because everybody reads it as working as
   * designed.
   */
  const outcome = read('app/(organisation)/onboarding/ApplicationOutcome.tsx');
  const rendered = outcome.replace(/\/\*[\s\S]*?\*\//g, ' ');

  expect(rendered).not.toMatch(/switched on|separate step/);
  expect(rendered).toMatch(/is live/);
  expect(rendered).toMatch(/What you can do now/);
  // And it names what approval actually grants.
  expect(rendered).toMatch(/license them|release them to the public feed/);
});

test('a console that cannot load the organisation calls it a fault', () => {
  /*
   * The same correction, on the other screen. An approved organisation seeing
   * an empty console is looking at a bug, and should be told so plainly rather
   * than told about an internal step that does not exist.
   */
  const outage = read('components/OrganisationOutage.tsx');
  const rendered = outage.replace(/\/\*[\s\S]*?\*\//g, ' ');

  expect(rendered).not.toMatch(/switched on|separate step/);
  expect(rendered).toMatch(/fault at our end/);
  expect(rendered).toMatch(/your account is active/);
});

test('the approved screen explains itself without our vocabulary', () => {
  /*
   * It said "we create {name} on the platform and add you to it" — how the work
   * is described on our side, and meaningless on theirs. The reader asked what
   * it was supposed to mean, which is the only review that matters for copy.
   */
  const outcome = read('app/(organisation)/onboarding/ApplicationOutcome.tsx');
  const rendered = outcome.replace(/\/\*[\s\S]*?\*\//g, ' ');
  expect(rendered).not.toMatch(/on the platform/);
  /*
   * "has not been switched on" was the sentence this pinned, and it described a
   * step that does not exist — approval is the end of setup. What the screen
   * has to do is still the same: say it in the reader's words and say what they
   * can do, which is now what is asserted.
   */
  expect(rendered).toMatch(/is live/);
  expect(rendered).toMatch(/arrive in your inbox/);
});

// ─── an approved organisation gets its console ─────────────────────────────

test('approval lets the organisation into its console', () => {
  /*
   * The point of approving anything. An operator approved a newsroom and the
   * newsroom then signed in to a single Onboarding link and a page explaining
   * why it could do nothing — so approval decided nothing at all.
   *
   * The backend still calls the account a plain `user`, because it has no
   * organisations and no endpoint that creates one, so probing it will always
   * answer "reporter". The console is the system of record for approvals; it
   * honours its own decision. This grants no data — the API stays the
   * authority on every request — it decides which shell is rendered, exactly as
   * the token's `kind` claim does for the editorial and platform consoles.
   */
  const login = read('app/api/auth/login/route.ts');
  expect(login).toMatch(/application\.status === 'approved' \? 'organisation' : 'reporter'/);
  expect(login).toMatch(/user\.onboardingComplete = application\.status === 'approved'/);
  // The organisation's id comes from the application, which is what marks it
  // as one the console is holding rather than one the backend issued.
  expect(login).toMatch(/user\.businessId = application\.id/);
});

test('an approved organisation is no longer treated as an applicant', () => {
  /*
   * `hasApplication` pins somebody to `/onboarding`. Left matching an approved
   * account, it would bounce them straight back out of the console they were
   * just let into.
   */
  const token = read('lib/token.ts');
  const fn = token.slice(token.indexOf('export function hasApplication'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  expect(body).toMatch(/accountType === 'reporter'/);
  expect(body).toMatch(/onboardingComplete === false/);
});

test('a refused org page explains the real reason, not a permissions one', () => {
  /*
   * Every `/org/*` read answers 403, and the general wording for that blames
   * the reader — "Not available on this account. This account does not have
   * access to that." Wrong story, wrong person: their account is fine and their
   * approval is real.
   *
   * There are now two reasons it happens and they need opposite instructions.
   *
   * **The session is behind.** The organisation exists and they are a member,
   * but this browser holds the sign-in from before that, and the API gates
   * `/org/*` on the token: `Token cannot access this endpoint`. Observed live —
   * the organisation was created at 14:07 and the console was still refusing at
   * 14:09. Signing in again is the entire fix, so the page says so.
   *
   * **There is no organisation.** An application approved before
   * `POST /platform/organisations` existed. No amount of signing in helps, and
   * it is a fault at our end.
   *
   * They are told apart by asking `GET /me` with the session's own token,
   * because the session is exactly the thing suspected of being stale.
   */
  const outage = read('components/OrganisationOutage.tsx');

  expect(outage).toMatch(/Sign in again to finish/);
  expect(outage).toMatch(/We cannot load your organisation/);
  expect(outage).toMatch(/'session_behind'/);
  expect(outage).toMatch(/'no_organisation'/);

  // The server decides which, not the session.
  expect(outage).toMatch(/apiRequest<CallerDescription>/);
  expect(outage).toMatch(/token: session\.accessToken/);

  // Narrow: a 403 on an organisation account. Anything else keeps the general wording.
  expect(outage).toMatch(/error\.status !== 403/);
  expect(outage).toMatch(/<Outage error=\{error\}/);
});

test('it stops telling somebody to sign in again once they have', () => {
  /*
   * Reported from a live console: signed in again, same screen, same
   * instruction. Repeating an instruction that did not work is a loop with no
   * exit, and it costs more than the wasted attempt — a screen that asks twice
   * for something that failed the first time is one people stop reading,
   * including the next time it is right.
   *
   * **The reason is now known, and it was ours.** The service scopes `/org/*`
   * with an `X-Dawuro-Org` header and refuses the route outright without one:
   *
   *     403 FORBIDDEN  X-Dawuro-Org header is required for organisation
   *                    endpoints.   details: { check: "org_header" }
   *
   * The console never sent it, on any request, so signing in again could not
   * possibly have helped — and the page had told the operator, at length, that
   * the service was contradicting itself. It was not.
   *
   * So the question the branch turns on is no longer "how old is this cookie"
   * but "did this request name an organisation at all", which is a fact rather
   * than a guess: the header is filled from `session.businessId`.
   */
  const outage = read('components/OrganisationOutage.tsx');

  expect(outage).toMatch(/'refused_with_scope'/);
  expect(outage).not.toMatch(/signing_in_did_not_help/);
  // The clock is gone, and so is the guess it stood in for.
  expect(outage).not.toMatch(/sessionAgeSeconds|JUST_SIGNED_IN_SECONDS/);
  expect(outage).toMatch(/session\.businessId \? 'refused_with_scope' : 'session_behind'/);

  // And it offers no button, because there is no action that helps.
  const branch = outage.slice(
    outage.indexOf("state === 'refused_with_scope'"),
    outage.indexOf("state === 'no_organisation'"),
  );
  expect(branch).not.toMatch(/<Link/);
});

describe('the organisation scope header', () => {
  /*
   * Verified against the live service, not inferred. A plain user token, a
   * token already carrying an `orgId` claim, and a fabricated organisation id
   * were each tried:
   *
   *   no header                → 403  check: "org_header"
   *   header, not a member     → 403  check: "membership"
   *   header, member           → 200
   *
   * The middle case is why the header is a scope declaration rather than a
   * secret, and the second case is why a token that already knows its
   * organisation is still refused without it.
   */
  const api = () => read('lib/consoleApi.ts');

  test('every organisation path carries it', () => {
    expect(api()).toMatch(/path\.startsWith\('\/org\/'\) && orgId \? \{ 'X-Dawuro-Org': orgId \}/);
  });

  test('reads, paged reads and writes all send it', () => {
    /*
     * Three separate request paths, and missing it on any one leaves a
     * different desk refused. Licensing and publishing are `/org/*` writes.
     */
    const source = api();
    expect([...source.matchAll(/orgHeader\(path, /g)]).toHaveLength(3);
    expect(source).toMatch(/const extra = orgHeader\(path, identity\?\.orgId \?\? null\)/);
    expect(source).toMatch(/token, headers: extra/);
  });

  test('the token and the organisation come from one session read', () => {
    // Two reads could describe two different people.
    expect(api()).toMatch(/return \{ token: session\.accessToken, orgId: session\.businessId/);
  });

  test('an applicant with no organisation sends no header', () => {
    /*
     * A real state rather than an error: somebody part-way through onboarding
     * has an account and no organisation, and `/org/onboarding` answering 403
     * for them is what the onboarding page is written around.
     */
    expect(api()).toMatch(/&& orgId \?/);
  });
});

test('the session check stays out of the client barrel', () => {
  /*
   * Found by the page 500ing. Putting `readSession` behind `Outage` — exported
   * from `components/ui`, which client components import — pulled
   * `next/headers` into the client bundle and every organisation page answered 500.
   */
  const ui = read('components/ui/Outage.tsx');
  expect(ui).not.toMatch(/readSession|next\/headers/);
  expect(read('components/OrganisationOutage.tsx')).toMatch(/^import 'server-only';/m);
});
