import fs from 'fs';
import path from 'path';

/**
 * No page is a placeholder.
 *
 * The console is a simulation of a product that does not have a backend yet,
 * which makes "not built" an easy thing to leave on screen and a hard thing to
 * notice — the page renders, nothing errors, and it looks finished until
 * somebody clicks it in a demo.
 *
 * These assertions are about the *screens*. Whether the data behind them is
 * fixture or live is a separate question the backend answers later.
 */

const APP = path.resolve(__dirname, '../app');

function pages(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'api' || entry.name === '__tests__') continue;
      pages(full, found);
    } else if (entry.name === 'page.tsx') {
      found.push(full);
    }
  }
  return found;
}

const files = pages(APP);

/** Phrases that mean a screen is admitting it does not exist. */
const PLACEHOLDER = [
  'SectionStub',
  'Not built yet',
  'Coming soon',
  'still to come',
  'TODO',
  'Placeholder',
  'Under construction',
];

test('the sweep found the pages', () => {
  // Without this, a broken walk makes everything below vacuous.
  expect(files.length).toBeGreaterThan(20);
});

test('no page renders a placeholder', () => {
  const offenders: string[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const phrase of PLACEHOLDER) {
      if (source.includes(phrase)) {
        offenders.push(`${path.relative(APP, file)} — "${phrase}"`);
      }
    }
  }

  expect(offenders).toEqual([]);
});

test('the stub component is gone entirely', () => {
  expect(fs.existsSync(path.resolve(__dirname, '../components/admin/SectionStub.tsx'))).toBe(false);
});

test('every page renders something, rather than only redirecting', () => {
  /*
   * A page is allowed to be short. The console's convention is a thin server
   * route that loads data and hands it to a client workspace, so counting
   * lines would flag the nine role homes — which are three lines of logic and
   * a `<AdminDashboard>` — as unfinished.
   *
   * What actually distinguishes a finished page from a shell is whether it
   * renders anything at all. The root `/` is the one legitimate exception: it
   * is a router, not a page.
   */
  const empty = files.filter((file) => {
    const rel = path.relative(APP, file);
    if (rel === 'page.tsx') return false; // the root router

    const source = fs.readFileSync(file, 'utf8');
    const rendersComponent = /<[A-Z][A-Za-z]*/.test(source);
    return !rendersComponent;
  });

  expect(empty.map((f) => path.relative(APP, f))).toEqual([]);
});
