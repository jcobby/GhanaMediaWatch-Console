import fs from 'fs';
import path from 'path';

/**
 * A screen that acts must say that it acted.
 *
 * `wiring.test.ts` covers the first half of this failure — a decision that
 * changes React state and never reaches the server. This is the other half,
 * and it is the one an operator actually reported: the decision *was* sent, it
 * *did* work, and the console said nothing at all. The page refreshed, the row
 * they had acted on left the list it was in, and they were looking at a screen
 * that was one item shorter with no word about what had happened.
 *
 * Two specific reports, both from the same silence:
 *
 *   "when i approved i didn't get any notification that the approving worked"
 *   "after the licensing was clicked and went through i didn't see any
 *    notification, and i was left at the offered tab with nothing to show there"
 *
 * That is worse here than in most consoles, because these actions are
 * irreversible and expensive. Approval grants an organisation access to footage
 * of the public. Licensing charges money and pays a reporter. Releasing a batch
 * sends money. An operator who cannot tell whether it went through does it
 * again — and the second one goes through too.
 *
 * So every action that sends one of those decisions has to confirm it, in words
 * that name what happened rather than a bare tick.
 */

const SRC = path.resolve(__dirname, '..');

const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/**
 * The files that take a consequential decision, and what each has to confirm.
 *
 * Listed by file rather than by route: these are the components that hold the
 * handler, and a rule that globbed a route folder would be satisfied by a toast
 * in a sibling that shows a list.
 */
const CONFIRMS: { file: string; what: string }[] = [
  { file: 'components/ApplicationReview.tsx', what: 'approving an organisation, step by step' },
  {
    file: 'app/(platform)/platform/approvals/ApprovalsWorkspace.tsx',
    what: 'accepting or declining an application',
  },
  { file: 'app/(organisation)/inbox/InboxWorkspace.tsx', what: 'licensing a report, which charges' },
  { file: 'components/payouts/PayoutsWorkspace.tsx', what: 'releasing money to reporters' },
  { file: 'app/(admin)/admin/takedowns/TakedownDecision.tsx', what: 'a decision under Act 843' },
  { file: 'app/(admin)/admin/administrators/AdminManager.tsx', what: 'granting console access' },
  { file: 'app/(organisation)/team/TeamWorkspace.tsx', what: 'admitting somebody to a team' },
  {
    file: 'app/(organisation)/published/PublishedWorkspace.tsx',
    what: 'withdrawing footage from the feed',
  },
  {
    file: 'app/(editorial)/editorial/requests/RequestsList.tsx',
    what: 'publishing an organisation’s report',
  },
  { file: 'app/(organisation)/assignments/AssignmentsBoard.tsx', what: 'moving a dispatch along' },
  { file: 'app/(organisation)/surveys/SurveyActions.tsx', what: 'closing a survey' },
];

test('the files under review all exist', () => {
  // A rename would empty this file and it would keep passing.
  for (const { file } of CONFIRMS) {
    expect([file, fs.existsSync(path.join(SRC, file))]).toEqual([file, true]);
  }
});

test('every consequential action confirms that it worked', () => {
  const silent = CONFIRMS.filter(({ file }) => {
    const src = read(file);
    return !src.includes('useToast()') || !src.includes('toast.success(');
  }).map(({ file, what }) => `${file} — ${what}`);

  expect(silent).toEqual([]);
});

test('a refusal is still told, in the service’s own words', () => {
  /*
   * The other outcome, which was never the broken one — every screen on this
   * list already showed its failure inline, next to the button that caused it,
   * and that placement is better than a corner toast for something the operator
   * has to act on. The rule is that it is said *somewhere*, not that it is said
   * twice: the three screens where the row vanishes on success also raise the
   * failure as a toast, because there the inline notice can scroll out of a
   * list that has just rearranged itself.
   *
   * Written this way deliberately. A rule demanding `toast.error` everywhere
   * would have been satisfied by duplicating each message into a corner nobody
   * needed to look at, and it would have read as thoroughness.
   */
  const quiet = CONFIRMS.filter(
    ({ file }) => !/setFailure\(|setPurchaseError\(|toast\.error\(/.test(read(file)),
  ).map(({ file, what }) => `${file} — ${what}`);

  expect(quiet).toEqual([]);
});

test('the provider is mounted once, at the root', () => {
  /*
   * `useToast` degrades to no-ops without a provider rather than throwing, which
   * is right for a component that only says "licensed" — and it is also how
   * every message on this list could go missing in silence. So the mount is
   * asserted rather than assumed.
   */
  const layout = read('app/layout.tsx');
  expect(layout).toContain('<ToastProvider>');
  expect(layout).toMatch(/import \{ ToastProvider \} from '@\/components\/ui(\/Toast)?'/);

  const others = fs
    .readdirSync(path.join(SRC, 'app'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join('app', e.name, 'layout.tsx'))
    .filter((rel) => fs.existsSync(path.join(SRC, rel)));
  for (const rel of others) {
    expect([rel, read(rel).includes('<ToastProvider>')]).toEqual([rel, false]);
  }
});

test('licensing leaves the operator with the report they paid for', () => {
  /*
   * The second half of the report. Licensing drops a report out of the Offered
   * tab it was bought from, because it is no longer offered — so an operator
   * who had not explicitly clicked a row was left on an empty tab with the
   * preview reset to "Select a report to review it", moments after being
   * charged for something.
   *
   * Two things follow a confirmed licence now: the report is selected
   * explicitly, so the download and "send to editor" stay where the operator is
   * already looking, and the queue follows it to Licensed when Offered has
   * nothing left. Only when it has nothing left — an officer working through a
   * batch keeps their place.
   */
  const src = read('app/(organisation)/inbox/InboxWorkspace.tsx');
  const fn = src.slice(src.indexOf('const license = useCallback'));

  expect(fn).toContain('setSelectedId(incidentId)');
  expect(fn).toMatch(/const stillOffered = reports\.some\(/);
  expect(fn).toMatch(/if \(!stillOffered\) \{/);
  expect(fn).toMatch(/status: 'licensed'/);

  // And all of it after the service confirmed, never before.
  expect(fn.indexOf('if (!response.ok)')).toBeLessThan(fn.indexOf('setSelectedId(incidentId)'));
});

test('the confirmation names the thing, rather than saying “Done”', () => {
  /*
   * "Saved" is the same message for every button on every page, which makes it
   * worth roughly as much as no message. Each of these is checked for a title
   * built from what was actually acted on — the organisation, the report, the
   * amount, the person.
   */
  const named: [string, boolean][] = [
    ['ApplicationReview approved', read('components/ApplicationReview.tsx').includes('${who} approved')],
    [
      'approvals workspace names the organisation',
      read('app/(platform)/platform/approvals/ApprovalsWorkspace.tsx').includes('${name} approved'),
    ],
    [
      'inbox names the category',
      read('app/(organisation)/inbox/InboxWorkspace.tsx').includes(
        'Licensed — ${categoryLabel(report.category)}',
      ),
    ],
    [
      'payouts name the amount',
      read('components/payouts/PayoutsWorkspace.tsx').includes(
        '${formatCedis(run.totalPesewas)} released',
      ),
    ],
  ];

  for (const [label, ok] of named) expect([label, ok]).toEqual([label, true]);
});
