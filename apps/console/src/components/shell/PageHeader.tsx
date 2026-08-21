import type { ReactNode } from 'react';

/**
 * The top of every console page.
 *
 * Title on the left, actions on the right, one line of context beneath. Kept
 * as a component so the vertical rhythm cannot drift between pages — a console
 * where each screen starts at a different height feels unfinished.
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
    <header className="flex items-start justify-between gap-6 border-b border-hairline/[0.08] px-8 py-5">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-2xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="mt-0.5 truncate text-xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
