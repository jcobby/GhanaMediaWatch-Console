import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/cn';

/**
 * The pieces the nine admin dashboards are assembled from.
 *
 * Shared so the module reads as one product, but deliberately unopinionated
 * about content — the whole point of the role model is that a compliance
 * officer and a finance officer see different things, and a widget kit that
 * forced the same three metrics on both would undo that.
 */

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="rounded-md border border-hairline/10 bg-canvas-soft p-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-text-faint">{label}</p>
      <p
        className={cn(
          'tabular mt-1.5 text-2xl font-semibold tracking-tight',
          tone === 'good' && 'text-success',
          tone === 'warn' && 'text-warning',
          tone === 'bad' && 'text-danger',
          tone === 'neutral' && 'text-text-primary',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-md border border-hairline/10 bg-canvas-soft', className)}>
      <header className="flex items-start justify-between gap-3 border-b border-hairline/[0.07] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/**
 * A table that scrolls inside its own frame rather than widening the page.
 *
 * `rowHref` makes a row navigable. It is deliberately optional and per-row:
 * a row that leads nowhere must not look like it leads somewhere, and the
 * quickest way to make a console feel broken is to give every row a pointer
 * cursor and have half of them do nothing.
 */
export function Table({
  columns,
  rows,
  align = [],
  rowHref,
  empty,
}: {
  columns: string[];
  rows: ReactNode[][];
  /** Column indices to right-align — figures, almost always. */
  align?: number[];
  /** Where row `i` goes when clicked. Return undefined for a row that is not navigable. */
  rowHref?: (index: number) => string | undefined;
  /**
   * What would put something in this table.
   *
   * "Nothing here yet" is true of an empty audit ledger, an empty payout queue
   * and an empty staff list, and useless on all three: it does not say whether
   * the operator is waiting on somebody, on a process, or on themselves. Where
   * a page can answer that, it should.
   */
  empty?: string;
}) {
  const right = new Set(align);

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs leading-relaxed text-text-faint">
        {empty ?? 'Nothing here yet.'}
      </p>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                className={cn(
                  'whitespace-nowrap pb-2 text-2xs font-semibold uppercase tracking-[0.1em] text-text-faint',
                  right.has(i) ? 'text-right' : 'text-left',
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((row, r) => {
            const href = rowHref?.(r);
            return (
              <tr
                key={r}
                className={cn(
                  'border-t border-hairline/[0.06]',
                  href && 'cursor-pointer transition hover:bg-accent-wash/30',
                )}
              >
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={cn('py-2.5 pr-4 align-top', right.has(i) && 'pr-0 text-right')}
                  >
                    {/* The link wraps the first cell only. Wrapping every cell
                        would put a dozen duplicate links in the accessibility
                        tree for one row; wrapping the <tr> is invalid HTML. */}
                    {href && i === 0 ? (
                      <Link href={href as Route} className="block hover:text-accent">
                        {cell}
                      </Link>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-pill px-2 py-0.5 text-2xs font-medium',
        tone === 'neutral' && 'bg-canvas-raise text-text-muted',
        tone === 'good' && 'bg-success-wash text-success',
        tone === 'warn' && 'bg-warning-wash text-warning',
        tone === 'bad' && 'bg-danger-wash text-danger',
        tone === 'info' && 'bg-info-wash text-info',
      )}
    >
      {children}
    </span>
  );
}

/** A short list of things that happened, newest first. */
export function Feed({ items }: { items: { when: string; what: ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="tabular w-16 shrink-0 pt-px text-2xs text-text-faint">{item.when}</span>
          <span className="min-w-0 text-xs leading-relaxed text-text-secondary">{item.what}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * What this role is for, in its own words.
 *
 * Present on every admin dashboard because twenty roles is more than anyone
 * holds in their head, and a demo viewer switching between them needs to know
 * what they are looking at without consulting a document.
 */
export function RoleIntro({
  label,
  description,
  hue,
}: {
  label: string;
  description: string;
  hue: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-hairline/10 bg-canvas-raise/40 p-4">
      <span aria-hidden className="w-1 shrink-0 rounded-pill" style={{ backgroundColor: hue }} />
      <div>
        <h1 className="text-base font-semibold tracking-tight text-text-primary">{label}</h1>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-text-muted">{description}</p>
      </div>
    </div>
  );
}

/** Two panels side by side on wide screens, stacked below. */
export function Split({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
}

/**
 * A labelled bar.
 *
 * Used for progress toward a threshold and for shares of a total. The figure
 * is always printed beside it — a bar alone tells you a proportion but never
 * the amount, and on a payout screen the amount is the point.
 */
export function Bar({
  label,
  value,
  max,
  display,
  tone = 'accent',
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  tone?: 'accent' | 'good' | 'warn' | 'bad';
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="tabular text-xs font-medium text-text-primary">{display}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-canvas-raise">
        <div
          className={cn(
            'h-full rounded-pill',
            tone === 'accent' && 'bg-accent',
            tone === 'good' && 'bg-success',
            tone === 'warn' && 'bg-warning',
            tone === 'bad' && 'bg-danger',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** A page heading with the one-line explanation under it. */
export function PageIntro({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-text-muted">{blurb}</p>
    </div>
  );
}

/** The frame every built page sits in. */
export function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl space-y-4 p-5">{children}</div>;
}

/**
 * A short explanatory note.
 *
 * For the rule behind what is on screen — why a circle stands in for a
 * boundary, why rotation does not invalidate old signatures. The reasoning is
 * usually the part someone new actually needs.
 */
export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div
      className={cn(
        'rounded-md border px-4 py-3',
        tone === 'info' && 'border-info/25 bg-info-wash/30',
        tone === 'warn' && 'border-warning/25 bg-warning-wash/40',
      )}
    >
      <p className="text-xs leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}
