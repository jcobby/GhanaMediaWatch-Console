'use client';

import { ArrowDownUp, Filter, PanelLeftClose, Search, X } from 'lucide-react';
import { categoryHue, categoryLabel, severityMeta } from '@dawuro/core';
import type { IncidentCategory, Severity } from '@dawuro/core';
import { GROUPINGS, type DateOrder, type Grouping } from '@/lib/queueGroups';
import { cn } from '@/lib/cn';

export type Status = 'offered' | 'licensed' | 'all';

export interface InboxFilterState {
  status: Status;
  query: string;
  category: IncidentCategory | 'all';
  severity: Severity | 'all';
  grouping: Grouping;
  dateOrder: DateOrder;
}

/**
 * The head of the inbox queue — the title, and everything that narrows it.
 *
 * Shaped like the verification desk's: the page's title lives here rather than
 * in a `PageHeader` band above the workspace. That band spent a hundred pixels
 * repeating what the sidebar already said, on a two-pane screen where height is
 * the scarce thing — the same reason the desk dropped its own.
 *
 * Three tabs were the whole of the filtering before this, so an officer with
 * twenty-two reports looking for the flooding in Kaneshie had to read every row.
 * Search and the two facets are what turn a queue into something you can answer
 * a question with; the facets are folded away by default because most days the
 * tabs are enough.
 */
