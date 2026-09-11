import { organisationNavigation, organisationHrefs } from '../logic/navigation';

/**
 * The organisation shell's menu, across the life of an account.
 *
 * Two failures this encodes, both of which shipped.
 *
 * The first: seven of the shell's fourteen pages were never listed, so a
 * organisation could not reach its own invoices except by typing the URL. The menu
 * was a hand-written array of seven sitting next to a folder of fourteen, and
 * nobody had ever compared them.
 *
 * The second: `Onboarding` was in that array unconditionally. Before completion
 * it was one of seven links, six of which the middleware bounced straight back
 * to it. After completion it stayed for the life of the account — a permanent
 * entry, pointing at nothing to do, reading as an outstanding task that could
 * never be cleared.
 */

const hrefs = (nav: ReturnType<typeof organisationNavigation>) =>
  nav.flatMap((s) => s.items.map((i) => i.href));

describe('while an organisation is still being onboarded', () => {
  const nav = organisationNavigation({ onboardingComplete: false, role: 'institution_admin' });

  test('onboarding is the only thing offered', () => {
    /*
     * Not merely first. The middleware redirects every other organisation route
     * back to `/onboarding` until it is done, so listing the inbox and the map
     * would be six links that all go to the same page — which reads as a
     * broken menu rather than as a setup step.
     */
    expect(hrefs(nav)).toEqual(['/onboarding']);
  });

  test('a capability cannot unlock a page early', () => {
    // `institution_admin` holds view_invoices. It still must not appear: the
    // account cannot reach it yet whatever its role says.
    expect(hrefs(nav)).not.toContain('/invoices');
  });
});

describe('once onboarding is finished', () => {
  const nav = organisationNavigation({ onboardingComplete: true, role: 'institution_admin' });

  test('onboarding disappears', () => {
    expect(hrefs(nav)).not.toContain('/onboarding');
  });

  test('the rest of the shell appears', () => {
    const list = hrefs(nav);
    for (const href of ['/inbox', '/map', '/published', '/team', '/account']) {
      expect([href, list.includes(href)]).toEqual([href, true]);
    }
  });

  test('the role still unlocks what it can do', () => {
    // The onboarding rule must not have swallowed the capability rule.
    expect(hrefs(nav)).toContain('/invoices');
  });
});

test('a missing flag is treated as finished', () => {
  /*
   * The safe default. An account whose token predates the flag would otherwise
   * be sent back to a setup screen it completed months ago, with no way out —
   * far worse than briefly showing a menu to somebody mid-setup.
   */
  expect(hrefs(organisationNavigation({}))).not.toContain('/onboarding');
  expect(hrefs(organisationNavigation({}))).toContain('/inbox');
});

test('an account with no role still gets a usable shell', () => {
  /*
   * Organisation logins carry a `businessId` and may carry no role at all, and
   * `roleCan(undefined, …)` is false for everything. A purely capability-driven
   * menu would leave such an account staring at an empty sidebar.
   */
  const list = hrefs(organisationNavigation({}));
  expect(list.length).toBeGreaterThanOrEqual(5);
  expect(list).toContain('/inbox');
});

test('the inbox count is shown only when there is one', () => {
  const withCount = organisationNavigation({ inboxCount: 4 })[0]!.items.find(
    (i) => i.href === '/inbox',
  );
  expect(withCount?.count).toBe(4);

  // Zero is omitted rather than rendered — a badge showing "0" is noise that
  // reads as an alert.
  const none = organisationNavigation({ inboxCount: 0 })[0]!.items.find((i) => i.href === '/inbox');
  expect(none?.count).toBeUndefined();
});

test('reachability spans the whole lifecycle', () => {
  // `organisationHrefs` answers "can anyone ever get here", so it includes
  // onboarding even though no single moment shows it beside the others.
  const all = organisationHrefs('institution_admin');
  expect(all).toContain('/onboarding');
  expect(all).toContain('/inbox');
  expect(new Set(all).size).toBe(all.length);
});
