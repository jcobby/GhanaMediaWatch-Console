import { ROUTING_QUEUE, BUSINESS_APPLICATIONS } from '@dawuro/core';
import { Sidebar, UserMenu, type NavItem } from '@/components/shell';
import { requireSession } from '@/lib/session';

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

  const pendingRoutes = ROUTING_QUEUE.filter((r) => r.status === 'awaiting_routing').length;
  const pendingApprovals = BUSINESS_APPLICATIONS.filter((a) => a.status === 'pending').length;

  const items: NavItem[] = [
    { href: '/platform', label: 'Console', icon: 'dashboard' },
    {
      href: '/platform/routing',
      label: 'Routing',
      icon: 'share',
      count: pendingRoutes,
    },
    {
      href: '/platform/approvals',
      label: 'Approvals',
      icon: 'badge',
      count: pendingApprovals,
    },
    { href: '/platform/payouts', label: 'Payouts', icon: 'banknote' },
    { href: '/platform/businesses', label: 'Organisations', icon: 'building' },
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
