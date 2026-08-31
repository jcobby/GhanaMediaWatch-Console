import { SAMPLE_INCIDENTS, VERIFICATION_META } from '@dawuro/core';
import { Sidebar, UserMenu, type NavItem } from '@/components/shell';
import { requireSession } from '@/lib/session';

/**
 * The verification desk.
 *
 * A separate console from platform operations on purpose. Operating the service
 * and judging whether a claim is true are different jobs held by different
 * organisations, and one account able to do both could route a report to itself
 * and publish it unchecked.
 */
export default async function EditorialLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();

  // Anything not yet closed is work. Verified and rejected reports are records.
  const open = SAMPLE_INCIDENTS.filter(
    (i) => !VERIFICATION_META[i.verification].mayUseWordVerified && i.verification !== 'rejected',
  ).length;

  const items: NavItem[] = [
    { href: '/editorial', label: 'Triage', icon: 'verify', count: open },
    { href: '/editorial/decided', label: 'Decided', icon: 'history' },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        items={items}
        brand={
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">Dawuro</p>
            <p className="mt-0.5 text-sm font-medium">Verification Desk</p>
          </div>
        }
        footer={<UserMenu user={user} />}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