export function InboxFilters({
  state,
  onChange,
  counts,
  categories,
  severities,
  shown,
  total,
  filtersOpen,
  onFiltersOpen,
  onCollapse,
}: {
  state: InboxFilterState;
  onChange: (next: InboxFilterState) => void;
  counts: Record<Status, number>;
  /** Only the categories actually present, with how many of each. */
  categories: { value: IncidentCategory; count: number }[];
  severities: { value: Severity; count: number }[];
  shown: number;
  total: number;
  filtersOpen: boolean;
  onFiltersOpen: (open: boolean) => void;
  onCollapse: () => void;
}) {
  const set = <K extends keyof InboxFilterState>(key: K, value: InboxFilterState[K]) =>
    onChange({ ...state, [key]: value });

  /** Anything beyond the status tabs, which are not a narrowing but a view. */
  const narrowed =
    state.query.trim() !== '' || state.category !== 'all' || state.severity !== 'all';

  return (
    <div className="shrink-0 space-y-2.5 border-b border-hairline/[0.07] px-3.5 pb-3 pt-4">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold tracking-[-0.01em] text-text-primary">Reports</h1>
        <span className="tabular rounded-pill bg-accent-wash px-2 text-2xs font-semibold text-accent">
          {total}
        </span>
        <button
          type="button"
          onClick={() => onFiltersOpen(!filtersOpen)}
          aria-pressed={filtersOpen}
          aria-label={filtersOpen ? 'Hide the filters' : 'Show the filters'}
          title={filtersOpen ? 'Hide the filters' : 'Filter by category or urgency'}
          className={cn(
            'ml-auto shrink-0 rounded-xs p-1 transition',
            narrowed || filtersOpen
              ? 'bg-accent-wash text-accent'
              : 'text-text-faint hover:bg-canvas-raise hover:text-text-secondary',
          )}
        >
          <Filter className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={onCollapse}
          title="Hide the queue"
          aria-label="Hide the queue"
          className="-mr-1 shrink-0 rounded-xs p-1 text-text-faint transition hover:bg-canvas-raise hover:text-text-secondary"
        >
          <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/*
        What the list on screen actually is, said once. It described the price of
        a download and nothing about the order, so under any grouping the heading
        and the list underneath it were describing different things.
      */}
      <p className="-mt-1 text-2xs text-text-muted">
        {state.grouping === 'recent'
          ? 'Matched to your interests, newest first'
          : state.grouping === 'date'
            ? `Matched to your interests, ${state.dateOrder === 'newest' ? 'newest' : 'oldest'} day first`
            : 'Matched to your interests, by subject'}
        {narrowed ? ` · ${shown} of ${total} shown` : ''}
      </p>

      <div className="flex items-center gap-1.5 rounded-sm bg-canvas-raise/60 px-2.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={2} />
        <input
          type="search"
          value={state.query}
          onChange={(event) => set('query', event.target.value)}
          placeholder="Search what, where or reference"
          aria-label="Search the reports waiting"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-text-primary outline-none placeholder:text-text-faint"
        />
        {state.query ? (
          <button
            type="button"
            onClick={() => set('query', '')}
            aria-label="Clear the search"
            className="shrink-0 rounded-xs p-0.5 text-text-faint transition hover:text-text-secondary"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      {/* Licensed or not: a view of the same queue rather than a narrowing. */}
      <div className="flex gap-0.5 rounded-sm bg-canvas-raise/70 p-0.5">
        {(['offered', 'licensed', 'all'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => set('status', key)}
            aria-pressed={state.status === key}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xs py-1.5 text-xs capitalize transition',
              state.status === key
                ? 'bg-canvas-soft font-medium text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            {key}
            <span className="tabular text-2xs text-text-faint">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex gap-0.5 rounded-sm bg-canvas-raise/60 p-0.5" role="group">
            {GROUPINGS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => set('grouping', option.value)}
                aria-pressed={state.grouping === option.value}
                title={option.title}
                className={cn(
                  'flex-1 rounded-xs px-2 py-1 text-2xs font-medium transition',
                  state.grouping === option.value
                    ? 'bg-canvas text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {/* Only under the date view: a category has no natural direction. */}
        {state.grouping === 'date' ? (
          <button
            type="button"
            onClick={() => set('dateOrder', state.dateOrder === 'newest' ? 'oldest' : 'newest')}
            title={`${state.dateOrder === 'newest' ? 'Today at the top' : 'The longest-waiting day at the top'} — click to swap`}
            aria-label={`${state.dateOrder === 'newest' ? 'Newest' : 'Oldest'} first. Switch to ${state.dateOrder === 'newest' ? 'oldest' : 'newest'} first`}
            className="flex shrink-0 items-center gap-1 rounded-sm bg-canvas-raise/60 px-2 py-1.5 text-2xs font-medium text-text-secondary transition hover:text-text-primary"
          >
            <ArrowDownUp className="h-3 w-3 text-text-faint" strokeWidth={2} />
            {state.dateOrder === 'newest' ? 'Newest' : 'Oldest'}
          </button>
        ) : null}
      </div>

      {/*
        The two facets, folded away until asked for.

        Built from what is actually in the queue rather than from the full list
        of twenty-three categories: an officer should not be offered "Chieftaincy"
        as a filter on a day when nothing chieftaincy-related arrived, and be left
        wondering whether the filter is broken or the queue is empty.
      */}
      {filtersOpen ? (
        <div className="space-y-2 rounded-sm bg-canvas-raise/40 p-2">
          <Facet label="Category">
            <Chip active={state.category === 'all'} onClick={() => set('category', 'all')}>
              Any
            </Chip>
            {categories.map(({ value, count }) => (
              <Chip
                key={value}
                active={state.category === value}
                onClick={() => set('category', state.category === value ? 'all' : value)}
                hue={categoryHue(value)}
              >
                {categoryLabel(value)}
                <span className="tabular text-text-faint">{count}</span>
              </Chip>
            ))}
          </Facet>

          <Facet label="Urgency">
            <Chip active={state.severity === 'all'} onClick={() => set('severity', 'all')}>
              Any
            </Chip>
            {severities.map(({ value, count }) => (
              <Chip
                key={value}
                active={state.severity === value}
                onClick={() => set('severity', state.severity === value ? 'all' : value)}
                hue={severityMeta(value).hue}
              >
                {severityMeta(value).label}
                <span className="tabular text-text-faint">{count}</span>
              </Chip>
            ))}
          </Facet>

          {narrowed ? (
            <button
              type="button"
              onClick={() =>
                onChange({ ...state, query: '', category: 'all', severity: 'all' })
              }
              className="text-2xs font-medium text-accent transition hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-text-faint">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  hue,
  children,
}: {
  active: boolean;
  onClick: () => void;
  hue?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-2xs transition',
        active
          ? 'border-accent bg-accent-wash text-accent'
          : 'border-hairline/12 text-text-muted hover:border-accent/30',
      )}
    >
      {hue && !active ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-pill" style={{ backgroundColor: hue }} />
      ) : null}
      {children}
    </button>
  );
}
