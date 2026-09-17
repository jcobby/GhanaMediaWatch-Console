import { redirect } from 'next/navigation';
import { PLATFORM_FEE_RATE, formatCedis, roleCan } from '@dawuro/core';
import {
  Bar,
  Note,
  PageIntro,
  PageShell,
  Panel,
  Split,
  Stat,
  StatGrid,
} from '@/components/admin/Widgets';
import { PayoutsWorkspace } from '@/components/payouts/PayoutsWorkspace';
import { Outage, load } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { platform } from '@/lib/consoleApi';
import {
  needsAttention,
  normalisePayoutRun,
  sentPesewas,
  summariseUnpaid,
  type Network,
} from '@/lib/payouts';

/** The floor a balance must clear to be paid. Mirrors the phone's own copy. */
const PAYOUT_THRESHOLD_PESEWAS = 10_000;

const NETWORKS: Network[] = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Unknown network'];

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'run_payouts')) redirect('/');

  /*
   * Money owed to reporters.
   *
   * The single most dangerous page to serve from fixtures: an operator reading
   * a seeded draft batch would press release against amounts nobody earned.
   * Every figure below is integer pesewas exactly as the API reports them.
   */
  const result = await load(async () => {
    const batches = (await platform.payouts<unknown>()).map((batch) => normalisePayoutRun(batch));
    /*
     * What a new batch would contain — the same read the platform copy makes.
     *
     * This page omitted it, so the two mounts of `PayoutsWorkspace` showed
     * different things for the same job. Allowed to fail on its own: it is
     * context for the release button, not the subject of the page, and an
     * operator must still be able to see and release existing batches if this
     * read goes down. Null says "could not ask", which the screen states rather
     * than printing a zero — on a money screen those are different claims.
     */
    const owed = await platform
      .commissions<unknown>()
      .then(summariseUnpaid)
      .catch(() => null);
    return { batches, owed };
  });

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro title="Payouts" blurb="What reporters are owed, and releasing it." />
        <Outage error={result.error} retryHref="/admin/payouts" />
      </PageShell>
    );
  }

  const { batches: runs, owed } = result.data;
  const openTotal = runs
    .filter((run) => run.status === 'draft')
    .reduce((total, run) => total + run.totalPesewas, 0);
  const attention = runs.reduce((total, run) => total + needsAttention(run), 0);
  const sent = runs.reduce((total, run) => total + sentPesewas(run), 0);

  /*
   * Where payments went, counted from the payments themselves.
   *
   * This panel used to show fixed shares — 68% MTN, 19% Telecel — typed into
   * the page. They described no payment anyone made. These are counted from the
   * numbers each sent payment was addressed to.
   */
  const delivered = runs.flatMap((run) =>
    run.payments.filter((p) => p.status === 'sent' || p.status === 'paid'),
  );
  const byNetwork = NETWORKS.map((network) => ({
    network,
    count: delivered.filter((p) => p.network === network).length,
  })).filter((row) => row.count > 0);

  return (
    <PageShell>
      <PageIntro title="Payouts" blurb="What reporters are owed, and releasing it." />

      <StatGrid>
        <Stat
          label="Ready to release"
          value={formatCedis(openTotal)}
          tone={openTotal > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Needs attention"
          value={String(attention)}
          tone={attention > 0 ? 'bad' : 'good'}
          hint="Failed or held payments"
        />
        <Stat label="Sent to date" value={formatCedis(sent)} tone="good" />
        <Stat
          label="Platform share"
          value={`${Math.round(PLATFORM_FEE_RATE * 100)}%`}
          hint="Taken at licensing, not at payout"
        />
      </StatGrid>

      <Panel title="Batches" subtitle="A batch is released once, and never recomputed afterwards.">
        <div className="p-4">
          <PayoutsWorkspace runs={runs} unpaid={owed} embedded />
        </div>
      </Panel>

      <Split>
        <Panel
          title="Payout threshold"
          subtitle="A reporter is paid once they clear the floor, so small balances do not cost more in fees than they carry."
        >
          <p className="text-xs leading-relaxed text-text-muted">
            Below {formatCedis(PAYOUT_THRESHOLD_PESEWAS)} a reporter&rsquo;s balance rolls into the
            next run rather than being sent, so a small balance does not cost more in fees than it
            carries. The reporter sees this on their phone, so it is never a surprise.
          </p>
        </Panel>

        <Panel title="Where payments went" subtitle="By the network each number was issued on.">
          {byNetwork.length === 0 ? (
            <p className="text-xs text-text-muted">No payment has been sent yet.</p>
          ) : (
            <div className="space-y-3">
              {byNetwork.map((row) => (
                <Bar
                  key={row.network}
                  label={row.network}
                  value={row.count}
                  max={delivered.length}
                  display={`${row.count} ${row.count === 1 ? 'payment' : 'payments'}`}
                  tone={row.network === 'Unknown network' ? 'warn' : 'good'}
                />
              ))}
            </div>
          )}
        </Panel>
      </Split>

      <Note>
        Every figure here is an integer number of pesewas. Rates change; a settled amount does not —
        it is fixed the moment an organisation licenses the report, and recomputing it later would
        mean a reporter&rsquo;s past earnings quietly moved.
      </Note>
    </PageShell>
  );
}
