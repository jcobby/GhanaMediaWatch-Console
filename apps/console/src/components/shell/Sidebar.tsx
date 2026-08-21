'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
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
 * Console navigation.
 *
 * A persistent sidebar rather than the phone's tab bar: there are more than
 * five destinations, they have names worth reading, and a console user is
 * navigating with a pointer and a keyboard rather than a thumb.
 *
 * The active item is marked by fill *and* a left rule, not colour alone —
 * colour alone fails for anyone who cannot distinguish violet from grey.
 */
export function Sidebar({
  items,
  brand,
  footer,
}: {
  items: NavItem[];
  brand: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Console"
      className="flex h-screen w-60 shrink-0 flex-col border-r border-hairline/[0.08] bg-canvas-soft"
    >
      <div className="px-4 py-5">{brand}</div>

      <ul className="flex-1 space-y-0.5 px-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = NAV_ICONS[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition',
                  active
                    ? 'bg-accent-wash font-medium text-accent'
                    : 'text-text-secondary hover:bg-canvas-raise hover:text-text-primary',
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-pill bg-accent"
                  />
                ) : null}
                <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.count !== undefined && item.count > 0 ? (
                  <span
                    className={cn(
                      'tabular rounded-pill px-1.5 py-0.5 text-2xs font-medium',
                      active ? 'bg-accent text-text-on-dark' : 'bg-canvas-raise text-text-muted',
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

      <div className="border-t border-hairline/[0.08] p-3">{footer}</div>
    </nav>
  );
}
