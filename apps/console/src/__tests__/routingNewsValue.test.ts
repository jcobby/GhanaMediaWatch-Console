import fs from 'fs';
import path from 'path';
import { EMPTY_CORROBORATION, NEWS_CRITERIA } from '@dawuro/core';
import { assessRoutingRow, byNewsValue } from '../lib/routingNewsValue';
import type { RoutingRow } from '../lib/normaliseRouting';

/**
 * Scoring reports as they arrive for routing.
 *
 * The desk decides who receives a report, and it did that in arrival order —
 * the order the uploads happened to finish in. An operator faced with twenty
 * rows had to open each one to find out which a newsroom needed in the next ten
 * minutes.
 *
 * The model itself is proved in `@dawuro/core`. This file is about the ways a
 * correct model still goes wrong when fed a queue row: scoring a default as
 * though it were a fact, and claiming an editorial judgement the desk has not
 * got the inputs for.
 */

const NOW = '2026-09-09T12:00:00.000Z';

const row = (over: Partial<RoutingRow> = {}): RoutingRow => ({
  id: 'r1',
  incidentId: 'inc_1',
  summary: 'Something happened',
  category: 'other',
  destination: 'marketplace',
  requestedBusinessIds: [],
  suggestedBusinessIds: [],
  reporterHandle: 'Anonymous',
  capturedAtIso: '2026-09-09T11:00:00.000Z',
  submittedAtIso: '2026-09-09T11:05:00.000Z',
  status: 'awaiting_routing',
  locationLabel: null,
  location: { latitude: 5.6, longitude: -0.19 },
  // Required by `RoutingItem`, and nothing here reads it — the score is
  // computed from `mediaKind`, which says what the file is, not where it is.
  thumbnailUrl: '',
  ...over,
});

test('the normaliser default is never scored as a real destination', () => {
  /*
   * `RoutingItem` requires `destination`, so the normaliser fills it with
   * `marketplace` — and the routing queue sends no destination at all, so that
   * default is on every row. Fed to the model it hands *every* report the
   * exclusivity point for a choice nobody made.
   *
   * The stated value is read instead, and its absence is `null`.
   */
  const defaulted = assessRoutingRow(row({ destination: 'marketplace' }), NOW);
  const stated = assessRoutingRow(
    row({ destination: 'marketplace', destinationStated: 'marketplace' }),
    NOW,
  );

  // Filmed an hour before `NOW`, so freshness is 4 either way. The exclusivity
  // point is the whole difference, and it is the point that must be earned.
  expect(defaulted.ratings.timeliness).toBe(4);
  expect(stated.ratings.timeliness).toBe(5);
});

test('a report with no stated assurance does not collect the provenance bonus', () => {
  /*
   * Silence is not Class A. `C` — "origin not technically verified" — is the
   * honest reading, and it is the one that does not reward an unread report.
   */
  const silent = assessRoutingRow(row({ mediaKind: 'video' }), NOW);
  const trusted = assessRoutingRow(row({ mediaKind: 'video', assurance: 'A' }), NOW);

  expect(silent.ratings.visual_strength).toBeLessThan(trusted.ratings.visual_strength);
});

test('an app capture is not treated as a rumour', () => {
  /*
   * Corroboration is editorial work and has not started at this desk, so a
   * rumour penalty keyed on "nothing independent recorded" fired on every
   * single row — measured against the live queue, nine of nine, identically.
   * A modifier that applies to everything ranks nothing.
   *
   * It is keyed on provenance instead: Class C is the forwarded material the
   * criterion describes; a Class A capture is a primary source of what it shows.
   */
  expect(assessRoutingRow(row({ assurance: 'A' }), NOW).modifiers.rumour_decay).toBe(false);
  expect(assessRoutingRow(row({ assurance: 'C' }), NOW).modifiers.rumour_decay).toBe(true);
});

test('unredacted footage of a child fails the harm gate before it is routed', () => {
  /*
   * The one gate this desk must not get wrong. Nothing has been redacted at
   * routing time — redaction is recorded on an editorial case and no case
   * exists yet — so footage the reporter flagged fails here, which is the right
   * answer for a desk about to send it to several newsrooms at once.
   */
  const flagged = assessRoutingRow(row({ handling: ['redact_before_publication'] }), NOW);
  expect(flagged.gates.harm).toBe('fail');
});

test('the platform does not answer the legal or public interest gates', () => {
  // No routing operator is being asked to give a legal opinion here.
  const any = assessRoutingRow(row({ handling: [] }), NOW);
  expect(any.gates.legal).toBe('unanswered');
  expect(any.gates.public_interest).toBe('unanswered');
});

test('half the model is reported as unassessed, not quietly averaged', () => {
  /*
   * Five criteria need somebody who has read the report. Held at the midpoint
   * and named, because this is the desk that sends footage to newsrooms — an
   * inflated impression formed here travels with it.
   */
  const assessment = assessRoutingRow(row(), NOW);
  expect(assessment.unassessed).toHaveLength(5);
  expect(assessment.unassessed.length).toBeLessThan(NEWS_CRITERIA.length);
  expect(assessment.unassessed.sort()).toEqual([
    'continuity',
    'human_interest',
    'novelty',
    'prominence',
    'proximity',
  ]);
});

