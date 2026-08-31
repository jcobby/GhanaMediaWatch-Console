'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { NavSection } from '@dawuro/core';
import { NAV_ICONS, type NavIconName } from './icons';

export interface NavItem {
  href: Route;
  label: string;
  /** Name, not a component — see icons.ts for why. */
  icon: NavIconName;
  /** Count shown on the right — omitted rather than shown as zero. */
  count?: number;
}

/**
 * Navigation from `@dawuro/core` carries plain string hrefs, because that
 * package knows nothing about Next. Typed routes cannot verify a registry that
 * is data rather than literals, so the cast happens here, once, instead of at
 * every call site — and the roles test asserts every href in the registry is a
 * route that exists.
 */
function asRoute(href: string): Route {
  return href as Route;
}

/**
 * Console navigation.
 *
 * A persistent sidebar rather than the phone's tab bar: there are more
 * destinations than a tab bar holds, they have names worth reading, and a
 * console user navigates with a pointer and a keyboard rather than a thumb.
 *
 * The rail sits on a slightly deeper ground than the content beside it. A
 * console is looked at for hours, and an interface with no tonal anchor makes
 * the eye hunt for the edge of the working area every time it comes back.
 *
 * Active state is carried by fill, weight *and* a left rule — never colour
 * alone, which fails for anyone who cannot separate violet from grey.
 */
export function Sidebar({
  items,
  sections,
  accent,
  brand,
  footer,
}: {
  /** Sugar for a single unlabelled group. */
  items?: NavItem[];
  /** Grouped navigation, as `navigationFor(role)` returns it. */
  sections?: NavSection[];
  /** The role's own hue, used for the active rule. Falls back to the accent. */
  accent?: string;
  brand: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();

  const groups: NavSection[] = sections ?? [{ title: null, items: items ?? [] }];

  return (
    <nav
      aria-label="Console"
      className="flex h-full w-[244px] shrink-0 flex-col border-r border-hairline/[0.07] bg-canvas-raise/45"
    >
      <div className="px-5 pb-4 pt-5">{brand}</div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {groups.map((group, groupIndex) => (
          <ul key={group.title ?? `g${groupIndex}`} className="space-y-0.5">
            {group.title ? (
              <li className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
                {group.title}
              </li>
            ) : null}
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = NAV_ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={asRoute(item.href)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-sm py-2 pl-3 pr-2.5 text-sm transition-colors',
                      active
                        ? 'bg-canvas-soft font-medium text-text-primary shadow-sm'
                        : 'text-text-muted hover:bg-canvas-soft/60 hover:text-text-primary',
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-pill"
                        style={{
                          backgroundColor: accent ?? 'rgb(var(--color-accent))',
                        }}
                      />
                    ) : null}
                    <Icon
                      className="h-[17px] w-[17px] shrink-0"
                      style={active ? { color: accent ?? 'rgb(var(--color-accent))' } : undefined}
                      strokeWidth={active ? 2.2 : 1.75}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.count !== undefined && item.count > 0 ? (
                      <span
                        className={cn(
                          'tabular min-w-[20px] rounded-pill px-1.5 py-px text-center text-2xs font-semibold',
                          active
                            ? 'bg-accent text-text-on-dark'
                            : 'bg-hairline/[0.07] text-text-muted group-hover:bg-hairline/10',
                        )}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>

      <div className="border-t border-hairline/[0.07] p-3">{footer}</div>
    </nav>
  );
}
