import fs from 'fs';
import path from 'path';

/**
 * Acting on a report, rather than appearing to.
 *
 * Every action button in this console was local React state. "Confirm and send"
 * called `setHandled`, the row left the list, and the platform was told
 * nothing — so the desk looked like it worked, and a reload brought the report
 * back. An operator could believe they had routed something that never left
 * the browser, which is worse than a button that plainly fails.
 *
 * Verified against the live API: the handler's own guards answer 403/401/400,
 * and with a real token the server's refusal is passed through with its status.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const handler = () => read('app/api/routing/[incidentId]/route.ts');
const desk = () => read('app/(platform)/platform/routing/RoutingDesk.tsx');

test('the desk actually calls the server', () => {
  expect(desk()).toMatch(/fetch\(`\/api\/routing\//);
});

test('a report is only marked handled once the server accepted it', () => {
  /*
   * The precise shape of the original bug: `setHandled` ran unconditionally.
   * It must now sit after the response was checked, or the row disappears on a
   * failure exactly as it did before.
   */
  const src = desk();
  const act = src.slice(src.indexOf('const act = async'), src.indexOf('return ('));

  /*
   * Both present, *then* ordered. `indexOf` answers -1 for a string that is
   * not there, and -1 is less than every real position — so comparing
   * positions alone passes most loudly at the moment the guard is deleted,
   * which is precisely the regression this is meant to catch. Found by a probe
   * that removed the guard and watched this test go green.
   */
  expect(act).toContain('if (!res.ok)');
  expect(act).toContain('setHandled(');
  expect(act.indexOf('if (!res.ok)')).toBeLessThan(act.indexOf('setHandled('));
});

