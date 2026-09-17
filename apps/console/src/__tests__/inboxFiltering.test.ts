import fs from 'fs';
import path from 'path';

/**
 * Finding one report in the inbox, not only working down it.
 *
 * The queue had three tabs — offered, licensed, all — and nothing else. An
 * officer with twenty-two reports waiting and a question about one district
 * read every row, because there was no other way to ask. Search, two facets and
 * three groupings are what turn a queue into something a question can be put to.
 *
 * And the head of it is shaped like the verification desk's, which is what was
 * asked for: the title inside the queue column rather than a `PageHeader` band
 * above the workspace, because on a two-pane screen that band is a hundred
 * pixels spent repeating the sidebar.
 *
 * Read from source: these are React components over a live queue, and what
 * matters is that the wiring is there rather than what it renders for one
 * fixture.
 */

const SRC = path.resolve(__dirname, '..');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (rel: string) =>
  fs
    .readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const INBOX = 'app/(organisation)/inbox';
const workspace = () => code(`${INBOX}/InboxWorkspace.tsx`);
const filters = () => code(`${INBOX}/InboxFilters.tsx`);
const groups = () => code('lib/queueGroups.ts');

describe('the header, as the editor’s end does it', () => {
  test('the page renders no header band over the queue', () => {
    /*
     * The same call the desk made: an eyebrow, a title and a line about pricing
     * above a screen where the sidebar already says Inbox. The price is still
     * stated — on the button that charges it.
     */
    const page = code(`${INBOX}/page.tsx`);
    const ok = page.slice(page.indexOf('if (result.ok)'), page.indexOf('return (\n    <>'));
    expect(ok).toMatch(/<InboxWorkspace/);
    expect(ok).not.toMatch(/<PageHeader/);
  });

  test('an outage still gets one, because there is no queue to carry it', () => {
    const page = code(`${INBOX}/page.tsx`);
    expect(page).toMatch(/<PageHeader/);
    expect(page).toMatch(/<OrganisationOutage error=\{result\.error\} retryHref="\/inbox" \/>/);
  });

  test('the title and the count live in the queue column', () => {
    const src = filters();
    expect(src).toMatch(/<h1 className="text-base font-semibold[^"]*">Reports<\/h1>/);
    expect(src).toMatch(/\{total\}/);
  });

  test('the queue collapses to a strip that says how to get it back', () => {
    // Hidden with no way back is a worse bug than the width it was taking.
    const src = workspace();
    expect(src).toMatch(/onClick=\{\(\) => setQueueOpen\(true\)\}/);
    expect(filters()).toMatch(/onClick=\{onCollapse\}/);
    expect(src).toMatch(/\{visible\.length\}/);
  });

  test('the line under the title describes the list that is actually shown', () => {
    /*
     * It described the price of a download, so under any grouping the heading
     * and the list underneath it were describing different things.
     */
    const src = filters();
    expect(src).toMatch(/state\.grouping === 'recent'/);
    expect(src).toMatch(/state\.dateOrder === 'newest' \? 'newest' : 'oldest'/);
    expect(src).toMatch(/\$\{shown\} of \$\{total\} shown/);
  });
});

describe('filtering the inbox', () => {
  test('there is a search, and it looks where somebody would remember', () => {
    const src = workspace();
    // Roughly what it said, roughly where, or the reference off an email.
    expect(src).toMatch(/incident\.description,\s*formatPlace\(incident\.location\),\s*incident\.reportId,\s*categoryLabel\(incident\.category\),/);
    expect(filters()).toMatch(/type="search"/);
  });

  test('the two facets are built from what is actually waiting', () => {
    /*
     * Not from the twenty-three categories the platform knows. An officer must
     * not be offered a filter that matches nothing and left wondering whether
     * the filter is broken or the queue is empty.
     */
    const src = workspace();
    expect(src).toMatch(/const categories = useMemo\(\(\) => tally\(inTab\.map\(\(r\) => r\.category\)\), \[inTab\]\)/);
    expect(src).toMatch(/const severities = useMemo\(\(\) => tally\(inTab\.map\(\(r\) => r\.severity\)\), \[inTab\]\)/);
    expect(src).toMatch(/function tally</);
  });

  test('the status tabs survive, because they are a view and not a narrowing', () => {
    expect(filters()).toMatch(/\(\['offered', 'licensed', 'all'\] as const\)/);
  });

  test('a filtered-empty queue does not claim the queue is empty', () => {
    /*
     * "Nothing waiting" under an active search is a lie about the inbox — the
     * reports are there and the filter is hiding them, and an officer who reads
     * it stops looking.
     */
    const src = workspace();
    expect(src).toMatch(/inTab\.length > 0\s*\?\s*'No report here matches that\.'/);
    expect(src).toMatch(/'Nothing waiting\.'/);
  });

  test('the filters can be cleared once they are narrowing anything', () => {
    const src = filters();
    expect(src).toMatch(/query: '', category: 'all', severity: 'all'/);
    expect(src).toMatch(/Clear filters/);
  });
});

