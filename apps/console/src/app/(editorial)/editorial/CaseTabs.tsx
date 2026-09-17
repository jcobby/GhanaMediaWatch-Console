'use client';

import { cn } from '@/lib/cn';

/** The three things an editor reads about a report, one at a time. */
export type CaseTab = 'evidence' | 'value' | 'contact';

const TABS: { value: CaseTab; label: string }[] = [
  { value: 'evidence', label: 'Evidence' },
  { value: 'value', label: 'News value' },
  { value: 'contact', label: 'Source contact' },
];

/**
 * The case, in tabs.
 *
 * It was one column: the footage, the assurance note, two scoring panels with
 * ten rating rows between them, then the contact log — and on a screen too
 * narrow for the side rail, the checklist and the decision after all of that.
 * Reading a photograph meant scrolling past a scoring form to reach the button
 * that ruled on it.
 *
 * Each tab says what is outstanding inside it, so a tab that is not open is not
 * a tab that can be forgotten: the criteria nobody has rated yet, and how many
 * attempts have been made to reach the reporter.
 */
export function CaseTabs({
  value,
  onChange,
  unrated,
  contacts,
}: {
  value: CaseTab;
  onChange: (next: CaseTab) => void;
  /** Criteria still needing an editor's rating. */
  unrated: number;
  /** Attempts logged to reach the reporter. */
  contacts: number;
}) {
  return (
    <div
      role="tablist"
      aria-label="Case sections"
      className="flex gap-1 border-b border-hairline/[0.08]"
    >
      {TABS.map((tab) => {
        const active = value === tab.value;
        const count = tab.value === 'value' ? unrated : tab.value === 'contact' ? contacts : null;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-xs font-medium transition',
              active
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            {tab.label}
            {count ? (
              <span
                className={cn(
                  'tabular rounded-pill px-1.5 text-2xs',
                  tab.value === 'value'
                    ? 'bg-warning-wash text-text-secondary'
                    : 'bg-canvas-raise text-text-muted',
                )}
                title={
                  tab.value === 'value'
                    ? `${count} of 10 criteria not rated yet`
                    : `${count} contact attempt${count === 1 ? '' : 's'} logged`
                }
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