test('a failure is shown, with the server’s own words', () => {
  /*
   * Normally this console never renders an upstream message. Here it is the
   * point: both endpoints document no request body, so the validation error is
   * the only specification available to whoever fixes this.
   */
  expect(desk()).toMatch(/setFailure\(/);
  expect(desk()).toMatch(/\{failure\}/);
  expect(handler()).toMatch(/upstreamStatus/);
});

test('the desk says how a report actually reaches the public', () => {
  /*
   * Corrected, and the correction matters more than the rule.
   *
   * This asserted the desk said releasing was "not possible yet". It is
   * possible, and always was: recording a report as corroborating on the
   * verification desk sets `vettingState: published` and puts it in
   * `/incidents` for every phone. Proven end to end with a real editor account.
   *
   * The old belief came from reading a refusal as a limit —
   * `Corroboration gate failed: insufficient_corroboration` is the server
   * asking for something, not refusing — and the checklist that would have
   * satisfied it sent nothing. Telling an editor to stop trying was the costly
   * direction to be wrong in.
   */
  /*
   * Comments stripped. The panel's note explains what it replaced and quotes
   * the old sentence, so a whole-file search finds the very words the rule
   * forbids — the fourth time that trap has caught a rule in this suite.
   */
  const panel = read('app/(editorial)/editorial/ReleasePanel.tsx').replace(
    /\/\*[\s\S]*?\*\//g,
    ' ',
  );
  expect(panel).toMatch(/publishes it/);
  expect(panel).not.toMatch(/Not possible yet/);

  // The owner's desk points at the same mechanism rather than a button.
  expect(desk()).not.toMatch(/onPublish/);
  expect(desk()).toMatch(/verified|corroborating/i);
});

test('ticking a corroboration check reaches the platform', () => {
  /*
   * The gate on publishing, and the whole reason an editor could not release
   * anything. `toggleCheck` was `setLive` alone: every box ticked, the bar at
   * 100%, and the decision still refused for insufficient corroboration —
   * because none of it had left the browser.
   */
  const bench = read('app/(editorial)/editorial/Workbench.tsx');
  const start = bench.indexOf('const toggleCheck');
  expect(start).toBeGreaterThan(-1);
  // Bounded by the next top-level declaration: `return (` occurs earlier in
  // this file, so it sliced an empty string and the rule passed on nothing.
  const toggle = bench.slice(start, bench.indexOf('\n  const ', start + 10));
  expect(toggle).toMatch(/action: 'corroborate'/);
  expect(toggle).toContain('setLive(');

  /*
   * This asserted the request went *before* the box was ticked. That ordering
   * has been deliberately inverted: each tick is a round trip, and waiting for
   * it made seven checks feel broken on every report in the queue.
   *
   * The guarantee that replaces the ordering is the undo — pinned by "ticking
   * a check is instant, and is undone if it did not save". A tick the platform
   * never received must not stay on screen looking like recorded work.
   */
  // The weights are the shared ones, not a second set invented here.
  expect(toggle).toMatch(/CORROBORATION_CHECKS\.find/);
});

test('the corroboration body is the shape the server asked for', () => {
  // Read from its own validation error: {source, weight, passed, independent}.
  const route = read('app/api/editorial/[incidentId]/route.ts');
  expect(route).toMatch(/action: z\.literal\('corroborate'\)/);
  for (const field of ['source', 'weight', 'passed', 'independent']) {
    expect(route).toContain(`${field}:`);
  }
  expect(route).toMatch(/\/corroboration`/);
});

test('nothing sends a state the server does not accept', () => {
  /*
   * `{state: 'published'}` was the guess, and it is not one of the eight the
   * endpoint enumerates. The union is copied from the server's own validation
   * error rather than inferred from the type in @dawuro/core.
   */
  const route = read('app/api/editorial/[incidentId]/route.ts');
  /*
   * Scoped to the enum. `published` is now a legitimate word in this file —
   * the transition *response* carries `published`, `publishedAt` and
   * `vettingState`, which is how the desk finally knows a decision put the
   * report in front of everybody. What must never come back is `published` as
   * a state to *send*.
   */
  const sent = route.slice(
    route.indexOf('const decideSchema'),
    route.indexOf('const corroborateSchema'),
  );
  expect(sent).not.toMatch(/'published'/);
  for (const state of [
    'received_unreviewed',
    'integrity_passed',
    'integrity_flagged',
    'corroboration_in_progress',
    'verified_high_confidence',
    'verified_in_part',
    'disputed',
    'rejected',
  ]) {
    expect(route).toContain(`'${state}'`);
  }
});

test("the editor's reason is sent under the name the server reads", () => {
  /*
   * **`note`, not `reason`.** The published body is `{state, note?, section?}`
   * and this sent `{state, reason}` — an unknown key, accepted and dropped in
   * silence. So every verification decision an editor recorded reached the
   * platform with no reason attached, while the panel refused to submit without
   * one and told them it was kept permanently. The decision survived; the only
   * part of it a person wrote did not.
   *
   * Found by reading the shipped schema rather than by anything failing, which
   * is the whole difficulty with a server that ignores what it does not know.
   */
  const route = read('app/api/editorial/[incidentId]/route.ts');
  const send = route.slice(route.indexOf('/transition`'));
  expect(send).toMatch(/note: input\.reason/);
  expect(send).not.toMatch(/reason: input\.reason/);
});

test('an editor chooses the desk a published report runs on', () => {
  /*
   * Nothing reaches Latest or Ghana or Organisation except by an editor putting it
   * there. `section` is on the transition body and defaults to `ghana`, so
   * without this every report the desk ever published landed on one desk by
   * omission rather than by choice.
   */
  const route = read('app/api/editorial/[incidentId]/route.ts');
  expect(route).toMatch(/section: z[\s\S]{0,120}'ghana'/);
  expect(route).toMatch(/\.\.\.\(input\.section \? \{ section: input\.section \} : \{\}\)/);

  // Offered only where the decision actually publishes: a control that changes
  // nothing is worse than an absent option on a screen this consequential.
  const bench = read('app/(editorial)/editorial/Workbench.tsx');
  expect(bench).toMatch(/publishes && target === 'verified_high_confidence'/);
  expect(bench).toMatch(/NEWS_SECTIONS\.map/);
});

test('the desk is told when a decision published the report', () => {
  /*
   * Publishing was a silent side effect: the response said nothing about it, so
   * an editor recorded a verification and was never told the footage had just
   * gone in front of every user of the app. The transition result now carries
   * `published`, `publishedAt` and `section`.
   */
  const bench = read('app/(editorial)/editorial/Workbench.tsx');
  expect(bench).toMatch(/answer\.result\?\.published/);
  expect(bench).toMatch(/Published to the public feed/);
  // Scoped to the report it happened to, so it cannot linger over the next one.
  expect(bench).toMatch(/published\?\.id === selected\.id/);
});

test('a verification decision is sent before the row moves', () => {
  /*
   * `setStates` alone: the badge changed, the history grew a row, and the
   * platform was told nothing. An editor could work a queue of nineteen and
   * change none of it, with a reload putting it all back.
   */
  const bench = read('app/(editorial)/editorial/Workbench.tsx');
  const decide = bench.slice(bench.indexOf('onDecide={(to, reason, section'));
  expect(decide).toContain('fetch(');
  expect(decide).toContain('setStates(');
  expect(decide.indexOf('fetch(')).toBeLessThan(decide.indexOf('setStates('));
});

test('the desk explains the release rather than gesturing at it', () => {
  /*
   * Replaces a rule that outlived its subject. It asserted the release button
   * appeared only when nothing matched, and once the button was removed it kept
   * passing by matching the *comment* that explains why it went — my own note,
   * quoting the label. A test that can be satisfied by prose about the feature
   * is not testing the feature.
   *
   * What matters now is that the operator is told where the decision lives
   * instead of being handed a control the server refuses.
   */
  const src = desk();
  const block = src.slice(src.indexOf('No organisation wanted this report'));
  const rendered = block.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Names how it happens, rather than pointing at a desk or a button.
  expect(rendered).toMatch(/verified|corroborating/i);
  expect(rendered).not.toMatch(/<Button/);
});

test('only a platform owner or editor may act', () => {
  // Middleware gates the page; the endpoint is reachable directly.
  const src = handler();
  expect(src).toMatch(/accountType !== 'platform_owner' && session\.accountType !== 'editor'/);
  expect(src).toMatch(/status: 403/);
});

test('the reporter is told a public release earns nothing', () => {
  /*
   * A public release pays no commission — there is nothing to license. Kept on
   * the desk even though the platform cannot perform the release yet, because
   * it is what the operator needs to understand about the outcome they are
   * asking somebody else to arrange.
   */
  expect(desk()).toMatch(/earns nothing|visibility is the reward/i);
});

test('a session with no upstream credential is refused before calling out', () => {
  /*
   * Measured inside the handler body, not against the file. The import of
   * `apiRequest` sits at the top of every version of this file, so comparing
   * positions across the whole source compares the guard to an import and
   * passes or fails for reasons unrelated to the ordering that matters.
   */
  const body = handler().slice(handler().indexOf('export async function POST'));
  expect(body).toContain('!session.accessToken');
  expect(body.indexOf('!session.accessToken')).toBeLessThan(body.indexOf('await apiRequest'));
});

test('money-adjacent actions carry a stable idempotency key', () => {
  /*
   * Routing decides who may license a report, and licensing pays a reporter.
   * A double-submitted form must route once, so the key is derived from the
   * report and its recipients rather than generated per attempt.
   */
  const src = handler();
  expect(src).toMatch(/idempotencyKey: `route:\$\{incidentId\}/);
  /*
   * `publish` is gone from this handler. It posted `{state: 'published'}` to an
   * endpoint that refuses platform owners outright and accepts only the eight
   * verification states — so it could not have worked for anyone.
   *
   * Comments stripped first: the note above this line, and the one at the top
   * of the handler explaining the removal, both contain the word. A whole-file
   * search matches the explanation and fails on correct code — the third time
   * that trap has caught a rule in this suite.
   */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  expect(code).not.toMatch(/publish/);
});

test('a queue row is never blank', () => {
  /*
   * Four identical white boxes with no id, description or time — no way to tell
   * one report from another, or to say which one you had open.
   */
  const src = desk();
  expect(src).toMatch(/No description filed/);
  expect(src).toMatch(/No reference/);
});

test('the queue tile picks an element that can render what it was given', () => {
  /*
   * Every tile went through one `<img>`, including the video reports — and
   * `media.posterUrl` is null on every clip the service stores, so what the
   * `<img>` received was an MP4. It cannot decode one, and it fails silently:
   * no error, no broken-image icon, just an empty box that reads as missing
   * footage while the detail pane shows the same file.
   *
   * This asserted `item.thumbnailUrl ? (` — the exact JSX — which pinned the
   * shape of the bug rather than the rule, and went red when the tile was
   * fixed. What matters is that video reaches a player and nothing reaches an
   * `<img>` unguarded.
   */
  const src = desk();

  const tile = src.slice(src.indexOf('function QueueTile'));
  expect(tile).toMatch(/<video/);
  expect(tile).toMatch(/mediaKind === 'video'/);

  // No `<img>` outside a guard: an unconditional one renders an empty src.
  for (const [, before] of src.matchAll(/([\s\S]{200})<img\s/g)) {
    expect(before).toMatch(/thumbnailUrl|posterUrl|\?/);
  }
});

test('the desk fetches the report, not just the routing decision', () => {
  /*
   * `/platform/routing` returns `{incidentId, matches}` and nothing else — no
   * description, media, category or timestamp. Without a second request per
   * report there is simply no content to render, and the desk falls back to
   * defaults that look like data.
   */
  const api = fs.readFileSync(path.resolve(__dirname, '../lib/consoleApi.ts'), 'utf8');
  expect(api).toMatch(/async function incidentDetail/);
  expect(api).toMatch(/`\/editorial\/\$\{encoded\}`/);
  const routing = api.slice(api.indexOf('routing: async ('));
  expect(routing).toMatch(/await incidentDetail\(id\)/);
});

test('one unreadable report does not empty the queue', () => {
  /*
   * Eight rows lost because the ninth 404s would be a worse failure than the
   * one being fixed. The operator can still see it and still route it.
   */
  const api = fs.readFileSync(path.resolve(__dirname, '../lib/consoleApi.ts'), 'utf8');
  const start = api.indexOf('async function incidentDetail');
  expect(start).toBeGreaterThan(-1);
  const detail = api.slice(start, api.indexOf('export const platform', start));
  // A catch that rethrows, or no catch at all, loses the whole queue.
  expect(detail).toMatch(/catch (\{|\(cause\))/);
  expect(detail).not.toMatch(/throw /);
  expect(detail).toMatch(/return null;/);
});

test('a row can always be told apart from the row beside it', () => {
  /*
   * "No reference" on all eight rows at once — a queue of identical entries
   * with no way to say which one you had open. The incident id is uglier than
   * a DW- code and it is real.
   */
  expect(desk()).toMatch(/item\.reportId \?\? item\.incidentId/);
});

test('an empty search box is not reported as a failed search', () => {
  // It read: No organisation matches "". That is the state the panel opens in.
  const src = desk();
  expect(src).toMatch(/No organisations to send to yet/);
});

test('the desk does not print a default category as though it were filed', () => {
  const src = desk();
  expect(src).toMatch(/item\.contentUnavailable \? 'Report not loaded' : item\.category/);
  expect(src).toMatch(/Details could not be read/);
});

test('the editorial queue items are the reports', () => {
  /*
   * Read from the live endpoint with an editor token: each item is a full
   * incident — id, reportId, category, description, media, verification — with
   * no `incident` wrapper and no `incidentId` field anywhere on it.
   *
   * Two readings were wrong in opposite directions. `cases.map(c => c.incident)`
   * looked for a wrapper that does not exist; the first correction read
   * `item.incidentId`, also absent, which produced an empty list *and* a
   * request per row. Nineteen reports sat in the payload the whole time while
   * the page said "The queue is clear." beside a badge reading 19.
   */
  const api = fs.readFileSync(path.resolve(__dirname, '../lib/consoleApi.ts'), 'utf8');
  const fn = api.slice(
    api.indexOf('export async function editorialQueueWithReports'),
    api.indexOf('export const editorial = {'),
  );
  // The queue call is the only fetch: the items need no second request.
  expect(fn).toMatch(/await editorial\.queue/);
  // Neither wrong reading may come back.
  expect(fn).not.toMatch(/incidentDetail/);
  expect(fn).not.toMatch(/\.incident/);

  const page = fs.readFileSync(
    path.resolve(__dirname, '../app/(editorial)/editorial/page.tsx'),
    'utf8',
  );
  expect(page).toMatch(/editorialQueueWithReports</);
  expect(page).not.toMatch(/cases\.map\(\(c\) => c\.incident\)/);
});

test('a report filed for the public feed is recognised as such', () => {
  /*
   * `destination` is the reporter's own instruction, and `public` means "no
   * commission — visibility is the reward". The desk was asking an operator to
   * choose organisations for reports that had explicitly asked not to go to
   * any, and offering "Send to nobody" as the alternative — two ways to bury
   * something whose author had already said where it should go.
   */
  const src = desk();
  expect(src).toMatch(/destination === 'public'/);
  expect(src).toMatch(/filed this for the public feed/);
  // And it names who can actually release it.
  expect(src).toMatch(/verification desk/);
});

test('a defaulted destination is never shown as the reporter’s choice', () => {
  /*
   * `destination ?? 'marketplace'` put "offered to subscribing organisations" on
   * reports whose record had not been read. `public` and `marketplace` are
   * opposite instructions and an operator routes on exactly this, so the guess
   * is worse than an absence.
   */
  const src = desk();
  const badges = src.slice(src.indexOf('<Badge tone="accent">{item.category}</Badge>') - 700);
  expect(badges).toMatch(/item\.contentUnavailable \?/);
  // The public-feed notice must not fire on a defaulted value either.
  expect(src).toMatch(/!item\.contentUnavailable &&/);
});

test('the verification desk can watch what it is ruling on', () => {
  /*
   * `MediaFrame` was given only `posterUrl`, and the service stores that as
   * null for every video — so the one screen whose entire job is looking at the
   * footage rendered a black rectangle. An editor was asked to decide whether
   * something could be called verified without being able to watch it.
   *
   * The player is still there; what it is pointed at has changed. A signed
   * media URL lasts about five minutes and this page is rendered once and then
   * worked for as long as the queue takes, so the URL in the markup now carries
   * no signature at all — `/api/media/{id}` mints one when the bytes are asked
   * for. See `mediaHref`.
   */
  const bench = read('app/(editorial)/editorial/Workbench.tsx');
  expect(bench).toMatch(/videoUrl: mediaHref\(selected\.id\)/);
  // The screen-sized JPEG copy: a still an `<img>` can always draw.
  expect(bench).toMatch(/posterUrl=\{mediaHref\(selected\.id, 'view'\)\}/);

  /*
   * And the signed URL is never put in front of the browser. It expires, and it
   * publishes the API origin, which is deliberately server-only.
   */
  expect(bench).not.toMatch(/posterUrl=\{selected\.media\.posterUrl\}/);
  expect(bench).not.toMatch(/videoUrl: selected\.media\.url/);

  /*
   * The proxy still needs the URL absolute on the server, for its own fetch:
   * `media.url` is relative and `DAWURO_API_URL` is not a NEXT_PUBLIC_
   * variable.
   */
  const api = fs.readFileSync(path.resolve(__dirname, '../lib/consoleApi.ts'), 'utf8');
  const fn = api.slice(api.indexOf('export async function editorialQueueWithReports'));
  expect(fn).toMatch(/absoluteMedia\(media\.url\)/);
});

test('a photo is its own poster', () => {
  /*
   * `media.posterUrl` is null for everything the service stores — for a video
   * because it generates no still frame, and for a *photo* because the photo is
   * already at `media.url`. Passing the null through gave the verification desk
   * a broken image on every photo report, which is the same fault the routing
   * desk had and the same fix.
   */
  const api = fs.readFileSync(path.resolve(__dirname, '../lib/consoleApi.ts'), 'utf8');
  const fn = api.slice(api.indexOf('export async function editorialQueueWithReports'));
  expect(fn).toMatch(/media\.posterUrl \?\? \(kind === 'photo' \? media\.url : null\)/);
});

test('recording a check tells the desk where the report has moved to', () => {
  /*
   * The first corroboration takes a report from `integrity_passed` to
   * `corroboration_in_progress`, and the endpoint's own answer —
   * `{incidentId, status, strength}` — does not say so. The desk went on
   * offering the transitions from the state before the tick, so pressing
   * "Corroborating" asked the platform to move from `corroboration_in_progress`
   * to itself and was refused: an editor doing the right thing, told they
   * could not.
   */
  const route = read('app/api/editorial/[incidentId]/route.ts');
  const branch = route.slice(route.indexOf("if (input.action === 'corroborate')"));
  expect(branch).toMatch(/incident\?\.verification/);
  expect(branch).toMatch(/verification \}\)/);

  const bench = read('app/(editorial)/editorial/Workbench.tsx');
  expect(bench).toMatch(/if \(answer\.verification\)/);
  /*
   * Read as two facts rather than one formatted line. Pinning the exact
   * whitespace made the rule fail the moment prettier rewrapped the call, which
   * says nothing about whether the desk follows the platform.
   */
  const apply = bench.slice(bench.indexOf('if (answer.verification)'), bench.length);
  expect(apply.slice(0, 300)).toMatch(/setStates\(/);
  expect(apply.slice(0, 300)).toMatch(/answer\.verification as VerificationState/);
});

test('a failed state read does not report a failed check', () => {
  /*
   * The check was recorded. Reporting an error because the follow-up read
   * failed would tell an editor to do again something the platform has already
   * accepted.
   */
  const route = read('app/api/editorial/[incidentId]/route.ts');
  const branch = route.slice(
    route.indexOf('let verification: string | null = null;'),
    route.indexOf('return NextResponse.json({ ok: true, result, verification });'),
  );
  expect(branch).toMatch(/catch \{/);
  expect(branch).not.toMatch(/return NextResponse/);
});

test('a frame that cannot show footage says which of the three reasons it is', () => {
  /*
   * Three different failures shared one black rectangle, and one sentence —
   * "the file is no longer on the server" — which is right for only one of them.
   *
   * Measured against the live service: the phone's own uploads are 3.5 MB of
   * valid MP4 (header `ftypqt`), while the integration probes sharing the same
   * queue hold 2 048, 4 096 or 8 192 bytes of random data with no container
   * header at all, and one photo record stores 0 bytes. A reviewer opening one
   * of those saw a player at 0:00 on black and could not tell whether to wait,
   * reload, or conclude the platform was broken.
   *
   * `media.byteSize` was on every record and unread. It separates the three
   * before anything tries to decode, which is the only point at which the
   * difference can still be explained.
   */
  const frame = fs.readFileSync(path.resolve(__dirname, '../components/MediaFrame.tsx'), 'utf8');
  expect(frame).toMatch(/onError=\{\(\) => \{\s*setFailed\(true\);/);

  const rendered = frame.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Nothing uploaded, filler, and a genuine decode failure.
  expect(rendered).toMatch(/the stored file is empty/i);
  expect(rendered).toMatch(/not playable footage/i);
  expect(rendered).toMatch(/report is intact/);

  // The size decides it, and the player is never handed a file this small.
  expect(rendered).toMatch(/byteSize < MIN_PLAUSIBLE_MEDIA_BYTES/);
  expect(rendered).toMatch(/playable && !failed && !tooSmall/);

  /*
   * One floor, shared with the score.
   *
   * A second copy here would drift, and the first sign of the drift would be
   * this frame saying "unplayable" beside a news value that rated the same file
   * 5 out of 5 for visual strength — which is exactly what happened before the
   * score was told the size at all.
   */
  expect(rendered).toMatch(/from '@dawuro\/core'/);
});

test('ticking a check is instant, and is undone if it did not save', () => {
  /*
   * Each tick is a request, and against a cold instance that is a second or
   * two — so waiting for the round trip before showing the box ticked made
   * working through seven checks feel broken, on every report in the queue.
   *
   * The box moves first and the request follows. What makes that honest rather
   * than a lie is the undo: a tick the platform never received must not sit on
   * screen looking like recorded work.
   */
  const bench = read('app/(editorial)/editorial/Workbench.tsx');
  const start = bench.indexOf('const toggleCheck');
  const toggle = bench.slice(start, bench.indexOf('\n  const ', start + 10));

  // Applied before the request.
  expect(toggle.indexOf('setLive(withCheck(!done))')).toBeLessThan(toggle.indexOf('fetch('));
  // And put back on either kind of failure.
  expect([...toggle.matchAll(/setLive\(withCheck\(done\)\)/g)]).toHaveLength(2);
});

test('there is no button that asserts every check at once', () => {
  /*
   * Each check is a claim that specific work was done, and together they are
   * what allow a report to be called verified and shown to the public. One
   * control asserting all seven would make the gate decorative — the exact
   * failure `@dawuro/core`'s editorial module exists to prevent. Speed comes
   * from removing the waiting, not the deciding.
   */
  const bench = read('app/(editorial)/editorial/Workbench.tsx').replace(/\/\*[\s\S]*?\*\//g, ' ');
  expect(bench).not.toMatch(/tickAll|checkAll|selectAll|markAllCorroborated/i);
});

test('the editor is told what is still missing, not left to guess', () => {
  /*
   * The bar showed a percentage and no target, so the only way to find the
   * threshold was to tick boxes until the decision stopped being refused. Both
   * requirements live in @dawuro/core and can simply be stated.
   */
  const bench = read('app/(editorial)/editorial/Workbench.tsx');
  expect(bench).toMatch(/Still needed for full verification/);
  expect(bench).toMatch(/independent of the reporter/);
  expect(bench).toMatch(/Enough to record as verified/);
});

test('an exclusive report is shown as staying exclusive', () => {
  /*
   * Reversed, and the reversal is the point.
   *
   * A reporter choosing `directed` is told "only the ones you choose receive
   * it. Exclusive", and `SubmissionDestination` records it as "Sent to named
   * organisations only. Never appears publicly." The service used to publish those
   * anyway — a decision about whether something was *true* silently overrode
   * the reporter's decision about who may *see* it, for somebody who had filmed
   * on the promise of a restricted audience. This panel carried a red warning
   * about it.
   *
   * `POST /editorial/{id}/transition` now states the rule itself: "Sets
   * vettingState to published only when destination is public or both;
   * directed/marketplace stays exclusive." The warning is gone, and it had to
   * go: a red banner on a screen that no longer has the problem is how an
   * editor learns to read past the real ones.
   */
  const panel = read('app/(editorial)/editorial/ReleasePanel.tsx');
  expect(panel).toMatch(/destination === 'directed'/);

  const rendered = panel.replace(/\/\*[\s\S]*?\*\//g, ' ');
  expect(rendered).toMatch(/will not publish it/i);
  expect(rendered).not.toMatch(/against the reporter/i);
  // Marketplace is exclusive too, and was never covered by the old warning.
  expect(panel).toMatch(/destination === 'marketplace'/);

  // And the desk actually passes the destination in, or neither branch fires.
  expect(read('app/(editorial)/editorial/Workbench.tsx')).toMatch(/<ReleasePanel/);
  expect(read('app/(editorial)/editorial/Workbench.tsx')).toMatch(/\.destination\}/);
});
