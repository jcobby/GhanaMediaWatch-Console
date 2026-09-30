import fs from 'fs';
import path from 'path';

/**
 * Somebody can ask an organisation to add them.
 *
 * **Half of joining was built on the service and reachable from no client.**
 * `POST /membership-requests` is live, and its own summary names its caller —
 * *"Signed-in outsider path for the console /join page"*. That page stated the
 * opposite: that the service had no endpoint which raises a membership request,
 * and that joining happens only by invite.
 *
 * It was true when written, and stopped being true without anybody noticing,
 * which is the failure worth guarding. The symptom was quiet and absurd: an
 * organisation's Team screen carried a **Requests** tab that listed and decided
 * requests no client could create, so it was empty on every organisation
 * forever and looked like a feature nobody used.
 *
 * Source-read, because what is being checked is that a path exists end to end —
 * a form that posts, a route that forwards, a helper that names the endpoint.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('the page posts a request rather than explaining that it cannot', () => {
  const form = code('app/join/JoinForm.tsx');
  expect(form).toMatch(/fetch\('\/api\/membership-requests'/);
  expect(form).toMatch(/orgId: businessId/);

  /*
   * The claim that used to sit at the top of this page. Prose is stripped
   * first, so the note explaining the history does not read as the bug.
   */
  expect(form).not.toMatch(/no endpoint that raises a membership request/);
  expect(form).not.toMatch(/There is no application to fill in here/);
});

test('it says sent only when the service accepted it', () => {
  /*
   * The first version of this page faked the submit and said "Request sent",
   * so people waited on a decision that no screen could ever show. An
   * optimistic flag here is that bug again.
   */
  const form = code('app/join/JoinForm.tsx');
  expect(form).toMatch(/if \(!res\.ok\) \{/);
  expect(form).toMatch(/setSent\(true\);/);
  // The success flag is set after the failure branch returns, never before it.
  expect(form.indexOf('setFailure(')).toBeLessThan(form.lastIndexOf('setSent(true)'));
});

test('the route requires a session and is not org-scoped', () => {
  /*
   * The caller is by definition outside the organisation, so there is no
   * `X-Dawuro-Org` to send — but the service attaches the request to the
   * signed-in user, and without one "who is asking" has no answer.
   */
  const route = code('app/api/membership-requests/route.ts');
  expect(route).toMatch(/readSession\(\)/);
  expect(route).toMatch(/status: 401/);
  expect(route).toMatch(/publicApi\.requestMembership/);
  expect(route).not.toMatch(/orgId:\s*session/);
});

test('an existing request is told apart from a failure', () => {
  /*
   * 409 is the one refusal worth its own words: the service answers it when
   * there is already a request or already a membership. "That could not be
   * sent" would send somebody to chase a colleague about a request already
   * sitting in their queue.
   */
  const route = code('app/api/membership-requests/route.ts');
  expect(route).toMatch(/cause\.status === 409/);
  expect(read('app/api/membership-requests/route.ts')).toMatch(/already/i);
});

test('the helper names the endpoint the service documents', () => {
  const api = code('lib/consoleApi.ts');
  expect(api).toMatch(/'\/membership-requests'/);
  expect(api).toMatch(/requestMembership/);
  // Keyed on the organisation, so a second click is one request and a genuinely
  // different organisation is not read as a replay of the first.
  expect(api).toMatch(/membership-request:\$\{body\.orgId\}/);
});

test('the organisation still decides, and the console still lets it', () => {
  // The other end of the same flow, which has always worked and must keep
  // working: this form only creates what that screen acts on.
  const api = code('lib/consoleApi.ts');
  expect(api).toMatch(/membershipRequests/);
  expect(api).toMatch(/decideMembership/);
});
