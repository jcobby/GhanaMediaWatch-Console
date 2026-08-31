import { COMMISSION_LEDGER, PAYOUT_BATCHES } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { PayoutsWorkspace } from './PayoutsWorkspace';

export default async function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Payouts"
        description="Reporter earnings, batched for release over mobile money."
      />
      <PayoutsWorkspace batches={PAYOUT_BATCHES} ledger={COMMISSION_LEDGER} />
    </>
  );
}
