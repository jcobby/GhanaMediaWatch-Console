import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { PayoutsWorkspace } from '@/components/payouts/PayoutsWorkspace';
import { platform } from '@/lib/consoleApi';
import { normalisePayoutRun, summariseUnpaid } from '@/lib/payouts';

/**
 * Money owed to reporters, and the batches that release it.
 *
 * The page most damaged by a fixture fallback: an operator reading a seeded
 * batch during an outage would release a payment that does not correspond to
 * anything anyone earned. A failure here has to stop the screen, not fill it.
 */
export default async function Page() {
  const result = await load(async () => {
    const runs = (await platform.payouts<unknown>()).map((batch) => normalisePayoutRun(batch));
    /*
     * What a new batch would contain, read separately and allowed to fail.
     *
     * It is context for the release button rather than the subject of the page:
     * an operator must still be able to see and release the batches that exist
     * if this read goes down. Null means "we could not ask", which the screen
     * says rather than printing a zero — on a money screen those are very
     * different statements.
     */
    const unpaid = await platform
      .commissions<unknown>()
      .then(summariseUnpaid)
      .catch(() => null);
    return { runs, unpaid };
  });

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Payouts"
        description="Reporter earnings, batched for release over mobile money."
      />
      {result.ok ? (
        <PayoutsWorkspace runs={result.data.runs} unpaid={result.data.unpaid} />
      ) : (
        <Outage error={result.error} retryHref="/platform/payouts" />
      )}
    </>
  );
}
