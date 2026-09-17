'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NAV_ICONS } from './icons';
import type { NavItem } from './Sidebar';

/**
 * Console navigation as a bar across the top.
 *
 * For a console with two destinations. The sidebar is right where there are a
 * dozen names worth reading; the verification desk has Triage and Decided, and
 * a 244px rail to hold two links took the width a triage queue, the footage and
 * the decision all needed — three columns fighting over what was left.
 *
 * **The most specific match is the active one.** `/editorial/decided` starts
 * with `/editorial/`, so a prefix test alone marks Triage as current on the
 * Decided page too. The longest matching href wins instead.
 */
export function TopBar({
  items,
  brand,
  right,
}: {
  items: NavItem[];
  brand: React.ReactNode;
  right: React.ReactNode;
}) {
  const pathname = usePathname();

  const current = items
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <header className="flex h-14 shrink-0 items-center gap-8 border-b border-hairline/[0.07] bg-canvas-raise/45 px-5">
      <div className="shrink-0">{brand}</div>

      <nav aria-label="Console" className="flex h-full items-stretch gap-1">
        {items.map((item) => {
          const active = item.href === current;
          const Icon = NAV_ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-2 px-3 text-sm transition-colors',
                active ? 'font-medium text-text-primary' : 'text-text-muted hover:text-text-primary',
              )}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={active ? { color: 'rgb(var(--color-accent))' } : undefined}
                strokeWidth={active ? 2.2 : 1.75}
              />
              {item.label}
              {item.count !== undefined && item.count > 0 ? (
                <span
                  className={cn(
                    'tabular min-w-[20px] rounded-pill px-1.5 py-px text-center text-2xs font-semibold',
                    active ? 'bg-accent text-text-on-dark' : 'bg-hairline/[0.07] text-text-muted',
                  )}
                >
                  {item.count}
                </span>
              ) : null}
              {/* Weight and a rule as well as colour, as the sidebar does. */}
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-[2px] rounded-t-pill bg-accent"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto w-[16rem] min-w-0">{right}</div>
    </header>
  );
}
