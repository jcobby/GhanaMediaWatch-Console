import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight } from 'lucide-react';
import { redirect } from 'next/navigation';
import {
  SUBSCRIPTION_PLANS,
  annualCost,
  breakEvenDownloads,
  downloadCharge,
  formatCedis,
  isUnlimited,
  planFor,
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
import { INVOICE_STATUS_COPY, normaliseInvoice } from '@/lib/invoices';

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB') : '—');

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'view_invoices')) redirect('/');

  /*
   * This organisation and its invoices, from the server.
   *
   * The fallback chain this replaced ended at `ORGANISATIONS[0]`, so an operator
   * whose account did not resolve was shown another organisation's billing.
   */
  const result = await load(async () => {
    const [organisation, invoices] = await Promise.all([
      org.current<OrganisationAccount>(),
      org.invoices<unknown>(),
    ]);
    return { organisation, invoices: invoices.map((invoice) => normaliseInvoice(invoice)) };
  });

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro title="Invoices" blurb="What this organisation is billed, and why." />
        <OrganisationOutage error={result.error} retryHref="/invoices" />
      </PageShell>
    );
  }

  const { organisation, invoices } = result.data;
  const outstanding = invoices.filter((i) => i.payable);
  const outstandingPesewas = outstanding.reduce((total, i) => total + i.totalPesewas, 0);
  const overdue = invoices.filter((i) => i.overdue).length;

  // See the checkout page: the index is typed as total and is not.
  const plan = planFor(organisation.tier);
  const enterprise = SUBSCRIPTION_PLANS.enterprise;
  const downloads = organisation.reportsUsedThisPeriod;

  return (
    <PageShell>
      <PageIntro
        title="Invoices"
        blurb={`What ${organisation.name} has been billed, and paying it.`}
      />

      <StatGrid>
        <Stat
          label="Outstanding"
          value={formatCedis(outstandingPesewas)}
          tone={outstandingPesewas > 0 ? 'warn' : 'good'}
          hint={`${outstanding.length} ${outstanding.length === 1 ? 'invoice' : 'invoices'}`}
        />
        <Stat label="Overdue" value={String(overdue)} tone={overdue > 0 ? 'bad' : 'neutral'} />
        <Stat
          label="This period so far"
          value={plan ? formatCedis(periodCost(plan, downloads)) : '—'}
          hint="An estimate until invoiced"
        />
        <Stat
          label="Seats"
          value={plan ? `${organisation.seatsUsed} / ${plan.seats}` : String(organisation.seatsUsed)}
        />
      </StatGrid>

      <Panel title="Invoices" subtitle="Issued by Dawuro. Paid on PayDirect's own page.">
        <Table
          empty="No invoices yet. The first arrives at the end of your first billing period."
          columns={['Invoice', 'Status', 'Due', 'Paid', 'Amount', '']}
          rows={invoices.map((invoice) => {
            const copy = INVOICE_STATUS_COPY[invoice.overdue ? 'overdue' : invoice.status];
            return [
              <code key="i" className="text-xs text-text-primary">
                {invoice.id}
              </code>,
              <Pill key="s" tone={copy.tone}>
                {copy.label}
              </Pill>,
              <span key="d" className="text-xs text-text-muted">
                {date(invoice.dueAtIso)}
              </span>,
              <span key="p" className="text-xs text-text-muted">
                {date(invoice.paidAtIso)}
              </span>,
              <span key="a" className="tabular font-medium">
                {formatCedis(invoice.totalPesewas)}
              </span>,
              invoice.payable ? (
                <Link
                  key="x"
                  href={`/checkout?invoice=${encodeURIComponent(invoice.id)}` as Route}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-text-on-dark transition hover:opacity-90"
                >
                  Pay <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </Link>
              ) : invoice.receiptUrl ? (
                <a
                  key="x"
                  href={invoice.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent underline underline-offset-2"
                >
                  Receipt
                </a>
              ) : (
                <span key="x" />
              ),
            ];
          })}
          align={[4, 5]}
        />
      </Panel>

      {plan ? (
        <Split>
          <Panel title="This period so far" subtitle="A running estimate, not an invoice.">
            <Table
              columns={['Line', 'Quantity', 'Amount']}
              rows={[
                [
                  <span key="l" className="font-medium text-text-primary">
                    {organisation.tier} subscription
                  </span>,
                  <span key="q" className="tabular text-text-muted">
                    1
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
                  <span key="a" className="tabular">
                    {isUnlimited(plan)
                      ? 'Included'
                      : formatCedis((downloadCharge(plan) ?? 0) * downloads)}
                  </span>,
                ],
              ]}
              align={[1, 2]}
            />
          </Panel>

          <Panel title="Would unlimited be cheaper?" subtitle="Arithmetic, not a sales claim.">
            {(() => {
              const breakEven = breakEvenDownloads(plan, enterprise);
              if (breakEven === null) {
                return (
                  <p className="text-sm text-text-muted">
                    You are already on the unlimited tier — downloads carry no per-item charge.
                  </p>
                );
              }
              return (
                <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
                  <p>
                    At your current rate you would pay{' '}
                    <span className="tabular font-medium text-text-primary">
                      {formatCedis(annualCost(plan, downloads * 12))}
                    </span>{' '}
                    over a year. Enterprise costs{' '}
                    <span className="tabular font-medium text-text-primary">
                      {formatCedis(annualCost(enterprise, 0))}
                    </span>{' '}
                    whatever you download.
                  </p>
                  <p>
                    The two meet at{' '}
                    <span className="tabular font-medium text-text-primary">{breakEven}</span>{' '}
                    downloads a year — about {Math.ceil(breakEven / 12)} a month. You are currently
                    taking <span className="tabular font-medium text-text-primary">{downloads}</span>.
                  </p>
                </div>
              );
            })()}
          </Panel>
        </Split>
      ) : (
        <Note tone="warn">
          Your plan could not be read, so this period&rsquo;s running estimate is not shown. Issued
          invoices above are unaffected.
        </Note>
      )}

      <Note>
        The price of one more download belongs on the download button, not on next month&rsquo;s
        invoice. Nothing in this console charges an organisation for something it was not shown the
        price of first.
      </Note>
    </PageShell>
  );
}
