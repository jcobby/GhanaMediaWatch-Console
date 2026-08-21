import { downloadCharge, formatCedis, isUnlimited, planFor } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { businessFor, offeredTo } from '@/lib/inbox';
import { InboxWorkspace } from './InboxWorkspace';

/**
 * What routing delivered to this organisation.
 *
 * The queue is computed on the server through the shared matcher, so the page
 * arrives with its data rather than fetching it after paint — an inbox that
 * flashes empty on every visit reads as broken.
 */
export default async function InboxPage() {
  const user = await requireSession();
  const business = businessFor(user.businessId);
  const reports = offeredTo(business.id);
  const plan = planFor(business.tier);

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Reports"
        description={
          isUnlimited(plan)
            ? 'Matched to your interests. Your annual plan covers unlimited downloads.'
            : `Matched to your interests. Downloads cost ${formatCedis(downloadCharge(plan))} each on your plan.`
        }
      />
      <InboxWorkspace reports={reports} business={business} />
    </>
  );
}
