import { Sidebar, UserMenu } from '@/components/shell';
import { organisationNavigation } from '@dawuro/core';
import { requireSession } from '@/lib/session';
import { offeredTo } from '@/lib/inbox';

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
export default async function OrganisationLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  /*
   * How many reports are waiting, from the server's own inbox.
   *
   * Zero on a failed read, because `organisationNavigation` takes a number and the
   * badge is a nicety rather than the answer. The inbox page behind the link
   * renders the outage properly, so nobody is left believing an empty queue —
   * they click through and are told.
   */
  const waiting = await offeredTo()
    .then((r) => r.length)
    .catch(() => 0);

  /*
   * Built from the signed-in role rather than listed here.
   *
   * The hand-written list this replaces named seven pages. The shell has
   * fourteen, and the other seven — assignments, affiliations, submit,
   * earnings, support, invoices and the checkout behind it — were routable,
   * permitted by middleware, and linked from nowhere at all. The only way in
   * was to type the URL, so an organisation could not reach its own invoices.
   *
   * Deriving the menu means a page cannot be built without appearing, and a
   * capability cannot be granted without the way to use it.
   */
  const sections = organisationNavigation({
    role: user.role,
    inboxCount: waiting,
    onboardingComplete: user.onboardingComplete ?? true,
  });

  return (
    /* h-screen + overflow-hidden on the shell means only the inner panels
       scroll. Without it the whole document scrolls and the sidebar slides
       away with the content, which is what a console must never do. */
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        sections={sections}
        brand={
          /*
            An organisation that does not exist yet is not branded as one.

            The shell put the name straight from the registration form at the
            top of the sidebar, so somebody reading "Joy News is not registered
            yet" was reading it under a masthead that said Joy News — the app
            contradicting itself in two places on one screen. While the
            application is pending the name is shown as what it is: a request.
          */
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">Dawuro</p>
            <p className="mt-0.5 truncate text-sm font-medium" title={user.businessName ?? ''}>
              {user.businessName ?? 'Organisation'}
            </p>
            {user.onboardingComplete === false ? (
              <p className="mt-0.5 text-2xs text-text-faint">Not set up yet</p>
            ) : null}
          </div>
        }
        footer={<UserMenu user={user} />}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
