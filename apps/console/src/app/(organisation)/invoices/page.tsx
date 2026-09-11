import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { redirect } from 'next/navigation';
import {
  SUBSCRIPTION_PLANS,
  annualCost,
  breakEvenDownloads,
  downloadCharge,
  formatCedis,
  isUnlimited,
  periodCost,
  roleCan,
  type OrganisationAccount,
} from '@dawuro/core';
import {
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
import { org } from '@/lib/consoleApi';

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'view_invoices')) redirect('/');

  /*
   * This organisation, from the server.
   *
   * The fallback chain this replaces ended at `ORGANISATIONS[0]`, so an operator
   * whose account did not resolve was shown another organisation's billing —
   * its tier, its usage and the cost of both — as if it were their own.
   */
  const result = await load(() => org.current<OrganisationAccount>());
  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro title="Invoices" blurb="What this organisation is billed, and why." />
        <OrganisationOutage error={result.error} retryHref="/invoices" />
      </PageShell>
    );
  }
  const organisation = result.data;
  const plan = SUBSCRIPTION_PLANS[organisation.tier];
  const enterprise = SUBSCRIPTION_PLANS.enterprise;

  const downloads = organisation.reportsUsedThisPeriod;
  const thisPeriod = periodCost(plan, downloads);
  const perDownload = downloadCharge(plan);
  const breakEven = breakEvenDownloads(plan, enterprise);
  const annualHere = annualCost(plan, downloads * 12);
  const annualUnlimited = annualCost(enterprise, 0);

  return (
    <PageShell>
      <PageIntro
        title="Invoices"
        blurb={`What ${organisation.name} has been billed, and for what.`}
      />

      <StatGrid>
        <Stat label="This period" value={formatCedis(thisPeriod)} />
        <Stat label="Downloads" value={String(downloads)} hint={`${plan.billingPeriod} billing`} />
        <Stat
          label="Next download costs"
          value={isUnlimited(plan) ? 'Included' : formatCedis(perDownload)}
          tone={isUnlimited(plan) ? 'good' : 'neutral'}
        />
        <Stat label="Seats" value={`${organisation.seatsUsed} / ${plan.seats}`} />
      </StatGrid>

      <Panel
        title="This period"
        subtitle="Itemised, in integer pesewas throughout."
        action={
          <Link
            href="/checkout"
            className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3.5 py-2 text-xs font-medium text-text-on-dark transition hover:opacity-90"
          >
            Pay {formatCedis(thisPeriod)}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        }
      >
        <Table
          empty="No invoices yet. The first arrives at the end of your first billing period."
          columns={['Line', 'Quantity', 'Unit', 'Amount']}
          rows={[
            [
              <span key="l" className="font-medium text-text-primary">
                {organisation.tier} subscription
              </span>,
              <span key="q" className="tabular text-text-muted">
                1
              </span>,
              <span key="u" className="tabular text-text-muted">
                {formatCedis(plan.feePesewas)}
              </span>,
              <span key="a" className="tabular">
                {formatCedis(plan.feePesewas)}
              </span>,
            ],
            [
              <span key="l" className="font-medium text-text-primary">
                Report downloads
              </span>,
              <span key="q" className="tabular text-text-muted">
                {downloads}
              </span>,
              <span key="u" className="tabular text-text-muted">
                {isUnlimited(plan) ? 'included' : formatCedis(perDownload)}
              </span>,
              <span key="a" className="tabular">
                {formatCedis(perDownload * downloads)}
              </span>,
            ],
            [
              <span key="l" className="font-semibold text-text-primary">
                Total
              </span>,
              '',
              '',
              <span key="a" className="tabular font-semibold">
                {formatCedis(thisPeriod)}
              </span>,
            ],
          ]}
          align={[1, 2, 3]}
        />
      </Panel>

      <Split>
        <Panel title="Your plan" subtitle="What it includes.">
          <Table
            columns={['', '']}
            rows={[
              [
                'Tier',
                <Pill key="t" tone="info">
                  {plan.tier}
                </Pill>,
              ],
              ['Billing', plan.billingPeriod],
              ['Fee', formatCedis(plan.feePesewas)],
              ['Per download', isUnlimited(plan) ? 'Unlimited' : formatCedis(perDownload)],
              ['Seats', String(plan.seats)],
              ['Concurrent surveys', String(plan.concurrentSurveys)],
              ['Direct requests', plan.canDirectRequest ? 'Yes' : 'No'],
            ]}
          />
        </Panel>

        <Panel title="Would unlimited be cheaper?" subtitle="Arithmetic, not a sales claim.">
          {breakEven === null ? (
            <p className="text-sm text-text-muted">
              You are already on the unlimited tier — downloads carry no per-item charge.
            </p>
          ) : (
            <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
              <p>
                At your current rate you would pay{' '}
                <span className="tabular font-medium text-text-primary">
                  {formatCedis(annualHere)}
                </span>{' '}
                over a year. Enterprise costs{' '}
                <span className="tabular font-medium text-text-primary">
                  {formatCedis(annualUnlimited)}
                </span>{' '}
                whatever you download.
              </p>
              <p>
                The two meet at{' '}
                <span className="tabular font-medium text-text-primary">{breakEven}</span> downloads
                a year — about {Math.ceil(breakEven / 12)} a month. You are currently taking{' '}
                <span className="tabular font-medium text-text-primary">{downloads}</span>.
              </p>
              <p
                className={
                  downloads * 12 > breakEven ? 'font-medium text-warning' : 'text-text-muted'
                }
              >
                {downloads * 12 > breakEven
                  ? 'At this rate, enterprise would cost you less.'
                  : 'At this rate, your current plan is the cheaper one.'}
              </p>
            </div>
          )}
        </Panel>
      </Split>

      <Note>
        The price of one more download belongs on the download button, not on next month&rsquo;s
        invoice. Nothing in this console charges an organisation for something it was not shown the
        price of first.
      </Note>
    </PageShell>
  );
}
