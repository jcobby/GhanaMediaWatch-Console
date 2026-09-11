import fs from 'fs';
import path from 'path';

/**
 * The scoring criteria, as it is actually wired into the desk.
 *
 * `packages/core` proves the model computes the right numbers. This file is
 * about the three ways a correct model still gets used wrongly on a screen:
 * scoring only what somebody happens to open, showing a number beside a failed
 * harm gate, and letting an editor believe an assessment was saved.
 *
 * Read from source. These are React components whose behaviour depends on a
 * queue of live reports, and what matters here is that the wiring is present at
 * all rather than what it renders for one fixture.
 */

const DESK = path.resolve(__dirname, '..', 'app', '(editorial)', 'editorial');

const read = (name: string) => fs.readFileSync(path.join(DESK, name), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (name: string) =>
  read(name)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('every report in the queue is scored, not only the open one', () => {
  /*
   * The brief was to score every report that comes in. Computing the assessment
   * inside the selected-report branch would score exactly one at a time, and
   * the queue — the thing an editor actually scans — would show nothing.
   */
  const bench = code('Workbench.tsx');
  expect(bench).toMatch(/for \(const incident of reports\)/);
  expect(bench).toMatch(/provisionalAssessment\(/);
  expect(bench).toMatch(/<NewsValueChip assessment=\{assessments\[incident\.id\]\}/);
});

test('the queue keeps its triage order', () => {
  /*
   * News value and triage answer different questions: what leads, and what needs
   * attention next. An unverified emergency outranks a well-scored feature for
   * review even though the feature would lead the bulletin, so the score is
   * shown on the row and does not reorder it.
   */
  const bench = code('Workbench.tsx');
  const sort = /\.sort\(\(a, b\) => ([^)]+)\)/.exec(bench)?.[1] ?? '';
  expect(sort).toContain('score');
  expect(bench).toMatch(/triageScore\(/);
  // The queue is built from triage scores, and the news value never enters it.
  const queueBlock = bench.slice(bench.indexOf('const queue'), bench.indexOf('const assessments'));
  expect(queueBlock).not.toMatch(/provisionalAssessment|newsValue/i);
});

test('a failed gate suppresses the score rather than sitting beside it', () => {
  /*
   * The single most important thing on the panel. A number next to a failing
   * harm gate invites the argument that 412 outweighs a child's identity, and
   * that argument should not be available to start.
   */
  const panel = code('NewsValuePanel.tsx');
  expect(panel).toMatch(/failed\.length > 0 \?/);
  expect(panel).toMatch(/Not eligible to be a top story/);

  // The score is in the else branch, so it cannot render while a gate fails.
  const gateBranch = panel.indexOf('failed.length > 0 ?');
  const scoreRender = panel.indexOf('{result.score}');
  expect(gateBranch).toBeGreaterThan(-1);
  expect(scoreRender).toBeGreaterThan(gateBranch);
});

test('a gate has three states, not a checkbox', () => {
  /*
   * "Nobody has checked the legal position" and "the legal position is bad"
   * call for opposite actions. A checkbox reports them identically, and the
   * default would read as a pass.
   */
  const panel = code('NewsValuePanel.tsx');
  expect(panel).toMatch(/value: 'pass'/);
  expect(panel).toMatch(/value: 'unanswered'/);
  expect(panel).toMatch(/value: 'fail'/);
});

test('the editor starts from what the record already says', () => {
  /*
   * Seeded rather than blank. Asking somebody to re-enter what Dawuro already
   * knows — that there are children in the footage and nobody has redacted it,
   * that two independent checks are recorded — invites a tired yes on the one
   * question that must never get one.
   */
  const bench = code('Workbench.tsx');
  expect(bench).toMatch(/gates: deriveGates\(\{/);
  expect(bench).toMatch(/ratings: assessment\.ratings/);
  expect(bench).toMatch(/modifiers: assessment\.modifiers/);
});

test('criteria nobody rated are shown as unrated, not as a considered 3', () => {
  /*
   * Five of the ten cannot be evidenced from data and sit at the neutral
   * midpoint. A midpoint rendered like any other rating is a guess dressed as a
   * judgement — it looks like somebody thought about it.
   */
  const panel = code('NewsValuePanel.tsx');
  expect(panel).toMatch(/unassessed\.length/);
  expect(panel).toMatch(/not rated yet/i);
  expect(panel).toMatch(/unrated/);
  // Amber, so it reads as outstanding rather than settled.
  expect(panel).toMatch(/unrated\s*\?[\s\S]{0,200}warning/);
});

test('rating a criterion clears it from the unassessed list', () => {
  // Otherwise the amber never goes away and the count at the top is a lie.
  const bench = code('NewsValuePanel.tsx');
  expect(bench).toMatch(/unassessed: state\.unassessed\.filter\(\(id\) => id !== criterion\.id\)/);
});

test('the two rules never touch the score', () => {
  /*
   * Discounting a story because it involves the owner would bury exactly the
   * stories an outlet is least willing to run about itself. The election rule
   * moves a tier and leaves the score, so it reverses the moment the response
   * arrives.
   */
  const panel = code('NewsValuePanel.tsx');
  expect(panel).toMatch(/needsSecondEditor\(/);
  expect(panel).toMatch(/applyElectionFairness\(/);
  expect(panel).toMatch(/second editor/i);
  expect(panel).toMatch(/score is (untouched|not adjusted)/i);
});

test('the region is offered as a guess, and is correctable', () => {
  /*
   * Nearest regional capital is not a boundary lookup — a point near a border
   * or in an elongated region can come back wrong, and it decides a +25
   * modifier. Presenting it as fact would make it uncorrectable in practice.
   */
  const panel = code('NewsValuePanel.tsx');
  expect(panel).toMatch(/is a guess from the coordinates/);
  expect(panel).toMatch(/Correct it/);
});

test("an editor's assessment reaches the service", () => {
  /*
   * For as long as this panel existed it carried a permanent amber box
   * admitting that ten ratings would be gone on reload and no colleague would
   * ever see them. That was honest while there was no endpoint. There is one
   * now — `GET`/`PUT /editorial/{id}/news-value` — so the apology is replaced
   * by the thing an editor actually needs to know: whether their judgement is
   * on the record.
   */
  const panel = read('NewsValuePanel.tsx').replace(/\s+/g, ' ');
  expect(panel).not.toMatch(/gone when you reload/i);
  expect(panel).not.toMatch(/no colleague can see it/i);
  expect(panel).toMatch(/Colleagues on this report see it/i);

  // Silent until something has happened: a status line about work nobody has
  // done is noise on a panel that is already ten controls deep.
  const src = code('NewsValuePanel.tsx');
  expect(src).toMatch(/state\.status === 'idle' \|\| state\.status === 'loading'\) return null/);
});

test('a save is merged, delayed, and version-checked', () => {
  /*
   * Three properties, and each of them is a specific failure avoided.
   *
   * Rating ten criteria is ten clicks in a few seconds — a request each would
   * be ten round trips and ten chances to land out of order. The endpoint
   * merges, so what goes up is only what changed. And `If-Match` is what stops
   * two editors on one report overwriting each other, which is how a harm gate
   * somebody set to fail gets quietly flipped back to pass.
   */
  const hook = code('useStoredNewsValue.ts');
  expect(hook).toMatch(/SAVE_DELAY_MS/);
  expect(hook).toMatch(/method: 'PUT'/);
  expect(hook).toMatch(/versions\.current\[queued\.id\]/);
  expect(hook).toMatch(/res\.status === 409/);

  // The version travels to the service as the header it is defined as.
  const route = code('../../api/editorial/[incidentId]/news-value/route.ts');
  expect(route).toMatch(/'If-Match': String\(version\)/);
});

test('a report nobody has assessed is not reported as an empty assessment', () => {
  /*
   * `GET` answers 404 when there is no assessment, and that is an answer rather
   * than a failure: the panel opens on what the record implies. Treating it as
   * an error would put a red state on every fresh report in the queue.
   */
  const route = code('../../api/editorial/[incidentId]/news-value/route.ts');
  expect(route).toMatch(/cause\.status === 404/);
  expect(route).toMatch(/assessment: null/);
});

test('the stored assessment outranks the derived one, field by field', () => {
  /*
   * A colleague's judgement beats a derivation. Taken wholesale it would blank
   * whatever the stored record predates — an assessment saved before the
   * modifiers existed has ratings and no modifiers — so each field falls back
   * on its own.
   */
  const bench = code('Workbench.tsx');
  expect(bench).toMatch(/ratings: storedNewsValue\?\.ratings \?\? seeded\.ratings/);
  expect(bench).toMatch(/gates: storedNewsValue\?\.gates \?\? seeded\.gates/);
  expect(bench).toMatch(/modifiers: storedNewsValue\?\.modifiers \?\? seeded\.modifiers/);
});

test('the desk does not carry the page-level warning', () => {
  // It writes. A stale banner on a working screen trains an operator to read
  // past it, and the next real one is read past too.
  expect(read('NewsValuePanel.tsx')).not.toMatch(/<NotWired/);
  expect(read('Workbench.tsx')).not.toMatch(/<NotWired/);
});

test('the endpoint is used, not just documented', () => {
  /*
   * It was written into BACKEND-REQUESTS so that this would stop being unsaved
   * rather than stay unsaved politely. It has been built, so the rule is now
   * that the console calls it.
   */
  const hook = code('useStoredNewsValue.ts');
  expect(hook).toMatch(/\/api\/editorial\/\$\{encodeURIComponent\(incidentId\)\}\/news-value/);

  const route = code('../../api/editorial/[incidentId]/news-value/route.ts');
  expect(route).toMatch(/editorial\/\$\{encodeURIComponent\(incidentId\)\}\/news-value/);
  // And it stays refused to anyone but the desk, as the service requires.
  expect(route).toMatch(/accountType === 'editor' \|\| accountType === 'platform_owner'/);
});

test('the scoring model is imported, never reimplemented on the screen', () => {
  /*
   * The weights, thresholds and modifier points are shared logic. A second copy
   * on this screen would drift from the phone's the first time the newsroom
   * tunes a weight, and the two would quietly disagree about what leads.
   */
  const panel = code('NewsValuePanel.tsx');
  expect(panel).toMatch(/from '@dawuro\/core'/);

  // No literal weights, thresholds or modifier points restated here.
  for (const literal of ['375', '300', '225', '110', '550']) {
    expect([literal, panel.includes(literal)]).toEqual([literal, false]);
  }
});