describe('grouping the queue', () => {
  test('all three views exist and the flat list is the default', () => {
    expect(groups()).toMatch(/export type Grouping = 'recent' \| 'date' \| 'subject'/);
    expect(workspace()).toMatch(/grouping: 'recent'/);
  });

  test('the flat view draws no heading at all', () => {
    // A single group labelled "Recent" over the whole list says nothing.
    expect(groups()).toMatch(/\[\{ key: 'all', label: null, items \}\]/);
    expect(workspace()).toMatch(/group\.label \?/);
  });

  test('grouping never re-orders the reports inside a group', () => {
    /*
     * The safety property, and the reason this helper exists rather than a sort
     * per view: the order a list arrives in is a claim about what to work first,
     * and a grouping that re-sorted inside its buckets would answer a different
     * question under the same heading.
     */
    const src = groups();
    expect(src).toMatch(/bucket\.items\.push\(item\)/);
    expect(src).not.toMatch(/items\.sort\(/);
    expect(src).toMatch(/groups\.sort\(/);
  });

  test('a report with no capture date is its own group, and always last', () => {
    const src = groups();
    expect(src).toMatch(/'undated'/);
    expect(src).toMatch(/No date given/);
    expect(src).toMatch(/if \(a\.key === 'undated'\) return 1;/);
    expect(src).toMatch(/if \(b\.key === 'undated'\) return -1;/);
  });

  test('the day heading is coarse enough to group, and the label is the shared one', () => {
    // A second table of category names drifts from the phone's the first time
    // one is renamed, and then the two disagree about what a report is.
    const src = groups();
    expect(src).toMatch(/formatCaptureDay\(iso\)/);
    expect(src).toMatch(/categoryLabel\(read\.category\(item\)\)/);
  });

  test('the date direction is offered only where it means something', () => {
    expect(filters()).toMatch(/state\.grouping === 'date' \? \(/);
  });
});

describe('what the rewrite had to keep', () => {
  test('the preview follows the list rather than sitting on a hidden report', () => {
    /*
     * Seeded with `reports[0]`, the preview could sit on a report the filters
     * had removed from the list beside it — one thing on the left, a different
     * one on the right, and no way to tell which was being acted on.
     */
    const src = workspace();
    expect(src).toMatch(/const \[selectedId, setSelectedId\] = useState<string \| null>\(null\);/);
    expect(src).toMatch(/const firstShown = groups\[0\]\?\.items\[0\] \?\? null;/);
    expect(src).not.toMatch(/useState<string \| null>\(reports\[0\]\?\.id/);
  });

  test('licensing still only ticks after the service confirms', () => {
    const src = workspace();
    const fn = src.slice(src.indexOf('const license = useCallback'), src.indexOf('const [filters'));
    expect(fn.indexOf('if (!response.ok)')).toBeLessThan(fn.indexOf('setLicensed((prev)'));
  });

  test('sending to the editor, notes and the media proxy are untouched', () => {
    const src = workspace();
    expect(src).toMatch(/\{licensed \? \(\s*<div className="mt-4">\s*<SendToEditor/);
    expect(src).toMatch(/<NotesPanel incidentId=\{incident\.id\} \/>/);
    expect(src).toMatch(/mediaHref\(/);
    // It saves, so it must not carry the banner that says otherwise.
    expect(src).not.toMatch(/<NotWired/);
  });

  test('the row falls back to the fix when the service named no place', () => {
    // Every incident on the live service comes back with `label: null`, so
    // reading the label alone left the place blank on every row.
    expect(workspace()).toMatch(/const where = formatPlace\(incident\.location\);/);
  });
});
