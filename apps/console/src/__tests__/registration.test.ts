import fs from 'fs';
import path from 'path';

/**
 * Registering an organisation.
 *
 * The route used to be a simulation — it invented a `businessId`, wrote a
 * session with **no backend credential**, and returned a redirect. The
 * applicant was signed in, sent to `/onboarding`, and the first thing that page
 * did was ask the API a question with nothing to ask it with. What they saw was
 * "Signed out. Your session ended." on a page they had never been signed in to.
 *
 * Nothing about that was catchable by a typecheck: the session was structurally
 * valid, the redirect was correct, and the failure happened one navigation
 * later in a different file.
 *
 * Asserted against the source because the route needs a live backend and a
 * cookie store, and what matters is that the calls are on the path at all.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const registerRoute = () => read('app/api/auth/register/route.ts');

test('registration creates a real account on the backend', () => {
  const src = registerRoute();
  expect(src).toMatch(/apiRequest<[^>]*>\('\/auth\/register'/);
  expect(src).toMatch(/method: 'POST'/);
});

test('the session carries the token the backend issued', () => {
  /*
   * The whole bug. Without this the session is a shell: every page behind it
   * fails on its first request, and the copy for that failure is "your session
   * ended" — which is both wrong and unactionable.
   */
  const src = registerRoute();
  const sessionWrite = src.slice(src.indexOf('await createSession('));
  expect(sessionWrite).toMatch(/accessToken: tokens\.accessToken/);
});

test('nothing invents an organisation id', () => {
  /*
   * `biz_new_${Date.now()}` was a locally-minted id for an organisation the
   * server had never heard of. Every subsequent call scoped to it would have
   * been asking about something that does not exist.
   */
  expect(registerRoute()).not.toMatch(/biz_new_/);
  expect(registerRoute()).not.toMatch(/Simulated/i);
});

