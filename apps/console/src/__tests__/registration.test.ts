import fs from 'fs';
import path from 'path';

/**
 * An organisation applies, and the application lives on the service.
 *
 * The flow, in the product owner's words: the organisation registers, fills in
 * the onboarding forms, and the Dawuro owner approves or rejects it.
 *
 * Until the backend's fourth round, `POST /auth/register` could only make a
 * reporter and every `/org/*` route needed an organisation that already
 * existed. So the console kept applications and their documents in files on its
 * own disk — invisible to the service, lost on redeploy, and visible to the
 * platform owner only on the same machine. Registration now creates a pending
 * organisation, and these pin that nothing is kept locally any more.
 *
 * Asserted against the source because the routes need a live backend and a
 * cookie store, and what matters is which calls are on the path.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const REGISTER = 'app/api/auth/register/route.ts';
const ONBOARDING = 'app/api/onboarding/route.ts';
const WIZARD = 'app/(organisation)/onboarding/OnboardingWizard.tsx';
const PAGE = 'app/(organisation)/onboarding/page.tsx';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

// ─── registration ─────────────────────────────────────────────────────────

test('registration creates the organisation, not a reporter', () => {
  const src = code(REGISTER);
  expect(src).toMatch(/apiRequest<TokenEnvelope>\('\/auth\/register'/);
  expect(src).toMatch(/accountKind: 'organisation'/);
  expect(src).toMatch(/organisation: \{ name: input\.organisationName, sector: input\.sector \}/);
});

test('the session is the organisation the service made, with onboarding still to do', () => {
  const src = code(REGISTER);
  const sessionWrite = src.slice(src.indexOf('await createSession('));
  expect(sessionWrite).toMatch(/accessToken: tokens\.accessToken/);
  expect(sessionWrite).toMatch(/businessId: orgId/);
  expect(sessionWrite).toMatch(/accountType: 'organisation'/);
  expect(sessionWrite).toMatch(/onboardingComplete: false/);
});

test('nothing invents an organisation id', () => {
  const src = code(REGISTER);
  expect(src).not.toMatch(/biz_new_|held_/);
  expect(src).toMatch(/tokens\.me\?\.orgId/);
});

test('what registration collected is written to the application, not dropped', () => {
  /*
   * Interests decide routing; `/auth/register` has no field for them. They go
   * onto the organisation step, and the wizard merges rather than replaces it.
   */
  const src = code(REGISTER);
  expect(src).toMatch(/'\/org\/onboarding\/steps\/organisation'/);
  expect(src).toMatch(/interests: input\.interests/);
  expect(code(WIZARD)).toMatch(/\.\.\.\(payloads\[id\] \?\? \{\}\)/);
});

test('a password is required, and long enough for the server', () => {
  expect(code(REGISTER)).toMatch(/password: z\.string\(\)\.min\(8/);
  const form = read('app/register/company/RegisterForm.tsx');
  expect(form).toMatch(/type="password"/);
  expect(form).toMatch(/password\.length < 8/);
  expect(form.slice(form.indexOf("fetch('/api/auth/register'"))).toMatch(/password,/);
});

test('an account that already exists says so, and an outage is not a refusal', () => {
  const src = code(REGISTER);
  expect(src).toMatch(/status === 409/);
  expect(src).toMatch(/Sign in instead/);
  expect(src).toMatch(/could not be reached, so nothing was registered/);
});

// ─── nothing kept on this machine ─────────────────────────────────────────

test('the console keeps no applications or documents of its own', () => {
  expect(fs.existsSync(path.join(SRC, 'lib/applications.ts'))).toBe(false);
  expect(fs.existsSync(path.join(SRC, 'app/api/onboarding/documents'))).toBe(false);

  const offenders = sourceFiles(SRC).filter((file) =>
    // `.data` itself is not the test: dev captures and the place-name cache use it.
    /lib\/applications'|applications\.json|documentsRoot|DAWURO_APPLICATIONS_FILE/.test(
      fs.readFileSync(file, 'utf8'),
    ),
  );
  expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
});

// ─── signing in ───────────────────────────────────────────────────────────

test('a pending organisation signs in to onboarding, an approved one to its console', () => {
  const auth = code('lib/auth.ts');
  expect(auth).toMatch(/onboardingComplete: membership\?\.verified !== false/);
  expect(auth).toMatch(/businessId: membership\.orgId/);
  // `name` is what the live service sends on a membership.
  expect(auth).toMatch(/entry\?\.orgName \?\? entry\?\.name/);

  const login = code('app/api/auth/login/route.ts');
  expect(login).not.toMatch(/applicationFor/);
  expect(login).toMatch(/redirectTo: homeForSession\(user\)/);

  const middleware = read('middleware.ts');
  expect(middleware).toMatch(/homeForSession\(session\)/);
  expect(middleware).toMatch(/session\.onboardingComplete === false/);
});

