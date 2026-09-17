import fs from 'fs';
import path from 'path';

/**
 * Every page in the organisation shell checks the role, or says why it does not.
 *
 * Six of them checked nothing at all, and one was the inbox. The hole was not a
 * forgotten line on a single page — it was structural, and worth stating so the
 * shape is recognised if it forms again:
 *
 *   - **Middleware** gates these paths on the account *type*
 *     (`accountType !== 'organisation'`) and never reads `session.role`.
 *   - **The layout** calls `requireSession()` and says outright that it trusts
 *     middleware, which is true — for account type, which is not role.
 *   - **The pages** in the capability-unlocked set (`/agent`, `/invoices`,
 *     `/affiliations`, `/assignments`, `/earnings`, `/support`) each call
 *     `roleCan`. The five in `ORGANISATION_BASE` plus `/surveys` called nothing.
 *
 * So an Agent — who does not hold `view_inbox` — was offered the inbox in the
 * sidebar and served the queue of citizens' footage on arrival, and `/surveys`
 * was gated in the menu and nowhere else, reachable by typing the URL.
 *
 * Note what this test does *not* claim. Nobody outside the organisation could
 * reach any of it: middleware still requires an organisation account. This was
 * an intra-organisation privilege problem, which is serious without being a
 * breach, and the distinction is worth keeping straight in the fix as well as
 * in the report.
 */

const ORG = path.resolve(__dirname, '..', 'app', '(organisation)');

const code = (file: string) =>
  fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/**
 * Pages that are deliberately open to every member of the organisation.
 *
 * Kept short, and each one earns its place in a comment on the page itself:
 *
 *   `/published`  every row is already on the public feed — the list is read
 *                 from the public record. Its one real power, withdrawal, is
 *                 guarded at the endpoint, which is where it actually happens.
 *   `/account`    the organisation describing itself to itself: its plan, its
 *                 own spend, its branches. Read-only, and nobody else's data.
 *   `/onboarding` runs before a role has been assigned at all. Gating it on a
 *                 capability would make the account unable to finish setting
 *                 itself up, which is the one thing it is there to do.
 *   `/checkout`   reached only from `/invoices`, which is gated on
 *                 `view_invoices` before anyone can arrive here.
 */
const OPEN_BY_DESIGN = ['account', 'checkout', 'onboarding', 'published'];

function organisationPages(): { name: string; file: string }[] {
  const found: { name: string; file: string }[] = [];
  (function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'page.tsx') {
        found.push({ name: path.relative(ORG, path.dirname(full)).replace(/\\/g, '/'), file: full });
      }
    }
  })(ORG);
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

test('the sweep actually finds the shell', () => {
  // Otherwise every assertion below passes by examining nothing.
  const names = organisationPages().map((p) => p.name);
  expect(names.length).toBeGreaterThanOrEqual(12);
  for (const expected of ['inbox', 'map', 'team', 'surveys', 'account', 'published']) {
    expect([expected, names.includes(expected)]).toEqual([expected, true]);
  }
});

test('every organisation page checks a capability, or is a documented exemption', () => {
  const unguarded = organisationPages()
    .filter((page) => !OPEN_BY_DESIGN.includes(page.name))
    .filter((page) => !/roleCan\(/.test(code(page.file)))
    .map((page) => page.name);

  expect(unguarded).toEqual([]);
});

test('the exemptions are real pages, so the list cannot rot', () => {
  /*
   * A stale name in `OPEN_BY_DESIGN` silently exempts nothing — but it also
   * hides that the page it named has gone, and the next person reads the list as
   * current. Cheap to check, and it keeps the list honest.
   */
  const names = organisationPages().map((p) => p.name);
  for (const exempt of OPEN_BY_DESIGN) {
    expect([exempt, names.includes(exempt)]).toEqual([exempt, true]);
  }
});

test('the inbox and its map are gated on the same capability', () => {
  /*
   * `/map` reads `org.inbox` and plots it. Gating the queue while leaving its
   * own map open would hand the same reports to the same person through another
   * door, in aggregate — which is arguably the more revealing view of them.
   */
  for (const page of ['inbox', 'map']) {
    const src = code(path.join(ORG, page, 'page.tsx'));
    expect([page, /roleCan\(session\.role, 'view_inbox'\)/.test(src)]).toEqual([page, true]);
  }
});

test('the gate does not lock out an organisation account that has no role', () => {
  /*
   * The trap in this whole fix, and the reason these pages cannot copy the
   * `!session.role || !roleCan(…)` form the capability-unlocked pages use.
   *
   * An organisation login may carry no role at all — the seeded institution
   * accounts have a `businessId` and nothing else — and `roleCan(undefined, …)`
   * is false for everything. Requiring a role on a page in the base shell would
   * therefore lock an institution out of its own inbox: a worse failure than the
   * one being fixed, and one that would look exactly like a broken product.
   *
   * A role present and lacking the capability is a denial. A role absent is not
   * an answer, and must not be read as one.
   */
  for (const page of ['commissions', 'inbox', 'map', 'surveys', 'team']) {
    const src = code(path.join(ORG, page, 'page.tsx'));
    expect([page, /if \(session\.role && !roleCan\(/.test(src)]).toEqual([page, true]);
    expect([page, /!session\.role \|\| !roleCan\(/.test(src)]).toEqual([page, false]);
  }
});

test('gating a page never takes access away from a roleless account', () => {
  /*
   * The rule that decides which of the two forms a page uses, stated once.
   *
   * `/earnings`, `/invoices`, `/affiliations`, `/assignments`, `/agent` and
   * `/support` reject an account with no role, and did so before any of this —
   * they are capability-*unlocked* extras, and that is their existing contract.
   *
   * `/surveys` and `/commissions` had no check whatever, so a roleless
   * institution login reaches them today. Closing the hole for roles that lack
   * the capability must not quietly close it for the organisation itself, which
   * is what copying the strict form onto them would have done. A fix that
   * removes access somebody already has is a regression wearing the clothes of
   * a fix, and this is the assertion that says so out loud.
   */
  const strict = ['agent', 'affiliations', 'assignments', 'earnings', 'invoices', 'support'];
  for (const page of strict) {
    const src = code(path.join(ORG, page, 'page.tsx'));
    expect([page, /!session\.role \|\| !roleCan\(/.test(src)]).toEqual([page, true]);
  }
});
