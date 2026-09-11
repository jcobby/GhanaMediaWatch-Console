import { redirect } from 'next/navigation';
import {
  PLATFORM_FEE_RATE,
  formatCedis,
  payoutProgress,
  roleCan,
  type CommissionEntry,
  type EarningsSummary,
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
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { requireSession } from '@/lib/session';
import { load } from '@/components/ui';
import { me } from '@/lib/consoleApi';

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'view_earnings')) redirect('/');

  /*
   * Real money, from the server.
   *
   * Every figure here is integer pesewas as the API returns them — nothing is
   * summed, converted or rounded in this console. A balance shown on this page
   * is what somebody expects to arrive on their phone, so a seeded one is a
   * promise the platform never made.
   */
  const result = await load(async () => ({
    summary: await me.earnings<EarningsSummary>(),
    ledger: await me.commissions<CommissionEntry>().catch(() => [] as CommissionEntry[]),
  }));

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Earnings"
          blurb="What your reports have earned, and when it will be paid."
        />
        <OrganisationOutage error={result.error} retryHref="/earnings" />
      </PageShell>
    );
  }

  const s = result.data.summary;
  const COMMISSION_LEDGER = result.data.ledger;
  const progress = payoutProgress(s.pendingPesewas, s.payoutThresholdPesewas);
  const short = Math.max(0, s.payoutThresholdPesewas - s.pendingPesewas);

  return (
    <PageShell>
      <PageIntro
        title="Earnings"
        blurb="What your reports have earned, and when it will be paid."
      />

      <StatGrid>
        <Stat
          label="Pending"
          value={formatCedis(s.pendingPesewas)}
          tone="warn"
          hint="Licensed, not yet paid"
        />
        <Stat label="Paid" value={formatCedis(s.paidPesewas)} tone="good" />
        <Stat label="Lifetime" value={formatCedis(s.lifetimePesewas)} />
        <Stat label="Reports licensed" value={String(s.reportsLicensed)} />
      </StatGrid>

      <Split>
        <Panel title="Next payout" subtitle="Paid once your balance clears the floor.">
          <div className="space-y-3">
            <Bar
              label="Toward the threshold"
              value={s.pendingPesewas}
              max={s.payoutThresholdPesewas}
              display={`${formatCedis(s.pendingPesewas)} of ${formatCedis(s.payoutThresholdPesewas)}`}
              tone={progress >= 1 ? 'good' : 'warn'}
            />
            <p className="text-xs leading-relaxed text-text-muted">
              {progress >= 1 ? (
                <>
                  You are over the threshold. The next run is{' '}
                  {s.nextPayoutIso
                    ? new Date(s.nextPayoutIso).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                      })
                    : 'scheduled shortly'}
                  .
                </>
              ) : (
                <>
                  {formatCedis(short)} to go. Below the floor the balance rolls into the following
                  run rather than being sent — a transfer that costs more in fees than it carries
                  helps nobody.
                </>
              )}
            </p>
          </div>
        </Panel>

        <Panel
          title="How a figure is reached"
          subtitle="The same calculation before you submit and after."
        >
          <ul className="space-y-2 text-xs leading-relaxed text-text-secondary">
            <li>A base rate for the category — governance and environment pay most.</li>
            <li>×1.5 for video, ×1.25 for audio, against a photograph.</li>
            <li>×1.25 when you send it to named organisations only.</li>
            <li>×0.7 when the location fix was low confidence.</li>
            <li>Each additional organisation licensing it adds half a share.</li>
            <li>
              The platform takes {Math.round(PLATFORM_FEE_RATE * 100)}%, at the moment of licensing.
            </li>
          </ul>
        </Panel>
      </Split>

      <Panel
        title="Ledger"
        subtitle="An amount is fixed when an organisation licenses the report. Rates change; this does not."
      >
        <Table
          empty="Nothing earned yet. A line appears here each time an organisation licenses one of your reports."
          columns={['Report', 'Category', 'Licensed by', 'When', 'Status', 'Amount']}
          rows={COMMISSION_LEDGER.map((c) => [
            <span key="r" className="text-xs text-text-secondary">
              {c.incidentSummary}
            </span>,
            <span key="c" className="text-xs text-text-muted">
              {c.category}
            </span>,
            <span key="b" className="text-xs text-text-muted">
              {c.businessName ?? '—'}
            </span>,
            <span key="w" className="whitespace-nowrap text-xs text-text-muted">
              {new Date(c.createdAtIso).toLocaleDateString('en-GB')}
            </span>,
            <Pill
              key="s"
              tone={
                c.status === 'paid'
                  ? 'good'
                  : c.status === 'earned'
                    ? 'warn'
                    : c.status === 'void'
                      ? 'bad'
                      : 'neutral'
              }
            >
              {c.status}
            </Pill>,
            <span key="a" className="tabular font-medium">
              {formatCedis(c.amountPesewas)}
            </span>,
          ])}
          align={[5]}
        />
      </Panel>

      <Note>
        Reports sent only to the public feed earn nothing, and the app says so before you send one.
        Visibility is the reward there — pretending otherwise would set an expectation the model
        cannot meet.
      </Note>
    </PageShell>
  );
}
