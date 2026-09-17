import fs from 'fs';
import path from 'path';

/**
 * A screen must not behave as though a decision was accepted when nothing was
 * sent.
 *
 * Almost every action in this console changes a React state variable and
 * nothing else: the row moves, the badge flips, the panel closes. It is
 * indistinguishable from success at the moment it matters, which for "Release
 * batch" means an operator watching a payout appear to go out.
 *
 * Until each one calls the server, the screen says so. These two rules keep
 * that honest in both directions — a warning must not go missing from a screen
 * that still cannot save, and must not linger on one that now can, because a
 * stale warning teaches people to ignore the real ones.
 */

const SRC = path.resolve(__dirname, '..');
const APP = path.join(SRC, 'app');

/**
 * A page, the client components beside it, and any shared component it renders
 * its actions through — the actions live in those.
 */
function sourcesFor(route: string, extra: string[] = []): string {
  const dir = path.join(APP, route);
  return [
    ...fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')),
    ...extra.map((rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')),
  ].join('\n');
}

/** Screens whose decisions have real-world consequences. */
const CONSEQUENTIAL: { route: string; decision: string; extra?: string[] }[] = [
  {
    route: '(platform)/platform/payouts',
    decision: 'releasing money to reporters',
    extra: ['components/payouts/PayoutsWorkspace.tsx'],
  },
  { route: '(platform)/platform/approvals', decision: 'granting access to citizens’ footage' },
  { route: '(platform)/platform/routing', decision: 'routing a report' },
  { route: '(organisation)/inbox', decision: 'licensing a report, which charges and pays' },
  { route: '(organisation)/published', decision: 'publishing somebody’s footage' },
  { route: '(organisation)/team', decision: 'admitting somebody to an organisation' },
  { route: '(organisation)/checkout', decision: 'paying an invoice' },
  /*
   * `(admin)/admin/institutions` used to be here, and it is deliberately gone.
   *
   * It offered "Run screening" and "Approve" as simulated controls — a tick
   * after a timer, nothing sent — on the page that *reads* like where approvals
   * happen. Wiring them would have meant two ways to grant access to citizens'
   * footage, and the weaker one would have been the more prominent. The controls
   * are removed instead: the page reports where each application stands and
   * links to `/platform/approvals`, which reviews step by step, gates approval
   * on screening, and sends every decision to the service.
   *
   * So it is no longer a screen that takes a consequential decision, and a rule
   * demanding it save or warn would be asking it to warn about something it does
   * not offer. `(platform)/platform/approvals` above is the screen under review.
   */
  { route: '(admin)/admin/takedowns', decision: 'deciding a request under Act 843' },
  {
    route: '(admin)/admin/payouts',
    decision: 'releasing money',
    extra: ['components/payouts/PayoutsWorkspace.tsx'],
  },
  { route: '(admin)/admin/administrators', decision: 'granting administrator access' },
  { route: '(editorial)/editorial', decision: 'ruling on what may be called verified' },
];

const writesToServer = (src: string) => /fetch\('\/api\/|fetch\(`\/api\//.test(src);

test('the routes under review all exist', () => {
  // A renamed folder would silently empty this whole file.
  for (const { route, extra = [] } of CONSEQUENTIAL) {
    expect([route, fs.existsSync(path.join(APP, route))]).toEqual([route, true]);
    for (const rel of extra) expect([rel, fs.existsSync(path.join(SRC, rel))]).toEqual([rel, true]);
  }
});

test('every consequential screen either saves or admits it cannot', () => {
  /*
   * The rule. A screen that neither calls the server nor warns is one that
   * lies: the operator presses, the interface agrees, and the platform never
   * hears about it.
   */
  const silent: string[] = [];

  for (const { route, decision, extra } of CONSEQUENTIAL) {
    const src = sourcesFor(route, extra);
    if (writesToServer(src)) continue;
    if (src.includes('<NotWired')) continue;
    silent.push(`${route} — ${decision}`);
  }

  expect(silent).toEqual([]);
});

test('a screen that saves does not still carry the warning', () => {
  /*
   * The other direction, and the one that rots quietly. A warning left on a
   * working screen trains an operator to read past it, and the next real one
   * is read past too.
   */
  const stale: string[] = [];

  for (const { route, extra } of CONSEQUENTIAL) {
    const src = sourcesFor(route, extra);
    if (writesToServer(src) && src.includes('<NotWired')) stale.push(route);
  }

  expect(stale).toEqual([]);
});

test('the routing desk is the one that already saves', () => {
  /*
   * Pins the current state, so this file is measuring something. If every
   * screen were unwired, the rule above would pass by warning everywhere and
   * prove nothing about the wired case.
   */
  expect(writesToServer(sourcesFor('(platform)/platform/routing'))).toBe(true);
  expect(sourcesFor('(platform)/platform/routing')).not.toContain('<NotWired');
});

test('every consequential screen now saves, and none of them only warns', () => {
  /*
   * This used to assert the opposite — that at least one screen was still
   * unwired — as a guard against the main rule going vacuous. That guard has
   * served its purpose: every screen on the list writes to the server now, so
   * the complement is empty and the old assertion could only fail.
   *
   * Replaced rather than deleted, because the vacuity risk was real and is now
   * covered from the other side. Naming the screens that are silent makes a
   * regression legible — "expected [] but got ['(admin)/admin/takedowns']" says
   * what broke — and the main rule above still bites the moment a new screen
   * joins the list without either saving or admitting it cannot.
   */
  const silent = CONSEQUENTIAL.filter(
    ({ route, extra }) => !writesToServer(sourcesFor(route, extra)),
  ).map(({ route }) => route);

  expect(silent).toEqual([]);
});

test('the warning names the decision rather than gesturing at it', () => {
  /*
   * "Some things here don't work" is not something anybody can act on. Each
   * notice has to say which decision is not being saved.
   */
  for (const { route, extra } of CONSEQUENTIAL) {
    const src = sourcesFor(route, extra);
    if (!src.includes('<NotWired')) continue;
    const what = /<NotWired what="([^"]+)"/.exec(src)?.[1] ?? '';
    expect([route, what.length > 12]).toEqual([route, true]);
  }
});

test('the warning tells the reader the effect, not just the cause', () => {
  const notice = fs.readFileSync(path.resolve(__dirname, '../components/ui/NotWired.tsx'), 'utf8');
  // What happens to their work, and what not to conclude from the screen.
  expect(notice).toMatch(/gone when you reload/i);
  expect(notice).toMatch(/do not treat[^.]*as done/i);
});

// ─── signing out ───────────────────────────────────────────────────────────

test('signing out leaves nothing of the session behind', () => {
  /*
   * `router.replace('/login')` then `router.refresh()`. Two problems.
   *
   * `refresh()` re-fetches whichever route is *current*, and the replace has
   * not necessarily committed when it runs — so it could re-request the page
   * being left, with the cookie already gone, mid-transition.
   *
   * The one that matters more: Next's client router caches rendered segments,
   * so a soft navigation leaves the outgoing operator's inbox, payouts and
   * routing queue in memory, reachable with the back button after sign-out.
   * These organisations share office workstations. A full page load discards
   * all of it.
   */
  /*
   * Comments stripped first.
   *
   * The doc comment above `signOut` names the two calls it exists to forbid,
   * so a whole-file search matches the explanation and fails on correct code —
   * the same trap that has caught several rules in this suite.
   */
  const code = fs
    .readFileSync(path.resolve(__dirname, '../components/shell/UserMenu.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

  expect(code).toMatch(/window\.location\.assign\('\/login'\)/);
  expect(code).not.toMatch(/router\.refresh\(\)/);
  expect(code).not.toMatch(/router\.replace\(/);
});

test('a sign-out that failed does not look like one that worked', () => {
  /*
   * The costly failure: somebody walks away from a shared machine believing
   * they are signed out while a platform-owner session is still live.
   */
  const menu = fs.readFileSync(path.resolve(__dirname, '../components/shell/UserMenu.tsx'), 'utf8');
  const signOut = menu.slice(menu.indexOf('const signOut'), menu.indexOf('const initials'));
  expect(signOut).toContain('if (!res.ok)');
  // The navigation must be after the check, or the screen clears regardless.
  expect(signOut.indexOf('if (!res.ok)')).toBeLessThan(signOut.indexOf('window.location.assign'));
  expect(menu).toMatch(/You are still signed in/);
});
