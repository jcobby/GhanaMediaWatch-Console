import { redirect } from 'next/navigation';
import {
  COMMISSION_LEDGER,
  EARNINGS_SUMMARY,
  PAYOUT_BATCHES,
  PLATFORM_FEE_RATE,
  formatCedis,
  roleCan,
} from '@dawuro/core';
import {
  Bar,
  Note,
  PageIntro,
  PageShell,
  Panel,
  Pill,
  Split,
  Stat,
  StatGrid,
  Table,
} from '@/components/admin/Widgets';
import { RowAction } from '@/components/admin/RowAction';
import { requireSession } from '@/lib/session';

/** Where reporters are paid. Mobile money is how Ghana pays. */
const DESTINATIONS = [
  { name: 'MTN MoMo', share: 0.68 },
  { name: 'Telecel Cash', share: 0.19 },
  { name: 'AirtelTigo Money', share: 0.11 },
  { name: 'Bank transfer', share: 0.02 },
];

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'run_payouts')) redirect('/');

  const draft = PAYOUT_BATCHES.find((b) => b.status === 'draft');
  const earned = COMMISSION_LEDGER.filter((c) => c.status === 'earned');
  const owed = earned.reduce((t, c) => t + c.amountPesewas, 0);
  const settled = PAYOUT_BATCHES.filter((b) => b.status === 'settled').reduce(
    (t, b) => t + b.totalPesewas,
    0,
  );

  return (
    <PageShell>
      <PageIntro title="Payouts" blurb="What reporters are owed, and releasing it." />

      <StatGrid>
        <Stat
          label="Next batch"
          value={draft ? formatCedis(draft.totalPesewas) : '—'}
          tone="warn"
          hint={draft ? `${draft.reporterCount} reporters` : 'No batch open'}
        />
        <Stat label="Owed, unbatched" value={formatCedis(owed)} hint={`${earned.length} entries`} />
        <Stat label="Settled to date" value={formatCedis(settled)} tone="good" />
        <Stat
          label="Platform share"
          value={`${Math.round(PLATFORM_FEE_RATE * 100)}%`}
          hint="Taken at licensing, not at payout"
        />
      </StatGrid>

      <Panel title="Batches" subtitle="A batch is released once, and never recomputed afterwards.">
        <Table
          columns={['Batch', 'Reporters', 'Total', 'Created', 'Settled', 'State', '']}
          rows={PAYOUT_BATCHES.map((b) => [
            <code key="i" className="text-xs text-text-primary">
              {b.id}
            </code>,
            <span key="r" className="tabular text-text-muted">
              {b.reporterCount}
            </span>,
            <span key="t" className="tabular font-medium">
              {formatCedis(b.totalPesewas)}
            </span>,
            <span key="c" className="text-xs text-text-muted">
              {new Date(b.createdAtIso).toLocaleDateString('en-GB')}
            </span>,
            <span key="s" className="text-xs text-text-muted">
              {b.settledAtIso ? new Date(b.settledAtIso).toLocaleDateString('en-GB') : '—'}
            </span>,
            <Pill key="st" tone={b.status === 'settled' ? 'good' : 'warn'}>
              {b.status}
            </Pill>,
            b.status === 'draft' ? (
              <RowAction
                key="a"
                label="Release"
                done="Released"
                tone="primary"
                confirm={`Pay ${formatCedis(b.totalPesewas)} to ${b.reporterCount} reporters?`}
              />
            ) : (
              <span key="a" className="text-2xs text-text-faint">
                Settled
              </span>
            ),
          ])}
          align={[1, 2, 6]}
        />
      </Panel>

      <Split>
        <Panel
          title="Payout threshold"
          subtitle="A reporter is paid once they clear the floor, so small balances do not cost more in fees than they carry."
        >
          <div className="space-y-3">
            <Bar
              label="Typical reporter balance"
              value={EARNINGS_SUMMARY.pendingPesewas}
              max={EARNINGS_SUMMARY.payoutThresholdPesewas}
              display={`${formatCedis(EARNINGS_SUMMARY.pendingPesewas)} of ${formatCedis(EARNINGS_SUMMARY.payoutThresholdPesewas)}`}
              tone="warn"
            />
            <p className="text-xs leading-relaxed text-text-muted">
              Below {formatCedis(EARNINGS_SUMMARY.payoutThresholdPesewas)} the balance rolls into
              the next run rather than being sent. The reporter sees this on their phone, so it is
              never a surprise.
            </p>
          </div>
        </Panel>

        <Panel title="Destinations" subtitle="Where the money actually goes.">
          <div className="space-y-3">
            {DESTINATIONS.map((d) => (
              <Bar
                key={d.name}
                label={d.name}
                value={d.share}
                max={1}
                display={`${Math.round(d.share * 100)}%`}
                tone={d.name === 'MTN MoMo' ? 'accent' : 'good'}
              />
            ))}
          </div>
        </Panel>
      </Split>

      <Panel
        title="Waiting to be batched"
        subtitle="Licensed and owed. The amount was fixed at licensing and is not recalculated here."
      >
        <Table
          columns={['Report', 'Category', 'Licensed by', 'When', 'Amount']}
          rows={earned.map((c) => [
            <span key="r" className="text-xs text-text-secondary">
              {c.incidentSummary}
            </span>,
            <span key="c" className="text-xs text-text-muted">
              {c.category}
            </span>,
            <span key="b" className="text-xs text-text-muted">
              {c.businessName ?? '—'}
            </span>,
            <span key="w" className="text-xs text-text-muted">
              {new Date(c.createdAtIso).toLocaleDateString('en-GB')}
            </span>,
            <span key="a" className="tabular font-medium">
              {formatCedis(c.amountPesewas)}
            </span>,
          ])}
          align={[4]}
        />
      </Panel>

      <Note>
        Every figure here is an integer number of pesewas. Rates change; a settled amount does not —
        it is fixed the moment a business licenses the report, and recomputing it later would mean a
        reporter&rsquo;s past earnings quietly moved.
      </Note>
    </PageShell>
  );
}
