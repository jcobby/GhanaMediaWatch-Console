import type { OrganisationApplication } from '@dawuro/core';
import { Sidebar, UserMenu, type NavItem } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { platform } from '@/lib/consoleApi';

/**
 * The platform operator's console.
 *
 * Counts sit on Routing and Approvals because those are queues someone is
 * accountable for draining. Payouts deliberately has none: a number beside
 * money reads as a target, and batches should be released when they are
 * correct, not when the badge is empty.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  /*
   * Badge counts, read live.
   *
   * A count that fails to load shows as no badge rather than as zero. Zero is a
   * claim — "the queue is clear, go home" — and it is the wrong one to make on
   * behalf of a backend that did not answer. The page behind the link renders
   * the outage properly; the sidebar just stops asserting.
   */
  const [pendingRoutes, pendingApprovals] = await Promise.all([
    platform
      .routing()
      .then((q) => q.filter((r) => r.status === 'awaiting_routing').length)
      .catch(() => undefined),
    platform
      .applications<OrganisationApplication>()
      .then((a) => a.filter((x) => x.status === 'pending').length)
      .catch(() => undefined),
  ]);

  const items: NavItem[] = [
    { href: '/platform', label: 'Console', icon: 'dashboard' },
    {
      href: '/platform/routing',
      label: 'Routing',
      icon: 'share',
      ...(pendingRoutes === undefined ? {} : { count: pendingRoutes }),
    },
    {
      href: '/platform/approvals',
      label: 'Approvals',
      icon: 'badge',
      ...(pendingApprovals === undefined ? {} : { count: pendingApprovals }),
    },
    { href: '/platform/payouts', label: 'Payouts', icon: 'banknote' },
    { href: '/platform/organisations', label: 'Organisations', icon: 'building' },
    // No badge: it is a setting, not a queue. A count beside it would imply
    // there is something waiting to be done.
    { href: '/platform/top-stories', label: 'Top stories', icon: 'megaphone' },
  ];

  return (
    /* h-screen + overflow-hidden on the shell means only the inner panels
       scroll. Without it the whole document scrolls and the sidebar slides
       away with the content, which is what a console must never do. */
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        items={items}
        brand={
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">Dawuro</p>
            <p className="mt-0.5 text-sm font-medium">Platform Operations</p>
          </div>
        }
        footer={<UserMenu user={user} />}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