test('the queue is ordered by the score, biggest first', () => {
  const ordered = byNewsValue(
    [
      row({ id: 'small', category: 'other', severity: 'observation' }),
      row({
        id: 'big',
        category: 'flood',
        severity: 'emergency',
        mediaKind: 'video',
        assurance: 'A',
      }),
    ],
    NOW,
  );
  expect(ordered.map((o) => o.row.id)).toEqual(['big', 'small']);
});

test('a report nobody could read sinks, whatever its defaults score', () => {
  /*
   * Its number comes entirely from fallbacks — `other`, `concern`, no media, no
   * fix — so ranking it against reports somebody can actually see would be
   * ranking on nothing. It still appears; it just goes last.
   */
  const ordered = byNewsValue(
    [
      row({ id: 'unread', contentUnavailable: true }),
      row({ id: 'read', category: 'other', severity: 'observation' }),
    ],
    NOW,
  );
  expect(ordered.map((o) => o.row.id)).toEqual(['read', 'unread']);
  expect(ordered[1]!.assessment.unreadable).toBe(true);
});

test('every row in one render is measured against the same instant', () => {
  /*
   * `nowIso` is threaded through rather than read per row. Reading a clock
   * inside the loop would let two reports filmed a second apart fall into
   * different freshness buckets depending on the order they were mapped in —
   * and the queue order would then depend on how fast the map ran.
   */
  const rows = [row({ id: 'a' }), row({ id: 'b' })];
  expect(byNewsValue(rows, NOW)).toEqual(byNewsValue(rows, NOW));

  /*
   * Comments stripped first. The note explaining this rule names `Date.now()`
   * as the thing not to do, so matching the raw file failed on its own
   * documentation — the same trap in reverse as a test that passes by matching
   * the comment beside the code.
   */
  const source = fs
    .readFileSync(path.resolve(__dirname, '..', 'lib', 'routingNewsValue.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  expect(source).not.toMatch(/Date\.now\(\)|new Date\(\)/);
});

test('corroboration is empty at this desk, and said to be', () => {
  // Editorial work has not started. Claiming otherwise would pass the
  // verification gate on a report nobody has checked.
  const assessment = assessRoutingRow(row(), NOW);
  expect(assessment.gates.verification).toBe('unanswered');
  expect(EMPTY_CORROBORATION.completed).toHaveLength(0);
});

test('no editorial tier is claimed on the routing desk', () => {
  /*
   * "Lead story", "Top five", "Inside page" are placement decisions and need
   * all ten criteria. With five pinned at the midpoint every score is pulled
   * toward 300 and the tier barely moves — on the live queue it read "Inside
   * page" for nine of ten reports, which told an operator nothing and claimed a
   * judgement nobody had made.
   */
  const view = fs.readFileSync(
    path.resolve(__dirname, '..', 'app', '(platform)', 'platform', 'routing', 'NewsValue.tsx'),
    'utf8',
  );
  expect(view).not.toMatch(/NEWS_TIER_META/);
  expect(view).not.toMatch(/tier\.label|tier\.placement/);
  expect(view).toMatch(/Not a placement decision/);
});

// ─── explaining the order ──────────────────────────────────────────────────

const deskSource = (name: string) =>
  fs.readFileSync(
    path.resolve(__dirname, '..', 'app', '(platform)', 'platform', 'routing', name),
    'utf8',
  );

test('the queue says what it is ranked on', () => {
  /*
   * A ranked list that does not say what it is ranked on asks an operator to
   * trust an ordering they cannot check. The editorial desk states its own —
   * "ordered by what needs attention, not by what arrived first" — and this
   * desk had no equivalent while quietly reordering itself.
   */
  const desk = deskSource('RoutingDesk.tsx');
  expect(desk).toMatch(/Ranked by news value, biggest story first/);
  expect(desk).toMatch(/Open one to see the working/);
});

test('each row says why it is where it is', () => {
  // The number ranks without explaining, and nobody opens twenty rows to find
  // out.
  expect(deskSource('RoutingDesk.tsx')).toMatch(/<NewsValueReason assessment=/);
  expect(deskSource('NewsValue.tsx')).toMatch(/leadingReasons\(/);
});

test('a report with no strength says so rather than showing its biggest number', () => {
  /*
   * "Nothing stands out yet" is the honest answer for a report in the queue on
   * weighting rather than on merit. Printing nothing would look like reasons
   * that failed to load; printing "impact 2/5" would dress a weakness up as a
   * justification.
   */
  expect(deskSource('NewsValue.tsx')).toMatch(/Nothing stands out yet/);
});

test('the full working is available on the report an operator opened', () => {
  /*
   * Every criterion, its rating, its weight and what it contributed — so an
   * operator who disagrees that one report outranks another can see which
   * criterion did it and say so. Collapsed by default: it is the answer to a
   * question most rows never raise.
   */
  const view = deskSource('NewsValue.tsx');
  expect(view).toMatch(/criterionContributions\(/);
  expect(view).toMatch(/How this was scored/);
  expect(view).toMatch(/<details/);
  // The weights are the argument, not decoration.
  expect(view).toMatch(/×\{row\.weight\}/);
});

test('the score is told how big the file is', () => {
  /*
   * Otherwise it rates footage it has never checked exists: a 4 KB probe
   * recorded as `kind: video, assurance: A` scored 5 out of 5 for visual
   * strength while the frame beside it said the file was unplayable.
   */
  const adapter = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'routingNewsValue.ts'),
    'utf8',
  );
  expect(adapter).toMatch(/mediaByteSize: row\.mediaByteSize \?\? null/);
});
