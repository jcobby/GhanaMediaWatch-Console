import fs from 'fs';
import path from 'path';
import { accountTypeFromKind } from '../auth';
import { homeFor } from '../token';

/**
 * Who the console thinks you are.
 *
 * Signing in with editor credentials landed on `/no-console` — "Reporting
 * happens on the phone" — for somebody who is not a reporter and does not own a
 * phone-side account at all.
 *
 * The cause was that the console *guessed*. `describeCaller` called
 * `/platform/audit`, then `/org/dashboard`, and inferred the account from
 * whichever did not refuse. An editor is refused by both — not a platform
 * owner, no organisation — so every editor fell through to the final
 * `return 'reporter'`. There was no editor branch anywhere in it, and no editor
 * could ever sign in successfully.
 *
 * The server now answers this outright. `GET /me` — "Describe the signed-in
 * caller (kind, org, role, memberships)" — and `POST /auth/login` returns the
 * same object inline, so an ordinary sign-in costs no extra request. Confirmed
 * against the live service:
 *
 *     {"kind":"platform_owner","userId":"usr_seed_owner","accountKind":
 *      "platform_owner","orgId":null,"role":null,"memberships":[]}
 *
 * There is no probe left anywhere in this file's subject. `accountTypeFromKind`
 * survives as the reader of that answer, and as the fallback for a server that
 * stops sending it.
 */

test('an editor is an editor', () => {
  // The whole bug, in one line.
  expect(accountTypeFromKind('editor')).toBe('editor');
});

test('a platform owner is a platform owner', () => {
  expect(accountTypeFromKind('platform_owner')).toBe('platform_owner');
});

test('a plain user is not settled by the claim', () => {
  /*
   * `kind` says nothing about organisation membership, so organisation-or-reporter
   * is decided by `memberships` instead. Null means "membership decides", and
   * claiming either here would be the old guess in a new place.
   */
  expect(accountTypeFromKind('user')).toBeNull();
});

test('an unrecognised claim is never promoted', () => {
  /*
   * The safe direction. A value this console has not seen falls through to the
   * membership check rather than being granted a console it does not
   * understand.
   */
  expect(accountTypeFromKind('superuser')).toBeNull();
  expect(accountTypeFromKind('')).toBeNull();
  expect(accountTypeFromKind(null)).toBeNull();
});

test('an editor has somewhere to land', () => {
  /*
   * Reading the role correctly is only half of it — if `homeFor` sent an editor
   * somewhere middleware refuses, they would bounce instead of landing.
   */
  expect(homeFor('editor')).toBe('/editorial');
});

test('the editorial console the redirect names exists', () => {
  // A redirect to a route with no page is a 404 dressed as a sign-in.
  const page = path.resolve(__dirname, '../../app/(editorial)/editorial/page.tsx');
  expect(fs.existsSync(page)).toBe(true);
});

// ─── the wiring ────────────────────────────────────────────────────────────

const auth = () => fs.readFileSync(path.resolve(__dirname, '../auth.ts'), 'utf8');

/** Comments removed, so a rule cannot match the note explaining it. */
const code = () =>
  auth()
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('the server is asked rather than guessed at', () => {
  /*
   * `GET /me` replaced the guessing entirely. The login response carries the
   * same object, so the endpoint is only called for a token that arrived
   * without one — an ordinary sign-in makes no extra request at all.
   */
  const src = code();
  expect(src).toContain("apiRequest<CallerDescription>('/me'");
  expect(src).toContain('tokens.me ?? (await fetchCaller(');
});

test('nothing is inferred from whether an endpoint refused', () => {
  /*
   * The shape of the original bug, and the reason it could never be right: a
   * probe cannot tell a refusal from an outage. `/org/dashboard` returning 403
   * meant "not a member", and it also meant "the backend is having a moment" —
   * which demoted a platform owner mid-incident.
   *
   * Membership is now a field, so the question has an answer instead of an
   * inference.
   */
  const src = code();
  expect(src).not.toContain("'/org/dashboard'");
  expect(src).not.toContain('/platform/audit');
  expect(src).toContain('primaryMembership');
});

test('a caller the server will not describe is not signed out', () => {
  /*
   * `/me` failing is not a failed sign-in — the token is valid, the server just
   * issued it. Throwing here would turn a blip on one endpoint into "those
   * credentials did not match", and send an operator to reset a password that
   * was never wrong.
   */
  /*
   * Bounded to `fetchCaller` itself. Slicing to the end of the file swept up
   * `accountTypeFromKind`, `subjectOf` and `readClaim`, which all return null
   * for their own reasons — so the assertion passed with the try/catch deleted.
   */
  const src = code();
  const start = src.indexOf('async function fetchCaller');
  const body = src.slice(start, src.indexOf('export function accountTypeFromKind', start));
  expect(body).toContain('catch');
  expect(body).toContain('return null');
});

test('the platform console is no longer inferred from an audit read', () => {
  /*
   * `/platform/audit` returning 200 was the old proof of ownership. It is also
   * a request that fails during an outage, which silently demoted a platform
   * owner to a reporter mid-incident.
   */
  expect(code()).not.toContain('/platform/audit');
});

test('the organisation comes from the server, not from a name we invented', () => {
  /*
   * The bug behind "We cannot load your organisation" on an approved account.
   * With no way to learn a real org id, the console minted its own — `held_…` —
   * which every `/org/*` endpoint correctly answered 403 to. `/me` carries the
   * real one, and a session built from it can actually read an inbox.
   */
  const src = code();
  expect(src).toContain('businessId: membership.orgId');
});

test('membership is read from the list as well as the top-level field', () => {
  /*
   * `orgId` and `role` were null for every account tested while `memberships`
   * is where the server puts them. Reading only the top level would leave a
   * genuine member with an empty console — which looks exactly like the bug
   * this replaces, and would be blamed on the backend.
   */
  /*
   * The *fallback* specifically. `memberships` is read twice — once to name the
   * organisation `orgId` already points at, and once to find one when it does
   * not — and only the second is the fallback. Matching the shared prefix
   * passed with the fallback deleted.
   */
  const src = code();
  const body = src.slice(src.indexOf('function primaryMembership'));
  expect(body).toContain('const first = me.memberships?.find((m) => m.orgId);');
});