test('a password is required, and long enough for the server', () => {
  /*
   * Registration collected none, so an applicant whose session expired had no
   * credential that could recreate it — they were locked out of their own
   * application permanently.
   */
  expect(registerRoute()).toMatch(/password: z\.string\(\)\.min\(8/);
  expect(read('app/register/company/RegisterForm.tsx')).toMatch(/type="password"/);
});

test('the form sends the password it collected', () => {
  // A field on screen that never reaches the request is worse than no field.
  const form = read('app/register/company/RegisterForm.tsx');
  const submit = form.slice(form.indexOf("fetch('/api/auth/register'"));
  expect(submit).toMatch(/password,/);
});

test('the form will not submit without a usable password', () => {
  const form = read('app/register/company/RegisterForm.tsx');
  expect(form).toMatch(/password\.length < 8/);
});

test('an account that already exists says so, rather than failing vaguely', () => {
  /*
   * The most likely second attempt: somebody registers, loses the session, and
   * tries again. "Something went wrong" would send them to support; "sign in
   * instead" solves it.
   */
  const src = registerRoute();
  expect(src).toMatch(/status === 409/);
  expect(src).toMatch(/Sign in instead/);
});

test('an outage is not reported as a rejected registration', () => {
  // Telling somebody their details were refused when the service was simply
  // unreachable sends them to change details that were never wrong.
  expect(registerRoute()).toMatch(/could not be reached, so nothing was registered/);
});

test('the applicant is not classed as an organisation the server has never heard of', () => {
  /*
   * Claiming `organisation` would drop them into a console whose every page the
   * server refuses — which is the screen this whole change exists to remove.
   */
  const src = registerRoute();
  const sessionWrite = src.slice(src.indexOf('await createSession('));
  expect(sessionWrite).toMatch(/accountType: 'reporter'/);
  expect(sessionWrite).toMatch(/onboardingComplete: false/);
});

test('an applicant reaches onboarding rather than the reporter dead end', () => {
  /*
   * They are a reporter account by the server's reckoning, and reporters are
   * sent to `/no-console` — "Reporting happens on the phone." Somebody who
   * filled in an organisation's details a moment ago being told that reads as
   * the registration having been thrown away.
   */
  const middleware = read('middleware.ts');
  expect(middleware).toMatch(/hasApplication\(session\)/);
  expect(middleware).toMatch(/'\/onboarding'/);
});

test('signing in and middleware agree on where an applicant belongs', () => {
  /*
   * The bug this missed. The two answers were computed separately: middleware
   * had its own `applicantHome`, while the login route called `homeFor`, which
   * knows only the account type — so it returned `/no-console` for an applicant
   * who had registered, onboarded and been approved.
   *
   * Middleware could not correct it, because `/no-console` is a public path and
   * returns before the applicant rules run. One function now answers for both.
   */
  const token = read('lib/token.ts');
  expect(token).toMatch(/export function homeForSession/);
  const fn = token.slice(token.indexOf('export function homeForSession'));
  expect(fn.slice(0, fn.indexOf('}'))).toMatch(/hasApplication\(user\).*'\/onboarding'/s);

  expect(read('app/api/auth/login/route.ts')).toMatch(/redirectTo: homeForSession\(user\)/);
  expect(read('middleware.ts')).toMatch(/homeForSession\(session\)/);
});

test('an applicant is never left on the reporter page', () => {
  /*
   * `/no-console` is public, so middleware returns before the applicant rules.
   * That is precisely how somebody approved by an operator ended up staring at
   * "Reporting happens on the phone" after signing in.
   */
  const middleware = read('middleware.ts');
  const publicBranch = middleware.slice(middleware.indexOf('if (matches(pathname, PUBLIC_PATHS))'));
  const branch = publicBranch.slice(0, publicBranch.indexOf('if (!session)'));
  expect(branch).toMatch(/pathname === '\/no-console'/);
  expect(branch).toMatch(/hasApplication\(session\)/);
  expect(branch).toMatch(/'\/onboarding'/);
});

test('the applicant check runs before the reporter redirect', () => {
  // Reversed, the reporter rule fires first and the applicant never reaches
  // onboarding at all.
  const middleware = read('middleware.ts');
  const applicantRule = middleware.indexOf('if (hasApplication(session)) {');
  const reporterRule = middleware.indexOf("if (session.accountType === 'reporter')");
  // Both present, then ordered: `indexOf` answers -1 for a rule that has been
  // deleted, and -1 is less than every real position.
  expect(applicantRule).toBeGreaterThan(-1);
  expect(reporterRule).toBeGreaterThan(-1);
  expect(applicantRule).toBeLessThan(reporterRule);
});

test('onboarding tells an applicant the truth instead of showing an outage', () => {
  /*
   * `/org/onboarding` answers 403 for somebody with no organisation. That is
   * the expected reply, not a fault, and rendering it as an outage would say
   * the service is down while it works exactly as built.
   */
  const page = read('app/(organisation)/onboarding/page.tsx');
  expect(page).toMatch(/status === 403/);
  /*
   * Asserted on the behaviour, not on a sentence.
   *
   * This pinned the exact phrase "is not registered yet", so rewriting the copy
   * for the applicant — which was the point of the rewrite — broke a test about
   * error handling. What matters is that a 403 renders an explanation and
   * offers a way forward, not which words it uses.
   */
  /*
   * What the 403 means changed. It says "this is an application the console is
   * holding", and such an applicant belongs in the wizard — not on a page
   * explaining why they cannot proceed.
   */
  expect(page).toMatch(/await applicationFor\(session\.email\)/);
  expect(page).toMatch(/<OnboardingWizard/);
});

test('onboarding stores the documents it collects', () => {
  /*
   * Inverted, because the reason changed rather than went away.
   *
   * The wizard asks for a certificate of incorporation and a director's
   * identity document, and collecting those into a form with nowhere to send
   * them is worse than not asking — which is exactly what it did:
   * `onUpload(file.name)` kept the name and dropped the bytes, so a reviewer
   * would have been approving a filename. There is somewhere to send them now,
   * so the rule is that they actually go there.
   */
  const slot = read('components/DocumentSlot.tsx');
  expect(slot).toMatch(/onUpload: \(file: File\) => void/);

  const wizard = read('app/(organisation)/onboarding/OnboardingWizard.tsx');
  expect(wizard).toMatch(/'\/api\/onboarding\/documents'/);
  expect(wizard).toMatch(/form\.append\('file', file\)/);
});

test('the wizard still renders for an organisation that really exists', () => {
  // The opposite failure: refusing everyone would break the real flow the
  // moment the backend can create an organisation.
  const page = read('app/(organisation)/onboarding/page.tsx');
  expect(page).toMatch(/org\.onboarding<OnboardingApplication>\(\)/);
  expect(page).toMatch(/<OnboardingWizard/);
});