// ─── the wizard ───────────────────────────────────────────────────────────

test('onboarding writes to the service under the session organisation', () => {
  const route = code(ONBOARDING);
  expect(route).toMatch(/org\.saveOnboardingStep\(/);
  expect(route).toMatch(/org\.submitOnboardingStep\(/);
  expect(route).toMatch(/org\.attachOnboardingDocument/);
  expect(route).toMatch(/org\.submitOnboarding\(\)/);
  // Scoped by the session, never by anything the browser sends.
  expect(route).toMatch(/if \(!session\.businessId\)/);
  expect(route).not.toMatch(/orgId: z\./);

  const api = code('lib/consoleApi.ts');
  expect(api).toMatch(/`\/org\/onboarding\/steps\/\$\{encodeURIComponent\(stepId\)\}`, 'PUT'/);
});

test('a step is only marked sent once the service has it', () => {
  const wizard = code(WIZARD);
  const send = wizard.slice(wizard.indexOf('const send = async'), wizard.indexOf('const upload ='));
  expect(send).toContain("await call({ action: 'send'");
  expect(send.indexOf('await call(')).toBeLessThan(send.indexOf('setCurrent('));
  expect(send).toMatch(/if \(!view\) return;/);
});

test('a document is fingerprinted from its bytes', () => {
  const wizard = code(WIZARD);
  expect(wizard).toMatch(/crypto\.subtle\.digest\('SHA-256', await file\.arrayBuffer\(\)\)/);
  expect(wizard).toMatch(/action: 'document'/);
  expect(read('components/DocumentSlot.tsx')).toMatch(/if \(file\) onUpload\(file\)/);
});

test('the bytes of a document actually leave the browser', () => {
  /*
   * The whole point of the document step, and for a long time the one thing it
   * did not do. The service had nowhere to put a file, so this recorded a name
   * and a SHA-256 and the certificate stayed on the applicant's computer — a
   * platform owner approved an organisation's access to citizens' footage on the
   * strength of a filename. The upload endpoint landed on 16 September.
   *
   * Declared first, then sent: the service checks the bytes against the hash
   * that declared them, so the order is load-bearing.
   */
  const wizard = code(WIZARD);
  expect(wizard).toMatch(/const declared = await call\(/);
  expect(wizard).toMatch(/if \(!declared\) return;/);
  expect(wizard).toMatch(/method: 'PUT',\s*headers: \{ 'Content-Type': file\.type/);
  expect(wizard).toMatch(/body: file,/);

  // And a declare that never uploaded is a failure, not a tick.
  expect(wizard).toMatch(/The file did not upload/);

  const route = code(ONBOARDING);
  expect(route).toMatch(/export async function PUT/);
  expect(route).toMatch(/org\.uploadOnboardingDocumentBytes\(documentType, bytes, mimeType\)/);
  // Scoped by the session, exactly as the POST handler is.
  const put = route.slice(route.indexOf('export async function PUT'));
  expect(put).toMatch(/if \(!session\.businessId\)/);

  const api = read('lib/consoleApi.ts');
  expect(api).toMatch(/\/bytes`/);
  expect(api).toMatch(/rawBody: bytes/);
});

test('the console still keeps no document of its own on disk', () => {
  /*
   * Proxying the bytes is not storing them. The forbidden path stays forbidden:
   * the upload is a PUT on `/api/onboarding`, and nothing is written anywhere.
   */
  expect(fs.existsSync(path.join(SRC, 'app/api/onboarding/documents'))).toBe(false);
  const route = code(ONBOARDING);
  expect(route).not.toMatch(/writeFile|createWriteStream/);
});

test('the page reads the service application and normalises it', () => {
  const page = code(PAGE);
  expect(page).toMatch(/org\.onboarding<unknown>\(\)/);
  expect(page).toMatch(/normaliseOnboarding\(result\.data/);
  expect(page).toMatch(/<OnboardingWizard/);
  // No organisation at all is a statement, not an outage.
  expect(page).toMatch(/refused && !session\.businessId/);
  // Approved: the session predates it, so they are told to sign in again.
  expect(page).toMatch(/application\.approvedAtIso/);
  expect(page).toMatch(/<SignInAgain \/>/);
});

// ─── the platform owner's side ────────────────────────────────────────────

test('review decisions reach the service', () => {
  const route = code('app/api/platform/applications/[id]/route.ts');
  expect(route).toMatch(/platform\.approve\(id\)/);
  /*
   * The screening carries the administrator's finding.
   *
   * It sent an empty body, on the assumption that the service ran the check.
   * It does not — `clear` is required, and the service answered "Request
   * validation failed. (issues: clear: Required)" every time, so no application
   * could ever reach approval.
   */
  expect(route).toMatch(/platform\.screen\(id, input\.clear\)/);
  expect(route).toMatch(/decision: z\.literal\('screening'\), clear: z\.boolean\(\)/);
  expect(route).toMatch(/platform\.decideStep\(id, input\.stepId/);
  expect(route).toMatch(/accountType !== 'platform_owner'/);
  expect(route).toMatch(/note: z\.string\(\)\.trim\(\)\.min\(1/);

  const review = code('components/ApplicationReview.tsx');
  expect(review).toMatch(/fetch\(`\/api\/platform\/applications\/\$\{encodeURIComponent\(application\.id\)\}`/);
  // Screening is never marked clear in the browser: the reviewer says so, and
  // the service records it. Nothing here assumes the answer.
  expect(review).not.toMatch(/screeningClear: true/);
  expect(review).toMatch(/decision: 'screening', clear: true/);
  expect(review).toMatch(/decision: 'screening', clear: false/);
});

test('a reviewer can clear every outstanding step at once, and is moved along', () => {
  /*
   * Three steps read on one screen still took three clicks and two tab changes
   * to record. Approving one now moves to the next unreviewed step, and
   * "Approve all" clears the rest in one action.
   *
   * It stops on the first refusal: these decide who may license the public's
   * footage, and a partial result the reviewer cannot see is worse than a stop
   * with the service's own reason on screen. It also never approves the
   * organisation itself — that still needs screening and its own button.
   */
  const review = code('components/ApplicationReview.tsx');
  expect(review).toMatch(/const approveOutstanding = async \(\) => \{/);
  expect(review).toMatch(/if \(!sent\) return;/);
  expect(review).not.toMatch(/approveOutstanding[\s\S]{0,400}decision: 'approved'/);
  // Approving advances; sending back stays put, so the reason stays visible.
  expect(review).toMatch(/if \(status === 'approved'\) \{/);
});

test('a whole application can be declined, with a reason', () => {
  /*
   * There was no endpoint for this until 16 September, so the console answered
   * its own Decline button with a 501 telling the reviewer to send the offending
   * step back instead. The reason is required either way: an applicant told only
   * "declined" reapplies with the same problem, and the service shows it to them
   * on `GET /org/onboarding`.
   */
  const route = code('app/api/platform/applications/[id]/route.ts');
  expect(route).toMatch(/platform\.reject\(id, input\.note\)/);
  expect(route).not.toMatch(/status: 501/);

  const api = read('lib/consoleApi.ts');
  expect(api).toMatch(/\/reject`/);
  // The console says `note`, the service says `reason`.
  expect(api).toMatch(/\{ reason \}/);
  // Keyed, so a double-click declines once.
  expect(api).toMatch(/`reject:\$\{id\}`/);

  const review = code('components/ApplicationReview.tsx');
  expect(review).toMatch(/decision: 'rejected'/);
  expect(review).toMatch(/Decline application/);
});

test('a reviewer can open the document, not just read its name', () => {
  /*
   * The whole point of the document step. Approving an organisation on the
   * strength of a filename is what this prevents, and it is what the screen did
   * for as long as the service kept no bytes.
   */
  const review = code('components/ApplicationReview.tsx');
  expect(review).toMatch(
    /href=\{`\/api\/platform\/applications\/\$\{encodeURIComponent\(applicationId\)\}\/documents\/\$\{encodeURIComponent\(d\.id\)\}`\}/,
  );

  const route = code('app/api/platform/applications/[id]/documents/[documentType]/route.ts');
  // Identity documents: a platform owner, or a 404 that admits nothing.
  expect(route).toMatch(/session\.accountType !== 'platform_owner'/);
  expect(route).toMatch(/Not found\./);
  // Streamed, and never held by a shared cache.
  expect(route).toMatch(/new NextResponse\(upstream\.body/);
  expect(route).toMatch(/'Cache-Control': 'private, no-store'/);
  // The token is attached here, which is the only place it exists.
  expect(route).toMatch(/Authorization: `Bearer \$\{session\.accessToken\}`/);
});

test('the approvals queue is the service queue alone, normalised', () => {
  const page = code('app/(platform)/platform/approvals/page.tsx');
  expect(page).toMatch(/platform\.applications</);
  expect(page).toMatch(/normaliseOnboarding\(row\)/);
  expect(page).not.toMatch(/HeldApplications|DecidedApplications/);
});
