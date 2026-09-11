import type { CommissionEntry, PayoutBatch } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { NotWired, Outage, load } from '@/components/ui';
import { platform } from '@/lib/consoleApi';
import { PayoutsWorkspace } from './PayoutsWorkspace';

/**
 * Money owed to reporters, and the batches that release it.
 *
 * The page most damaged by a fixture fallback: an operator reading a seeded
 * batch during an outage would release a payment that does not correspond to
 * anything anyone earned. A failure here has to stop the screen, not fill it.
 */
export default async function Page() {
  const result = await load(async () => {
    const batches = await platform.payouts<PayoutBatch>();
    return { batches, ledger: batches.flatMap((b) => entriesOf(b)) };
  });

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Payouts"
        description="Reporter earnings, batched for release over mobile money."
      />
      <NotWired what="Releasing a payout batch" />
      {result.ok ? (
        <PayoutsWorkspace batches={result.data.batches} ledger={result.data.ledger} />
      ) : (
        <Outage error={result.error} retryHref="/platform/payouts" />
      )}
    </>
  );
}

/**
 * The commission lines a batch carries, if it carries them inline.
 *
 * The API has no separate platform-wide ledger endpoint — `/me/commissions` is
 * the reporter's own — so the lines are read from the batches themselves. A
 * batch that does not embed them contributes none rather than inventing any:
 * an empty ledger is truthful, a fabricated one is not.
 */
function entriesOf(batch: PayoutBatch): CommissionEntry[] {
  const embedded = (batch as PayoutBatch & { entries?: CommissionEntry[] }).entries;
  return Array.isArray(embedded) ? embedded : [];
}
