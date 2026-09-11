import fs from 'fs';
import path from 'path';

/**
 * A place a person recognises, not a pair of numbers.
 *
 * The service resolves no place names — every incident comes back
 * `"label": null` with the fix that produced it on the same object, and
 * `LocationInput` has no field for a client to supply one, so nothing in the
 * platform has ever put a name to a report.
 *
 * The desks fell back to `5.6028° N, 0.2179° W`. That is true, checkable, and
 * useless to an editor deciding whether a fire report is worth running: nobody
 * knows where 5.6028 is. The same point is **Abelenkpe, Accra**, and the point
 * next to it on the same queue is **Airport Residential Area, Accra** — two
 * places any reader in Accra can tell apart at a glance and neither of which is
 * legible as a decimal.
 *
 * A stopgap, and it says so. The right place is ingest — one lookup per report,
 * stored on the record — which is item 11 in BACKEND-REQUESTS.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note about it. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('calling somebody else’s free service politely', () => {
  const src = code('placeName.ts');

  test('results are cached, and the cache survives a restart', () => {
    /*
     * Forty rows on the desk are typically three or four places: the key is the
     * fix rounded to about a hundred metres, because a suburb name does not
     * change inside one. Without that this would be a lookup per row, per
     * render, for the same street.
     */
    expect(src).toMatch(/KEY_PRECISION = 3/);
    expect(src).toMatch(/toFixed\(KEY_PRECISION\)/);
    expect(src).toMatch(/readFile\(\s*cacheFile\(\)/);
    expect(src).toMatch(/writeFile\(\s*cacheFile\(\)/);
  });

  test('a miss is remembered as firmly as a hit', () => {
    // Otherwise a point the geocoder has nothing for is re-asked on every
    // render for ever, which is the rudest possible use of a free service.
    expect(src).toMatch(/memory\.set\(key, label\)/);
    expect(src).toMatch(/cached !== undefined/);
  });

  test('one request a second, with an agent that says who is calling', () => {
    expect(src).toMatch(/SPACING_MS = 1_100/);
    expect(src).toMatch(/lastRequestAt \+ SPACING_MS/);
    expect(read('placeName.ts')).toMatch(/User-Agent/);
  });

  test('a page render is never held up for long', () => {
    /*
     * Whatever has not resolved inside the budget falls back to the
     * coordinates and is filled in on a later render, once the cache has it. A
     * desk that will not paint until a geocoder answers is worse than a desk
     * showing degrees.
     */
    expect(src).toMatch(/BUDGET_MS = 2_500/);
    expect(src).toMatch(/Date\.now\(\) > deadline/);
  });

  test('every failure path returns null rather than throwing', () => {
    /*
     * Down, rate-limiting, unreachable, unparseable, or switched off by
     * configuration. A missing place name must never cost somebody the report.
     */
    expect(src).toMatch(/if \(!response\.ok\) return null;/);
    expect(src).toMatch(/DAWURO_GEOCODER !== 'off'/);
    expect(src).toMatch(/if \(!ENABLED\) return out;/);
  });

  test('the name is short enough for a queue row', () => {
    // The full display name is a postal address: "Onyankle Link, Abelenkpe,
    // Accra, Ayawaso West Municipal District, Greater Accra Region, Ghana".
    expect(src).toMatch(/a\.suburb/);
    expect(src).toMatch(/\$\{local\}, \$\{wider\}/);
  });
});

describe('what the desks actually receive', () => {
  test('a label the service sent is never overwritten', () => {
    /*
     * It is the authority. This fills a gap; it does not second-guess a name
     * somebody else resolved, and a guess replacing a fact on a provenance
     * stamp would be the worst version of this feature.
     */
    const api = code('consoleApi.ts');
    const fn = api.slice(api.indexOf('export async function withPlaceNames'));
    expect(fn.slice(0, 900)).toMatch(/if \(!location \|\| location\.label\) return report;/);
  });

  test('both queues of reports get it', () => {
    // The editorial desk and the organisation inbox show the same kind of row
    // about the same kind of report, and both were showing degrees.
    const api = code('consoleApi.ts');
    expect(api).toMatch(/reports: await withPlaceNames\(reports\)/);
    expect(api).toMatch(/withPlaceNames\(await collect<T>\('\/org\/inbox'\)\)/);
  });

  test('it is resolved on the server, once for the whole queue', () => {
    /*
     * Every row standing on the same street shares one lookup, and no key or
     * third-party call is exposed to the browser. `placeName` is server-only
     * for the same reason the API client is.
     */
    expect(read('placeName.ts')).toMatch(/^import 'server-only';/m);
    expect(code('consoleApi.ts')).toMatch(/const places = await resolvePlaces\(points\)/);
  });
});
