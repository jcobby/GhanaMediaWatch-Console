import fs from 'fs';
import path from 'path';

/**
 * One word for one thing, and a line the rename must not cross.
 *
 * The product called the same party an "organisation" in 360 places and a
 * "business" in 159, often on the same screen: a reporter was asked to "Offer
 * to businesses" and then to "Choose organisations", and was told "no
 * organisation has joined the platform" if none had. It is one entity — a
 * newsroom, a district assembly, NADMO, an insurer — and it is called an
 * organisation everywhere now.
 *
 * **The interesting half of this rule is what stayed.** A vocabulary sweep is
 * exactly the kind of change that reads correctly and breaks the wire, and this
 * one did: it rewrote `GET /platform/businesses` to `/platform/organisations`,
 * which is a real and *different* endpoint — a POST that creates one. Nothing
 * failed to compile. The console simply pointed a read at a route that does not
 * answer reads.
 *
 * So three things are frozen, and this is the file that says why:
 *
 *   1. **Property names on the wire.** `businessId`, `businessName`,
 *      `requestedBusinessIds` and their neighbours are what the server sends and
 *      accepts. Renaming a field the API validates is renaming the contract.
 *   2. **`/platform/businesses`.** The path is the server's, whatever we call
 *      the method that reads it.
 *   3. **`business` as a NewsSection.** A different word entirely — the desk a
 *      story runs on, alongside Ghana, Africa and Sport. It has nothing to do
 *      with the party that licenses a report.
 */

const APP = path.resolve(__dirname, '..');
const CORE = path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'core', 'src');

function sources(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(root);
  return out;
}

const FILES = [...sources(APP), ...sources(CORE)];
const read = (file: string) => fs.readFileSync(file, 'utf8');
const rel = (file: string) => path.relative(path.resolve(APP, '..', '..', '..'), file);

describe('the word a person reads', () => {
  test('nothing in the interface still says business', () => {
    /*
     * Comments and the frozen names below are stripped first, so this is about
     * what a screen renders and what the code calls things — not about prose
     * explaining the rename.
     */
    const offenders: string[] = [];

    for (const file of FILES) {
      if (file.includes('__tests__')) continue;

      const code = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        // The three frozen cases, removed before the search.
        .replace(/\b(requestedBusinessIds|suggestedBusinessIds|directedBusinessIds)\b/g, ' ')
        .replace(/\b(businessId|businessIds|businessName)\b/g, ' ')
        .replace(/'\/platform\/businesses'/g, ' ')
        .replace(/'business'/g, ' ')
        .replace(/business: 'Business News'/g, ' ');

      if (/\bbusiness(es)?\b/i.test(code)) offenders.push(rel(file));
    }

    expect(offenders).toEqual([]);
  });
});

describe('the line the rename must not cross', () => {
  test('the platform list is still read from its own path', () => {
    /*
     * The one this actually caught. `GET /platform/businesses` lists them;
     * `POST /platform/organisations` creates one. The sweep pointed the first
     * at the second and nothing complained.
     */
    const api = read(path.join(APP, 'lib', 'consoleApi.ts'));
    expect(api).toMatch(/collect<T>\('\/platform\/businesses'\)/);
  });

  test('the wire property names are untouched', () => {
    /*
     * These are the server's, and `requestedBusinessIds` in particular has form:
     * the phone once sent `directedBusinessIds` instead, the server accepted and
     * dropped it, and reports a reporter had deliberately addressed to two
     * agencies arrived addressed to nobody.
     */
    const core = read(path.join(CORE, 'types', 'dawuro.ts'));
    expect(core).toMatch(/requestedBusinessIds: string\[\]/);
    expect(core).toMatch(/businessId: string/);
  });

  test('the business news desk is not an organisation', () => {
    // A different word. The sweep renamed the desk and its label; both are back.
    const core = read(path.join(CORE, 'types', 'api.ts'));
    expect(core).toMatch(/'ghana' \| 'africa' \| 'world' \| 'business' \| 'politics' \| 'sport'/);
    expect(core).toMatch(/business: 'Business News'/);
  });

  test('a session signed before the rename still gets its console', () => {
    /*
     * `accountType` lives in the signed cookie. `'business' === 'organisation'`
     * is merely false, so without this an operator with a valid session is
     * quietly routed to "Reporting happens on the phone" — a real newsroom, a
     * real login, and no explanation.
     */
    const token = read(path.join(APP, 'lib', 'token.ts'));
    expect(token).toMatch(/stored === 'business' \? \{ \.\.\.user, accountType: 'organisation' \}/);
  });
});
