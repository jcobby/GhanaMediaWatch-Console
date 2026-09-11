import fs from 'fs';
import path from 'path';

/**
 * Screens speak to the person using them.
 *
 * `/onboarding` ended up rendering a paragraph addressed to whoever was
 * building the service — that an endpoint was missing, and what the wizard was
 * already built against. Somebody registering their newsroom read it and asked
 * "what is this, and where is the account", which is the correct reaction: they
 * filled in a form and want to know whether it worked and what to do next.
 *
 * Engineering detail is not wrong, it is addressed to the wrong reader. It
 * belongs in `BACKEND-REQUESTS.md`, which exists for exactly that.
 */

const APP = path.resolve(__dirname, '..', 'app');

/** Comments removed. Shared with the self-test below so both agree. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * Only the words a reader could actually see.
 *
 * JSX text nodes — what sits between `>` and `<` — with comments stripped
 * first. A whole-file search is far too blunt: it flags `retryHref="/platform/
 * approvals"` and `status === 404`, which are code, and would need suppressing
 * so often that the rule would stop meaning anything.
 */
function renderedText(file: string): string {
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  return [...src.matchAll(/>([^<>{}]+)</g)]
    .map((m) => m[1]!.trim())
    .filter((text) => /[a-z]{3}/i.test(text))
    .join('\n');
}

function pageFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'api' || entry.name === '__tests__') continue;
        walk(full);
      } else if (entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
  })(APP);
  return out;
}

/**
 * Words that only mean something to somebody building the thing.
 *
 * Deliberately few. "Service", "account" and "organisation" are ordinary
 * words; an endpoint, a schema or an env var name are not things anybody
 * reading a console screen can act on.
 */
const DEVELOPER_TERMS = [
  /\bendpoints?\b/i,
  /\bbackend\b/i,
  /\bAPI\b/,
  /\bschema\b/i,
  /\bDAWURO_API_URL\b/,
];

test('the sweep finds the pages', () => {
  // Otherwise the rule below passes by reading nothing.
  expect(pageFiles().length).toBeGreaterThan(30);
});

test('the reader is a person, not a developer', () => {
  const offenders: string[] = [];

  for (const file of pageFiles()) {
    const text = renderedText(file);
    for (const term of DEVELOPER_TERMS) {
      const hit = term.exec(text);
      if (!hit) continue;
      const rel = path.relative(APP, file).replace(/\\/g, '/');
      const around = text.slice(Math.max(0, hit.index - 40), hit.index + 60).replace(/\s+/g, ' ');
      offenders.push(`${rel} — "${around.trim()}"`);
    }
  }

  expect(offenders).toEqual([]);
});

test('the extractor reads copy and ignores code', () => {
  /*
   * Both halves matter. If it stopped stripping comments, every explanatory
   * note in the codebase would be reported as user-facing text and the rule
   * would be red for the wrong reason. If it stopped ignoring attributes, a
   * `retryHref="/platform/routing"` would be too.
   */
  const sample = [
    '/* a block comment mentioning an endpoint */',
    'const a = 1; // a line comment mentioning the backend',
    '<Outage retryHref="/platform/routing" />',
    '<p>The queue could not be read.</p>',
  ].join('\n');

  const src = stripComments(sample);
  const visible = [...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]!.trim()).join('\n');

  expect(visible).toContain('The queue could not be read.');
  expect(visible).not.toContain('block comment');
  expect(visible).not.toContain('line comment');
  expect(visible).not.toContain('/platform/routing');
});

test('onboarding answers what an applicant actually asked', () => {
  /*
   * "What is this, and where is the account" — so the copy has to say what
   * works, and what happens next.
   */
  /*
   * Read from the source with comments stripped, not through `renderedText`.
   *
   * That extractor is deliberately approximate — it exists to *find* stray
   * developer language across forty files, where a few missed nodes cost
   * nothing. Pinning one page's wording is the opposite job and wants an exact
   * read, and chasing the extractor's edge cases to do it was buying precision
   * in the wrong place.
   */
  const page = stripComments(
    fs.readFileSync(path.join(APP, '(organisation)/onboarding/page.tsx'), 'utf8'),
  ).replace(/\s+/g, ' ');

  /*
   * The answer changed because the product did.
   *
   * This pinned a dead-end screen - "setting up an organisation is not
   * something you can complete on your own, so we do it for you", with
   * nothing to fill in. True of the backend and wrong as a flow: an
   * organisation registers and then fills in the onboarding forms. The page
   * has to put them in the wizard.
   */
  expect(page).toMatch(/Fill in each step and attach the documents/);
  expect(page).toMatch(/<OnboardingWizard/);

  /*
   * And it must not go back to explaining the implementation.
   *
   * This assertion previously held two literal backspace bytes where its word
   * boundaries belong, written by an editing script that read the escape. A
   * `not.toMatch` against a pattern containing a control character no source
   * file contains can never match, so it passed on every input - including the
   * one it exists to reject. Written without word boundaries so there is
   * nothing left to mis-escape.
   */
  expect(page).not.toMatch(/>[^<]*endpoint/i);
});

test('an unregistered organisation is not branded as one', () => {
  /*
   * The sidebar showed the name straight from the form, so "Joy News is not
   * registered yet" appeared under a masthead reading Joy News — the app
   * contradicting itself twice on one screen.
   */
  const layout = fs.readFileSync(path.join(APP, '(organisation)/layout.tsx'), 'utf8');
  expect(layout).toMatch(/onboardingComplete === false/);
  expect(layout).toMatch(/Not set up yet/);
});
