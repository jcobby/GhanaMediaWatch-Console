import { categoryLabel, formatCaptureDay, type IncidentCategory } from '@dawuro/core';

/**
 * Cutting a list of reports into sections, without re-ordering it.
 *
 * The safety property is the same one the verification desk holds: **this only
 * ever partitions.** The order a list arrives in is a claim about what to work
 * first, and a grouping that quietly re-sorted inside its buckets would answer
 * a different question under the same heading — somebody working top-down would
 * start on the wrong report with nothing on screen saying so.
 *
 * So items are pushed in the order they are received, and only the *groups* are
 * sorted.
 *
 * The desk keeps its own copy of this shape in `Workbench.tsx` because it
 * partitions by triage score, which an inbox has no equivalent of — routing
 * delivered these, nobody ranked them. The labels both sides use come from
 * `@dawuro/core`, so the two can never disagree about what a category is called
 * or which day a capture belongs to.
 */

export type Grouping = 'recent' | 'date' | 'subject';

/** Which end of the calendar the date view starts at. */
export type DateOrder = 'newest' | 'oldest';

export interface Group<T> {
  key: string;
  /** Null on the flat view, so no heading is drawn at all. */
  label: string | null;
  items: T[];
}

export const GROUPINGS: { value: Grouping; label: string; title: string }[] = [
  { value: 'recent', label: 'Recent', title: 'One list, most recently filmed first' },
  { value: 'date', label: 'Date', title: 'Grouped by the day it was filmed' },
  { value: 'subject', label: 'Subject', title: 'Grouped by category' },
];

export function groupReports<T>(
  items: T[],
  grouping: Grouping,
  order: DateOrder,
  read: {
    capturedAtIso: (item: T) => string | null;
    category: (item: T) => IncidentCategory;
  },
): Group<T>[] {
  // A single group labelled "Recent" over the whole list is furniture that says
  // nothing, so the flat view stays exactly the list it was.
  if (grouping === 'recent') return [{ key: 'all', label: null, items }];

  const buckets = new Map<string, Group<T>>();

  for (const item of items) {
    const iso = read.capturedAtIso(item);
    const { key, label } =
      grouping === 'date'
        ? {
            /*
             * A withheld capture date is its own group, never folded into today.
             * Bucketing it under "Today" would assert a date nobody gave.
             */
            key: iso?.slice(0, 10) ?? 'undated',
            label: formatCaptureDay(iso) ?? 'No date given',
          }
        : { key: read.category(item), label: categoryLabel(read.category(item)) };

    const bucket = buckets.get(key);
    if (bucket) bucket.items.push(item);
    else buckets.set(key, { key, label, items: [item] });
  }

  const groups = [...buckets.values()];

  /*
   * Days run by date, in the direction the operator chose — the key is
   * `YYYY-MM-DD`, so it sorts as a string with no parsing. Undated is last
   * either way: it belongs to no day, and putting it at the head of "newest"
   * would claim it is the most recent thing waiting.
   */
  if (grouping === 'date') {
    return groups.sort((a, b) => {
      if (a.key === 'undated') return 1;
      if (b.key === 'undated') return -1;
      return order === 'newest' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key);
    });
  }

  /*
   * Subjects keep the incoming ranking: categories have no natural order, so
   * the group whose first report came first is the one that leads. `items`
   * arrives in order, so no second sort is needed.
   */
  return groups;
}
