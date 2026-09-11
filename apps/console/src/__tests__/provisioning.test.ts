import fs from 'fs';
import path from 'path';

/**
 * Approving an organisation into existence.
 *
 * The product owner's flow, verbatim: an organisation registers, completes
 * onboarding, an admin approves it, **and that is the end of its setup** — it is
 * then visible in the app, receives the reports routed to it, and can release
 * them to the public feed.
 *
 * That last step could not happen. No endpoint created an organisation, so
 * approving only flipped a status in a file this console keeps. Three newsrooms
 * were approved that way and every one of them signs in to a working account,
 * gets 403 from every `/org/*` read, and sees an outage — verified against the
 * live service, where `GET /me` for an approved applicant returns
 * `{"kind":"user","orgId":null,"memberships":[]}` and `/platform/organisations`
 * returns zero items.
 *
 * `POST /platform/organisations` now exists. These rules are about the two ways
 * wiring it up can still go wrong: losing a decision, and creating a newsroom
 * twice.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const PROVISION = 'lib/provisionOrganisation.ts';
const ROUTE = 'app/api/platform/applications/[id]/route.ts';

test('approving creates the organisation', () => {
  // The whole point. Without this, approval is a note to self.
  const route = code(ROUTE);
  expect(route).toMatch(/provisionOrganisation\(decided\)/);
  expect(code(PROVISION)).toMatch(/platform\.createOrganisation</);
});

test('the applicant is put inside the organisation they applied for', () => {
  /*
   * An organisation whose own operator is not a member of it is
   * indistinguishable, from their side of the screen, from having no
   * organisation at all — the same 403 on the same reads.
   */
  const provision = code(PROVISION);
  expect(provision).toMatch(/platform\.addOrganisationMember\(/);
  expect(provision).toMatch(/email: application\.accountEmail/);
});

test('they get owner, not a lesser role', () => {
  /*
   * They applied for it, completed the onboarding, and are the person who adds
   * everybody else. An `admin` cannot hand out ownership, so anything less
   * leaves a newsroom coming back to us to add its own editor.
   */
  expect(code(PROVISION)).toMatch(/APPLICANT_ROLE = 'owner'/);
});

test('a decision is never lost because the platform refused', () => {
  /*
   * The ordering rule. Creating the organisation first and recording the
   * decision after would mean a refused or timed-out call threw away what the
   * operator had just decided — they press approve, see an error, and the
   * application is still sitting in the queue.
   *
   * So the decision is written first and provisioning follows, and a
   * provisioning failure answers 200 with a warning rather than an error: the
   * thing the operator pressed did happen.
   */
  const route = code(ROUTE);
  const decideAt = route.indexOf('await decideApplication(');
  const provisionAt = route.indexOf('provisionOrganisation(decided)');

  expect(decideAt).toBeGreaterThan(-1);
  expect(provisionAt).toBeGreaterThan(decideAt);
  expect(route).toMatch(/warning:/);
});

test('provisioning twice does not create two newsrooms', () => {
  /*
   * Three guards, because a duplicate is unrecoverable — two organisations for
   * one newsroom split its reports, licences and payouts and nothing merges
   * them. The recorded id short-circuits; a name already on the platform is
   * adopted; and the create call is keyed on the application so a retried
   * request is the same request.
   */
  const provision = code(PROVISION);
  expect(provision).toMatch(/if \(application\.organisationId\)/);
  expect(code('lib/consoleApi.ts')).toMatch(/`create-organisation:\$\{key\}`/);

  /*
   * The lookup has to happen *before* the create call, not just somewhere in
   * the file. `findByName` is called twice — once to adopt an existing
   * organisation and once to recover an id the create response did not carry —
   * and only the first is a duplicate guard. Asserting the name alone passed
   * with the guard deleted, because the recovery call still matched it.
   */
  const adoptAt = provision.indexOf('const existing = await findByName(');
  const createAt = provision.indexOf('await platform.createOrganisation<');
  expect(adoptAt).toBeGreaterThan(-1);
  expect(createAt).toBeGreaterThan(adoptAt);
});

test('the id is written down before the member is added', () => {
  /*
   * The subtle one. If adding the member fails and the id has not been
   * recorded, the next attempt finds nothing recorded and creates a second
   * organisation — so every failed membership call would cost a duplicate.
   */
  const provision = code(PROVISION);
  const recordAt = provision.indexOf('await recordOrganisation(');
  const memberAt = provision.indexOf('await platform.addOrganisationMember(');

  expect(recordAt).toBeGreaterThan(-1);
  expect(memberAt).toBeGreaterThan(recordAt);
});

test('an organisation created but not identified is reported, not retried', () => {
  /*
   * `POST /platform/organisations` documents a 201 with no response schema, so
   * the id is read out of any unambiguous wrapper and then looked up by name.
   * Both failing means an organisation may exist that this console cannot
   * record — and a silent retry is exactly what would make a second one.
   */
  const provision = code(PROVISION);
  expect(provision).toMatch(/retrying could create a second one/);
});

test('the id is never guessed out of the wrong field', () => {
  /*
   * An id read from the wrong place would attach one newsroom's reports,
   * licences and payouts to something else entirely. Null instead.
   */
  const provision = code(PROVISION);
  expect(provision).toMatch(/return null/);
  expect(provision).toMatch(/record\.id \?\? record\.organisationId/);
});

test('already a member is success, not failure', () => {
  // The step is repeatable; the second run should be quiet.
  expect(code(PROVISION)).toMatch(/status !== 409/);
});

test('the backlog approved before the endpoint existed can be finished', () => {
  /*
   * Not a rare edge case. Until `POST /platform/organisations` landed this was
   * *every* approved application — newsrooms told yes, with no organisation
   * behind their account. Re-deciding them is not an option: the decision was
   * made, and in some cases weeks ago.
   */
  expect(code(ROUTE)).toMatch(/z\.literal\('provision'\)/);
  expect(code(ROUTE)).toMatch(/decision === 'provision'/);
  expect(code('lib/applications.ts')).toMatch(/approvedAwaitingOrganisation/);

  const decided = code('app/(platform)/platform/approvals/DecidedApplications.tsx');
  expect(decided).toMatch(/<FinishSetup/);
  // Offered only where it is missing: a button to create something that exists
  // is an invitation to create a second one.
  expect(decided).toMatch(/isApproved && !application\.organisationId/);
});

test('the console no longer says an organisation must be set up by hand', () => {
  /*
   * It was true and is not any more. Instructions to do manually what the
   * button now does are how an operator ends up creating a duplicate
   * organisation alongside the real one.
   */
  const decided = read('app/(platform)/platform/approvals/DecidedApplications.tsx');
  expect(decided).not.toMatch(/created by hand/i);
  expect(decided).not.toMatch(/There is no endpoint that creates an organisation/i);
});

test('an organisation session carries the real organisation id', () => {
  /*
   * The other half of the same bug. With no way to learn a real org id the
   * console minted `held_…`, which every `/org/*` endpoint correctly answered
   * 403 to — so an approved newsroom saw "We cannot load your organisation" on
   * a perfectly good account. `GET /me` carries the real one.
   */
  expect(code('lib/auth.ts')).toMatch(/businessId: membership\.orgId/);
});
