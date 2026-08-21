import { Sidebar, UserMenu, type NavItem } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { countOffered } from '@/lib/inbox';

/**
 * The organisation's console.
 *
 * Ordered by the job: what arrived, what you did with it, what you asked for,
 * then the administrative surfaces. Inbox carries a count because it is the
 * only item where "is there anything new" is the whole question.
 *
 * Middleware has already guaranteed the account type, so this layout trusts
 * the session rather than re-checking it.
 */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  const waiting = user.businessId ? countOffered(user.businessId) : 0;

  const items: NavItem[] = [
    { href: '/inbox', label: 'Inbox', icon: 'inbox', count: waiting },
    { href: '/published', label: 'Published', icon: 'megaphone' },
    { href: '/surveys', label: 'Surveys', icon: 'clipboard' },
    { href: '/team', label: 'Team', icon: 'users' },
    { href: '/account', label: 'Account', icon: 'building2' },
  ];

  return (
    <div className="flex">
      <Sidebar
        items={items}
        brand={
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">Dawuro</p>
            <p className="mt-0.5 truncate text-sm font-medium" title={user.businessName ?? ''}>
              {user.businessName ?? 'Organisation'}
            </p>
          </div>
        }
        footer={<UserMenu user={user} />}
      />
      <main className="h-screen flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
