import fs from 'fs';
import path from 'path';

/**
 * Two scores, told apart.
 *
 * Every report is scored on arrival from the record alone, and an editor then
 * scores it themselves. These are different kinds of claim — one is arithmetic
 * over data the platform holds, the other is a person's judgement — and they
 * shared a panel, a heading, a border and a number. The derived figure appeared
 * as one clause inside the editor's own panel: "Arrived at 412 from the record
 * alone."
 *
 * An editor could not point at the machine's number without also pointing at
 * their own, and nobody reading over their shoulder could tell which of the two
 * the desk had actually decided. That is the whole reason for the split.
 */

const DESK = path.resolve(__dirname, '..', 'app', '(editorial)', 'editorial');

const read = (name: string) => fs.readFileSync(path.join(DESK, name), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (name: string) =>
  read(name)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('the two panels sit side by side, automatic first', () => {
  /*
   * Reading order is the argument: what the record already says, then what a
   * person adds to it. Stacked below `xl`, where two columns would give the ten
   * rating rows no room.
   */
  const bench = code('Workbench.tsx');
  expect(bench).toMatch(/min-\[1700px\]:grid-cols-\[15rem_minmax\(0,1fr\)\]/);

  const automatic = bench.indexOf('<AutomaticScorePanel');
  const editor = bench.indexOf('<NewsValuePanel');
  expect(automatic).toBeGreaterThan(-1);
  expect(automatic).toBeLessThan(editor);
});

test('the automatic panel is read-only by construction, not by discipline', () => {
  /*
   * The strongest form of the guarantee: it takes no change handler and renders
   * no control, so there is nothing to press and nothing to disable. A panel
   * that merely *looked* read-only would be one `onChange` away from letting an
   * editor edit the machine's score and believe it was still the machine's.
   */
  const panel = code('AutomaticScorePanel.tsx');
  expect(panel).not.toMatch(/onChange|onPick|onToggle|onSet/);
  expect(panel).not.toMatch(/<button/);
  expect(panel).toMatch(/Read only/);
});

test('each panel says whose claim it is', () => {
  // They both read "News value" while sitting side by side, which is the
  // original defect with an extra border drawn round it.
  expect(code('AutomaticScorePanel.tsx')).toMatch(/Automatic/);
  expect(read('NewsValuePanel.tsx')).toMatch(/Editor&rsquo;s assessment/);
});

test('the automatic panel names what it could not judge', () => {
  /*
   * Five of the ten criteria have no evidence in a record and sit at the
   * midpoint. A count alone — "5 of 10 not rated" — says how much is missing
   * and never which, so the criteria the editor is the only source for stay
   * invisible at the moment they are being asked for them.
   */
  const panel = code('AutomaticScorePanel.tsx');
  expect(panel).toMatch(/unassessed/);
  expect(panel).toMatch(/Needs a person/);
  expect(panel).toMatch(/unrated\.map/);
});

test('the editor panel shows the distance, not a third copy of the number', () => {
  /*
   * The automatic score is beside it in full. What neither panel shows on its
   * own is the gap — and an editor who lands eighty points below where the
   * report arrived has learned something about how the queue is ordering
   * itself.
   */
  const panel = code('NewsValuePanel.tsx');
  expect(panel).toMatch(/result\.score - provisionalScore/);
  expect(panel).toMatch(/against the automatic score/);
  expect(panel).not.toMatch(/Arrived at/);
});

test('neither panel reimplements the scoring model', () => {
  /*
   * The weights, thresholds and modifier points are shared logic. A second copy
   * on either screen drifts from the phone's the first time the newsroom tunes
   * a weight, and then the two disagree about what leads.
   */
  for (const file of ['AutomaticScorePanel.tsx', 'NewsValuePanel.tsx']) {
    const panel = code(file);
    expect([file, /from '@dawuro\/core'/.test(panel)]).toEqual([file, true]);
    for (const literal of ['375', '300', '225', '110', '550']) {
      expect([file, literal, panel.includes(literal)]).toEqual([file, literal, false]);
    }
  }
});

test('the two panels are told apart by what can change them', () => {
  /*
   * The automatic one is derived and read-only; the editor's is a judgement and
   * is now stored. The sentence that used to reconcile them — "the automatic
   * panel beside this one is derived and does survive" — existed only because
   * one of the two was lost on reload. Both survive now, for different reasons,
   * and the panels say which is which by their headings and their controls.
   */
  const editor = read('NewsValuePanel.tsx').replace(/\s+/g, ' ');
  expect(editor).not.toMatch(/is not saved/i);
  expect(editor).toMatch(/Editor&rsquo;s assessment/);

  const automatic = read('AutomaticScorePanel.tsx').replace(/\s+/g, ' ');
  expect(automatic).toMatch(/Read only/);
});

test('the shipped contract is the one the console was built against', () => {
  /*
   * `PUT` rather than `POST`, a merge rather than a replace, 400 on an unknown
   * key, `If-Match` for concurrency, and no effect on the publication gate. All
   * five shipped and the console depends on each of them, so they are written
   * down beside the code that relies on them — a change to any one breaks this
   * console in a way that is not obvious from the diff.
   *
   * Kept here rather than in BACKEND-REQUESTS, which is a list of what is
   * *missing*: the item moved to Done the day this landed, and a rule reading a
   * document that records requests would fail every time one is granted.
   */
  const route = fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      'app',
      'api',
      'editorial',
      '[incidentId]',
      'news-value',
      'route.ts',
    ),
    'utf8',
  );
  expect(route).toMatch(/`PUT`, and it merges/);
  expect(route).toMatch(/Unknown keys are refused with 400/);
  expect(route).toMatch(/If-Match: <version>` gives 409/);
  expect(route).toMatch(/does not touch publication/);
});
