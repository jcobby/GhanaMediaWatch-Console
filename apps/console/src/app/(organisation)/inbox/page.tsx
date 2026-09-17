import { redirect } from 'next/navigation';
import { roleCan } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { load } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { currentBusiness, offeredTo } from '@/lib/inbox';
import { InboxWorkspace } from './InboxWorkspace';

/**
 * What routing delivered to this organisation.
 *
 * The queue comes from the server, which is what performed the routing. The
 * plan and its download charge are still computed by `@dawuro/core`, and
 * deliberately so: that is the shared rule the phone uses to compute a
 * reporter's commission from the same purchase, and the two must never disagree
 * about money.
 *
 * **The "nothing here is saved yet" banner is gone because it is no longer
 * true.** Licensing was local state — the row moved to the Licensed tab, the
 * button said "Downloaded", and the service was told nothing, so a reload
 * brought the report back unlicensed. It now posts to
 * `/org/incidents/{id}/license` and the tick only appears once the service has
 * confirmed the purchase.
 *
 * **No page header over the queue**, for the reason the verification desk has
 * none: it spent a hundred pixels on an eyebrow, a title and a line about
 * pricing, above a screen where the sidebar already says Inbox — height taken
 * from the footage and the decision, on the two-pane screen shortest of it. The
 * queue carries the title now, and the price is stated where it is charged, on
 * the download button. An outage keeps the header, because then there is no
 * queue to carry it.
 */
export default async function InboxPage() {
  /*
   * Citizens' footage, so the role is checked here and not only in the menu.
   *
   * Middleware gates this path on the *account type* — it never reads
   * `session.role` — and the layout says outright that it trusts middleware for
   * exactly that reason. Neither is a capability check, so until now nothing
   * anywhere enforced `view_inbox`: an Agent, who does not hold it, was offered
   * this page in the sidebar and served the queue on arrival.
   *
   * **Enforced only when the account carries a role.** An organisation login may
   * have none — the seeded institution accounts carry a `businessId` and nothing
   * else — and `roleCan(undefined, …)` is false for everything, so the usual
   * `!session.role || !roleCan(…)` form would lock an institution out of its own
   * inbox. That is why this reads differently from `/agent` or `/invoices`,
   * which are capability-*unlocked* extras rather than part of the shell.
   */
  const session = await requireSession();
  if (session.role && !roleCan(session.role, 'view_inbox')) redirect('/');

  const result = await load(async () => {
    const organisation = await currentBusiness();
    return { organisation, reports: await offeredTo() };
  });

  if (result.ok) {
    return (
      <InboxWorkspace reports={result.data.reports} organisation={result.data.organisation} />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Reports"
        description="Matched to your interests."
      />
      <OrganisationOutage error={result.error} retryHref="/inbox" />
    </>
  );
}
