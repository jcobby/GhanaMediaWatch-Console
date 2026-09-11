import { downloadCharge, formatCedis, isUnlimited, planFor } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { NotWired, load } from '@/components/ui';
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
 */
export default async function InboxPage() {
  const result = await load(async () => {
    const organisation = await currentBusiness();
    return { organisation, reports: await offeredTo() };
  });

  const plan = result.ok ? planFor(result.data.organisation.tier) : null;

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Reports"
        description={
          // The description quotes a price. With no plan loaded there is no
          // price to quote, and guessing one on a page where a click costs
          // money is the wrong kind of helpful.
          !plan
            ? 'Matched to your interests.'
            : isUnlimited(plan)
              ? 'Matched to your interests. Your annual plan covers unlimited downloads.'
              : `Matched to your interests. Downloads cost ${formatCedis(downloadCharge(plan) ?? 0)} each on your plan.`
        }
      />
      <NotWired what="Licensing a report" />
      {result.ok ? (
        <InboxWorkspace reports={result.data.reports} organisation={result.data.organisation} />
      ) : (
        <OrganisationOutage error={result.error} retryHref="/inbox" />
      )}
    </>
  );
}
