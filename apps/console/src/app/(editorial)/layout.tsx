import { UserMenu, type NavItem } from '@/components/shell';
import { TopBar } from '@/components/shell/TopBar';
import { requireSession } from '@/lib/session';
import { editorial } from '@/lib/consoleApi';

/**
 * The verification desk.
 *
 * A separate console from platform operations on purpose. Operating the service
 * and judging whether a claim is true are different jobs held by different
 * organisations, and one account able to do both could route a report to itself
 * and publish it unchecked.
 *
 * **Navigation across the top, not down the side.** Two destinations do not
 * need a 244px rail, and the desk beneath is three things side by side — the
 * queue, the evidence and the decision — that were squeezed into what the rail
 * left over.
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
  const [open, requests] = await Promise.all([
    editorial
      .queue<unknown>()
      .then((q) => q.length)
      .catch(() => undefined),
    // Organisations waiting to hear whether their report runs.
    editorial
      .publicationRequests<unknown>()
      .then((r) => r.length)
      .catch(() => undefined),
  ]);

  const items: NavItem[] = [
    {
      href: '/editorial',
      label: 'Triage',
      icon: 'verify',
      ...(open === undefined ? {} : { count: open }),
    },
    {
      href: '/editorial/requests',
      label: 'Requests',
      icon: 'send',
      ...(requests === undefined ? {} : { count: requests }),
    },
    // The front page's running order: every current lead, and a way off the top.
    { href: '/editorial/leading', label: 'Leading', icon: 'megaphone' },
    { href: '/editorial/decided', label: 'Decided', icon: 'history' },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar
        items={items}
        brand={
          <p className="flex items-baseline gap-2">
            <span className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
              Dawuro
            </span>
            <span className="text-sm font-medium">Verification Desk</span>
          </p>
        }
        right={<UserMenu user={user} />}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
