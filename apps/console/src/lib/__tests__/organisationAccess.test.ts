import fs from 'fs';
import path from 'path';

/**
 * An organisation reaching its own console.
 *
 * What is left of the applications test file once the console stopped keeping
 * applications itself: why a refused organisation page says what it says, the
 * organisation scope header, plans that could not be read, and licensing.
 */

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

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

  test('reads, paged reads, writes and the file upload all send it', () => {
    /*
     * Four separate request paths, and missing it on any one leaves a different
     * desk refused. `get`, `collect` and `send` cover reads, paged reads and
     * writes — licensing and publishing are `/org/*` writes.
     *
     * The fourth is the onboarding document upload, which cannot go through
     * `send`: it puts the raw file on
     * `/org/onboarding/documents/{documentType}/bytes` rather than JSON, so it
     * builds its own request and has to remember the header itself. That is
     * exactly the kind of call this count exists to catch — the number is here
     * so a fifth path cannot be added without somebody reading this.
     */
    const source = api();
    expect([...source.matchAll(/orgHeader\(path, /g)]).toHaveLength(4);
    expect(source).toMatch(/const extra = orgHeader\(path, identity\?\.orgId \?\? null\)/);
    expect(source).toMatch(/token, headers: extra/);
    // The upload's own header, alongside the content type the bytes carry.
    expect(source).toMatch(/headers: \{ \.\.\.orgHeader\(path, orgId\), 'Content-Type': mimeType \}/);
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

describe('a plan that could not be read', () => {
  /*
   * Reported as a crash on the inbox: `Cannot read properties of undefined
   * (reading 'perDownloadPesewas')`.
   *
   * `planFor` was typed as total — `SUBSCRIPTION_PLANS[tier]` returning a
   * `SubscriptionPlan` — so every caller believed it had one. Measured against
   * the live service the organisation's tier was absent, because `org.current`
   * read `/org/dashboard`, and that endpoint returns `{counts, dailyTrend,
   * recentHighPriority}` and nothing else. The index gave `undefined` and the
   * first page to price a download threw. Six pages had the same crash in them.
   */
  const source = (rel: string) => read(rel);

  test('the organisation is read from the endpoint that describes it', () => {
    /*
     * `/org/subscription` carries `orgId`, `tier`, `status`, `renewsAtIso`,
     * `seats`, `seatsUsed` and `metering` — verified against the live service.
     * `/org/dashboard` carries none of them.
     */
    const api = source('lib/consoleApi.ts');
    expect(api).toMatch(/get<OrgSubscription>\('\/org\/subscription'\)/);
    // The *call*, not the note explaining why it is gone — this reader does
    // not strip comments and the history is worth keeping in the source.
    const current = api.slice(api.indexOf('current: async'), api.indexOf('inbox: async'));
    expect(current).not.toMatch(/get<[^>]*>\('\/org\/dashboard'\)/);
  });

  test('an unknown tier is null rather than undefined', () => {
    // The type now says what is true, so every caller has to decide what to
    // show — which on a page quoting a price is a decision worth forcing.
    const billing = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'packages/core/src/logic/billing.ts'),
      'utf8',
    );
    expect(billing).toMatch(/export function planFor\(tier: unknown\): SubscriptionPlan \| null/);
  });

  test('not knowing a price is never rendered as free', () => {
    /*
     * `downloadCharge` returning 0 for a missing plan would put "no charge" on
     * a button whose click is billable. Null and zero are different statements.
     */
    const billing = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'packages/core/src/logic/billing.ts'),
      'utf8',
    );
    expect(billing).toMatch(/export function downloadCharge\([\s\S]{0,60}\): number \| null/);
    expect(billing).toMatch(/if \(!plan\) return null;/);
  });

  test('"unlimited" is never claimed for a plan we could not read', () => {
    // Telling an organisation their downloads are covered when we do not know
    // their plan invites spending they will be invoiced for.
    const billing = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'packages/core/src/logic/billing.ts'),
      'utf8',
    );
    expect(billing).toMatch(/return plan\?\.perDownloadPesewas === null/);
  });

  test('a billing page with no plan says so instead of printing figures', () => {
    for (const rel of [
      'app/(organisation)/account/page.tsx',
      'app/(organisation)/surveys/page.tsx',
    ]) {
      expect([rel, /if \(!plan\) return <PlanUnavailable/.test(source(rel))]).toEqual([rel, true]);
    }
  });

  test('billing pages that read real invoices do not estimate from an unknown plan', () => {
    /*
     * Checkout charges the invoice the service issued, so it needs no plan at
     * all. The invoices page still lists issued invoices, and says the running
     * estimate is missing instead of printing one.
     */
    expect(source('app/(organisation)/checkout/page.tsx')).not.toMatch(/planFor|periodCost/);
    const invoices = source('app/(organisation)/invoices/page.tsx');
    expect(invoices).toMatch(/plan \? \(/);
    expect(invoices).toMatch(/running estimate is not shown/);
  });
});

describe('licensing reaches the service', () => {
  /*
   * It was `setLicensed(new Set(...).add(id))` and nothing else: the row moved
   * to the Licensed tab, the button said "Downloaded", and the service was told
   * nothing. A reload brought the report back unlicensed, and an officer who had
   * bought four reports had bought none. The inbox carried a banner saying so.
   */
  const workspace = () => read('app/(organisation)/inbox/InboxWorkspace.tsx');

  test('the purchase is posted', () => {
    expect(workspace()).toMatch(
      /\/api\/org\/incidents\/\$\{encodeURIComponent\(incidentId\)\}\/license/,
    );
  });

  test('the tick appears only after the service confirms', () => {
    /*
     * An optimistic tick here is a claim that money changed hands, which is the
     * one claim this screen must not make on the strength of a click.
     */
    const source = workspace();
    const success = source.indexOf('setLicensed((prev) => new Set(prev).add(incidentId))');
    const guard = source.indexOf('if (!response.ok)');
    expect(guard).toBeGreaterThan(-1);
    expect(success).toBeGreaterThan(guard);
  });

  test('a refusal is shown in the service own words', () => {
    // A report whose verification state forbids licensing and a subscription
    // that cannot cover it are different answers; only one is worth retrying.
    expect(workspace()).toMatch(/setPurchaseError\(/);
    expect(workspace()).toMatch(/purchaseError \? \(/);
  });

  test('the button cannot be pressed twice into one purchase', () => {
    expect(workspace()).toMatch(/disabled=\{\s*buying \|\|/);
  });

  test('the charge is idempotent at the service', () => {
    // A double-clicked button or a retried request must not charge twice.
    expect(read('lib/consoleApi.ts')).toMatch(/`license:\$\{incidentId\}`/);
  });

  test('the banner that admitted it did nothing is gone', () => {
    const page = read('app/(organisation)/inbox/page.tsx');
    expect(page).not.toMatch(/NotWired/);
  });
});
