import type { ReactNode } from 'react';

/**
 * The top of every console page.
 *
 * Fixed height and outside the scroll region, so the title of what you are
 * looking at never scrolls away from you. Title left, actions right, one line
 * of context beneath.
 *
 * Kept as a component so vertical rhythm cannot drift between pages — a
 * console where each screen starts at a different height feels unfinished
 * before you have read a word of it.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-6 border-b border-hairline/[0.07] px-7 py-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.01em]">{title}</h1>
        {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
