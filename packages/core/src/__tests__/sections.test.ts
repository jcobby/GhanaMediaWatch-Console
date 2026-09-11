import {
  INCIDENT_CATEGORIES,
  NEWS_SECTIONS,
  NEWS_SECTION_LABEL,
  type NewsSection,
} from '../types/api';
import { SAMPLE_INCIDENTS } from '../data/fixtures';

/**
 * News desks, and the line between a desk and a category.
 *
 * These two fields look interchangeable and are not. `category` is what the
 * reporter filed and what routing, commission and the editorial queue all key
 * off; `section` is where an editor published it. Every pressure is toward
 * merging them — they are both "what kind of thing is this" — and merging them
 * costs one of the two: the newsroom inherits a 23-value taxonomy it has no use
 * for, or an institution subscribed to `flood` starts receiving everything
 * filed under a "Ghana" heading.
 *
 * The mobile app declares the same union in `src/types/sections.ts`. The two
 * repos are hand-synced, so the values and their order are pinned here: a desk
 * added on one side and not the other produces a tab that is present in one
 * client and missing in the other, which reads as data loss rather than as
 * drift.
 */

test('the section list is exhaustive and in newsroom order', () => {
  // Nearest first. Both clients render this order, so it is contract, not
  // presentation — a reader who learns the tab order on the phone should find
  // the same one anywhere else.
  expect(NEWS_SECTIONS).toEqual(['ghana', 'africa', 'world', 'business', 'politics', 'sport']);

  // No duplicates: a repeated value renders a duplicate tab that filters
  // identically, and nothing else complains.
  expect(new Set(NEWS_SECTIONS).size).toBe(NEWS_SECTIONS.length);
});

test('every section has a label', () => {
  // A missing label renders `undefined` in the desk picker rather than failing.
  const missing = NEWS_SECTIONS.filter((s) => !NEWS_SECTION_LABEL[s]);
  expect(missing).toEqual([]);

  // And no label for a section that does not exist — a stale key here is a
  // desk someone removed and half-cleaned up.
  expect(Object.keys(NEWS_SECTION_LABEL).sort()).toEqual([...NEWS_SECTIONS].sort());
});

test('sections and categories stay separate sets', () => {
  /*
   * The guard against the merge. If someone starts folding one into the other
   * the first symptom is a value appearing in both lists, long before any
   * behaviour changes.
   */
  const overlap = (NEWS_SECTIONS as string[]).filter((s) =>
    (INCIDENT_CATEGORIES as readonly string[]).includes(s),
  );
  expect(overlap).toEqual([]);

  // They are also different sizes for a reason: 6 desks a reader navigates,
  // 23 categories that decide where a report is routed and what it pays.
  expect(NEWS_SECTIONS.length).toBeLessThan(INCIDENT_CATEGORIES.length);
});

test('every seeded incident carries a valid desk', () => {
  // `section` is non-null on the type, but fixtures are built by hand and a
  // report with no desk does not appear in the mobile feed at all — a silent
  // disappearance, not an error.
  const valid = new Set<string>(NEWS_SECTIONS);
  const bad = SAMPLE_INCIDENTS.filter((i) => !valid.has(i.section)).map((i) => i.id);
  expect(bad).toEqual([]);
});

test('a report keeps its category independent of its desk', () => {
  /*
   * The property the whole distinction exists for, stated as an example: an
   * incident on the Ghana desk is still a `flood`, and routing still sees the
   * flood. Anyone tempted to derive one field from the other has to delete
   * this test to do it.
   */
  const ghana = SAMPLE_INCIDENTS.filter((i) => i.section === 'ghana');
  expect(ghana.length).toBeGreaterThan(0);

  const categories = new Set(ghana.map((i) => i.category));
  expect(categories.size).toBeGreaterThan(1);
});

test('the union has exactly the members the clients compile against', () => {
  // Written out rather than derived, so widening `NewsSection` in the type
  // fails here instead of silently at a client that has not shipped the value.
  const declared: NewsSection[] = ['ghana', 'africa', 'world', 'business', 'politics', 'sport'];
  expect([...NEWS_SECTIONS].sort()).toEqual([...declared].sort());
});
