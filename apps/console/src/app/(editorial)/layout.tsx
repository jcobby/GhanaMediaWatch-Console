import { Sidebar, UserMenu, type NavItem } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { editorial } from '@/lib/consoleApi';

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

  /*
   * Open work, counted by the server.
   *
   * `/editorial/queue` *is* the undecided set — the desk decides what is still
   * work, and a client re-deriving that from a verification state would be
   * offering a second opinion on the one judgement this console exists to
   * record. A failed read shows no badge rather than zero: zero says the desk
   * is clear, which is not something to assert on behalf of a silent backend.
   */
  const open = await editorial
    .queue<unknown>()
    .then((q) => q.length)
    .catch(() => undefined);

  const items: NavItem[] = [
    {
      href: '/editorial',
      label: 'Triage',
      icon: 'verify',
      ...(open === undefined ? {} : { count: open }),
    },
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
