import fs from 'fs';
import path from 'path';

/**
 * Working a queue in sweeps, not only one row at a time.
 *
 * The triage list answers one question — what next — and answers it well. It
 * answers nothing else. A desk also works a morning's intake, or everything on
 * flooding, and a flat list of nineteen rows made both of those a hunt with no
 * way to see that six of them were the same story.
 *
 * And the rows themselves said too little to choose from. Severity, assurance,
 * a reference, two lines of description, a verification badge and a relative
 * age. Not what kind of file it was, not what morning it was filmed, not where
 * — so deciding what to open next meant opening things to find out.
 *
 * Read from source: these are React components over a live queue, and what
 * matters is that the wiring is there rather than what it renders for one
 * fixture. The arithmetic itself is proved in `packages/core`.
 */

const DESK = path.resolve(__dirname, '..', 'app', '(editorial)', 'editorial');

const read = (name: string) => fs.readFileSync(path.join(DESK, name), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (name: string) =>
  read(name)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('grouping the queue', () => {
  test('all three views exist and urgency is the default', () => {
    /*
     * Urgency answers the first question an editor has, so it stays the one
     * they get without asking. The other two are cuts of the same list.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/type Grouping = 'urgency' \| 'date' \| 'subject'/);
    expect(bench).toMatch(/useState<Grouping>\('urgency'\)/);
  });

  test('the ungrouped view draws no heading at all', () => {
    /*
     * A single group labelled "Urgency" over the whole list is furniture that
     * says nothing. The flat list has to stay exactly the list it was.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/\[\{ key: 'all', label: null, items: queue \}\]/);
    expect(bench).toMatch(/group\.label \?/);
  });

  test('grouping never re-ranks the reports inside a group', () => {
    /*
     * The whole safety property. The queue's order is a claim about what needs
     * attention next; a grouping that sorted by date would answer a different
     * question under the same list, and an editor working top-down would start
     * on the newest thing rather than the most urgent with nothing saying so.
     *
     * `groupQueue` therefore only ever partitions — it pushes entries in the
     * order it receives them and sorts groups, never items.
     */
    const bench = code('Workbench.tsx');
    const fn = bench.slice(
      bench.indexOf('function groupQueue'),
      bench.indexOf('function GroupPicker'),
    );
    expect(fn).toMatch(/bucket\.items\.push\(entry\)/);
    /*
     * Two sorts now, and both are over the *buckets*: one ranks subjects by
     * their most urgent member, the other runs the days in the direction the
     * editor chose. Neither touches `items`, which is the property that matters
     * — the order inside a group is still the queue's own.
     */
    expect(fn).not.toMatch(/items\.sort\(/);
    expect(fn).toMatch(/groups\.sort\(/);
    expect(fn).toMatch(/items\[0\]\?\.score/);
  });

  test('a report with no capture date is its own group, never folded into today', () => {
    /*
     * A withheld date is the reporter's decision. Bucketing it under "Today"
     * would assert a date nobody gave, on the screen that decides whether the
     * report can be called verified.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/'undated'/);
    expect(bench).toMatch(/No date given/);
  });

  test('the day heading is coarse enough to actually group', () => {
    /*
     * `formatExactCapture` carries a time, so twelve reports filmed on one
     * afternoon would produce twelve headings and no grouping.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/formatCaptureDay\(entry\.incident\.capturedAtIso\)/);

    const format = fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'packages',
        'core',
        'src',
        'lib',
        'format.ts',
      ),
      'utf8',
    );
    const fn = format.slice(format.indexOf('export function formatCaptureDay'));
    expect(fn.slice(0, 500)).not.toMatch(/h:mm/);
    expect(fn.slice(0, 500)).toMatch(/'Today'/);
    expect(fn.slice(0, 500)).toMatch(/'Yesterday'/);
  });

  test('subject grouping uses the shared category label, not a local map', () => {
    // A second table of category names drifts from the phone's the first time
    // one is renamed, and then the two disagree about what a report is.
    expect(code('Workbench.tsx')).toMatch(/categoryLabel\(entry\.incident\.category\)/);
  });
});

describe('what a queue row says', () => {
  test('date, place and kind are all on the row', () => {
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/formatExactCapture\(\s*incident\.capturedAtIso/);
    expect(bench).toMatch(/formatPlace\(incident\.location\)/);
    expect(bench).toMatch(/<MediaKindMark kind=\{incident\.media\.kind\}/);
  });

  test('the rating stays on the row too', () => {
    // It was already there and must survive the rewrite: an editor scanning the
    // queue is choosing partly on what the report would be worth.
    expect(code('Workbench.tsx')).toMatch(
      /<NewsValueChip assessment=\{assessments\[incident\.id\]\}/,
    );
  });

  test('a withheld date or place renders nothing, never a placeholder', () => {
    /*
     * "Unknown" advertises that there was something to hide, which is the one
     * thing these screens must not do — the same rule the capture stamp and the
     * feed row's place line follow.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/\{when \? <span/);
    expect(bench).toMatch(/\{where \? \(/);
    expect(bench).not.toMatch(/Unknown location|Location unknown|No location/i);
  });

  test('every media kind has a mark, including audio', () => {
    /*
     * Audio is a first-class report — describing something from safety carries
     * none of the risk of filming it — and a desk that only distinguishes photo
     * from video files it as a broken picture.
     */
    const bench = code('Workbench.tsx');
    const fn = bench.slice(bench.indexOf('function MediaKindMark'));
    expect(fn.slice(0, 700)).toMatch(/kind === 'video'/);
    expect(fn.slice(0, 700)).toMatch(/kind === 'audio'/);
    expect(fn.slice(0, 700)).toMatch(/Mic/);
  });
});

describe('the place a report was filmed', () => {
  test('the desk falls back to the fix when the service named no place', () => {
    /*
     * Every incident on the live service comes back `"label": null` with the
     * coordinates right beside it, so reading the label alone printed nothing
     * about the location of footage whose whole claim is that it was taken
     * somewhere specific.
     */
    expect(code('Workbench.tsx')).toMatch(/where=\{formatPlace\(selected\.location\)\}/);
  });

  test('a suppressed location still comes back as nothing', () => {
    // It arrives with no coordinates either, so absence stays absence and the
    // withholding is never advertised.
    const format = fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'packages',
        'core',
        'src',
        'lib',
        'format.ts',
      ),
      'utf8',
    );
    const fn = format.slice(format.indexOf('export function formatPlace'));
    expect(fn.slice(0, 900)).toMatch(/if \(!location\) return null;/);
    expect(fn.slice(0, 900)).toMatch(/typeof latitude !== 'number'/);
  });
});

describe('which way the days run', () => {
  test('the date view offers newest or oldest, and starts on newest', () => {
    /*
     * Ranking date groups by their most urgent member — the rule the subject
     * view uses — put **4 September at the top of a queue opened on the 10th**.
     * Triage counts waiting time, so the oldest day is by definition the most
     * urgent one, which is arithmetically right and the opposite of what "group
     * by date" is for. An editor picking Date wants a day, and it is usually
     * today.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/type DateOrder = 'newest' \| 'oldest'/);
    expect(bench).toMatch(/useState<DateOrder>\('newest'\)/);
    expect(bench).toMatch(/order === 'newest' \? b\.key\.localeCompare\(a\.key\)/);
  });

  test('the control appears only where it means something', () => {
    // A category has no natural direction; "newest subjects" would be a control
    // that changes nothing on a screen where every control is consequential.
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/grouping === 'date' \? \(\s*<DateOrderPicker/);
  });

  test('a report with no capture date is last whichever way it runs', () => {
    /*
     * It belongs to no day. Putting it at the head of "newest" would assert it
     * is the most recent thing on the desk, about a date the reporter withheld.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/if \(a\.key === 'undated'\) return 1;/);
    expect(bench).toMatch(/if \(b\.key === 'undated'\) return -1;/);
  });
});

describe('the case pane fits the space it is given', () => {
  test('the pane can shrink below its content', () => {
    /*
     * A flex item's automatic minimum size is its *min-content* width, so
     * `flex-1` alone will not let a column shrink below what its content
     * demands. While the inner column was capped at `max-w-3xl` that cap was
     * also the cap on its min-content contribution and nothing showed; raising
     * the cap let the pane push wider than its share of the row.
     *
     * `overflow-y-auto` computes `overflow-x` to `auto`, so the result was a
     * horizontal scrollbar and a rating row with its fifth button cut off —
     * on the panel an editor scores every report with.
     */
    expect(code('Workbench.tsx')).toMatch(/className="min-h-0 min-w-0 flex-1 overflow-y-auto"/);
  });

  test('the two-column split is tied to the queue, not to a guessed viewport', () => {
    /*
     * At `2xl` the split needed a 1536px *CSS* viewport. A desk running at 150%
     * scaling on a 1920 screen has 1280 — so the layout never engaged for the
     * person it was built for, and they got back the single long column it
     * exists to replace.
     *
     * Closing the queue frees the width the split needs, and that is something
     * the editor controls rather than a number we hope about.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/useState\(true\)/);
    expect(bench).toMatch(
      /queueOpen \? '2xl:flex-row 2xl:items-start' : 'xl:flex-row xl:items-start'/,
    );
  });

  test('the queue collapses to a strip that says how to get it back', () => {
    /*
     * Hidden with no way back is a worse bug than the one being fixed. The
     * strip keeps the count visible, so an editor who closed it still knows
     * how much is waiting.
     */
    const bench = code('Workbench.tsx');
    expect(bench).toMatch(/onClick=\{\(\) => setQueueOpen\(true\)\}/);
    expect(bench).toMatch(/onClick=\{\(\) => setQueueOpen\(false\)\}/);
    expect(bench).toMatch(/\{queue\.length\}<\/span>/);
  });
});

describe('nothing on the desk scrolls sideways', () => {
  /*
   * Twice now. Both times the same shape of mistake: a box that could not
   * shrink below its contents, dragging its container wider than the space it
   * had. The symptom is a horizontal scrollbar under the case pane and a panel
   * with its right-hand column cut off — on the screens an editor scores and
   * decides with.
   *
   * The two causes, written down because neither is obvious from reading the
   * markup:
   *
   *   1. **A flex item's automatic minimum size is its min-content width.**
   *      `flex-1` does not imply shrinkable; `min-w-0` does.
   *   2. **A grid track sized `auto` takes its minimum from its items.** A
   *      `grid` with no column template gets exactly that, so one stubborn item
   *      widens the whole track. Tailwind's `grid-cols-*` is
   *      `repeat(N, minmax(0, 1fr))`, and the `0` is what makes it safe.
   */

  const files = [
    'Workbench.tsx',
    'AutomaticScorePanel.tsx',
    'NewsValuePanel.tsx',
    'ReleasePanel.tsx',
  ];

  test('every grid declares a column template', () => {
    const offenders: string[] = [];

    for (const file of files) {
      for (const match of code(file).matchAll(/className=\{?"([^"]*grid[^"]*)"/g)) {
        const classes = match[1] ?? '';
        // `grid-cols-…` at the base, not only behind a breakpoint: the base is
        // what applies on the narrow screens where the overflow shows.
        if (!/(^|\s)grid-cols-/.test(classes)) offenders.push(`${file} — ${classes}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  test('the scrolling pane can shrink below its content', () => {
    expect(code('Workbench.tsx')).toMatch(/className="min-h-0 min-w-0 flex-1 overflow-y-auto"/);
  });

  test('the wide score template spells out a zero minimum', () => {
    // `1fr` alone would reintroduce the same automatic minimum on the flexible
    // track, which is the bug wearing a different breakpoint.
    expect(code('Workbench.tsx')).toMatch(/grid-cols-\[15rem_minmax\(0,1fr\)\]/);
  });
});
