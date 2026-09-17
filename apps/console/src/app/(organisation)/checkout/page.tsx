import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Check, Clock } from 'lucide-react';
import { formatCedis, type OrganisationAccount } from '@dawuro/core';
import { Note, PageShell, Panel } from '@/components/admin/Widgets';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { requireSession } from '@/lib/session';
import { load } from '@/components/ui';
import { org } from '@/lib/consoleApi';
import { INVOICE_STATUS_COPY, normaliseInvoice } from '@/lib/invoices';
import { CheckoutPanel } from './CheckoutPanel';

export const metadata = { title: 'Checkout — Dawuro' };

/**
 * Paying one invoice.
 *
 * The invoice is read from the service, so the amount on the button is the
 * amount the service will charge — not a figure this page worked out from the
 * plan table. Payment happens on PayDirect's page; when it sends the payer back
 * here, the invoice is read again and its status is the answer.
 *
 * The summary sits beside the payment panel, because the most common checkout
 * mistake is paying without ever seeing what it was for.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; returned?: string }>;
}) {
  await requireSession();
  const { invoice: invoiceId, returned } = await searchParams;

  const back = (
    <Link
      href="/invoices"
      className="inline-flex items-center gap-1.5 text-xs text-text-muted transition hover:text-accent"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
      Back to invoices
    </Link>
  );

  if (!invoiceId) {
    return (
      <PageShell>
        {back}
        <Panel title="Choose an invoice" subtitle="Payment is always for a specific invoice.">
          <p className="text-sm text-text-muted">
            Open your invoices and press Pay beside the one you want to settle.
          </p>
        </Panel>
      </PageShell>
    );
  }

  const found = await load(async () => {
    const [organisation, invoice] = await Promise.all([
      org.current<OrganisationAccount>(),
      org.invoice<unknown>(invoiceId),
    ]);
    return { organisation, invoice: normaliseInvoice(invoice) };
  });

  if (!found.ok) {
    return (
      <PageShell>
        {back}
        <OrganisationOutage
          error={found.error}
          retryHref={`/checkout?invoice=${encodeURIComponent(invoiceId)}` as Route}
        />
      </PageShell>
    );
  }

  const { organisation, invoice } = found.data;
  const status = INVOICE_STATUS_COPY[invoice.overdue ? 'overdue' : invoice.status];

  return (
    <PageShell>
      {back}

      <div>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">Checkout</h1>
        <p className="mt-1 text-sm text-text-muted">
          {organisation.name} — invoice <span className="font-mono">{invoice.id}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* ── What you are paying for ───────────────────────────────────── */}
        <Panel title="Summary" subtitle={`${status.label}${invoice.dueAtIso ? ` · due ${new Date(invoice.dueAtIso).toLocaleDateString('en-GB')}` : ''}`}>
          <dl className="space-y-3">
            {invoice.lines.length === 0 ? (
              <p className="text-xs text-text-muted">This invoice lists no separate lines.</p>
            ) : (
              invoice.lines.map((line, index) => (
                <Row
                  key={`${line.label}-${index}`}
                  label={line.label}
                  detail={
                    line.quantity !== null && line.unitPesewas !== null
                      ? `${line.quantity} × ${formatCedis(line.unitPesewas)}`
                      : undefined
                  }
                  value={line.amountPesewas !== null ? formatCedis(line.amountPesewas) : '—'}
                />
              ))
            )}

            <div className="border-t border-hairline/[0.07] pt-3">
              <Row
                label={invoice.status === 'paid' ? 'Total paid' : 'Total due'}
                value={formatCedis(invoice.totalPesewas)}
                strong
              />
            </div>
          </dl>
        </Panel>

        {/* ── Paying it ─────────────────────────────────────────────────── */}
        {invoice.status === 'paid' ? (
          <div className="rounded-lg border border-hairline/12 bg-canvas-soft p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill bg-success-wash">
              <Check className="h-7 w-7 text-success" strokeWidth={2.5} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-text-primary">Paid</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">
              {formatCedis(invoice.totalPesewas)}
              {invoice.paidAtIso
                ? ` received on ${new Date(invoice.paidAtIso).toLocaleDateString('en-GB')}.`
                : ' received.'}
            </p>
            {invoice.receiptUrl ? (
              <a
                href={invoice.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-2"
              >
                Open the receipt
              </a>
            ) : null}
          </div>
        ) : invoice.payable ? (
          <div className="space-y-3">
            {/* Back from PayDirect, but the service has not confirmed it yet. */}
            {returned ? (
              <p className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-wash/40 px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                We have not received confirmation of this payment yet. If you completed it, it can
                take a few minutes to show — reload this page. If you did not, you can pay below.
              </p>
            ) : null}
            <CheckoutPanel invoiceId={invoice.id} amountPesewas={invoice.totalPesewas} />
          </div>
        ) : (
          <Panel title="This invoice cannot be paid" subtitle={status.label}>
            <p className="text-sm text-text-muted">
              Only an issued, unpaid invoice can be paid. If you think this is wrong, contact
              support with the invoice number.
            </p>
          </Panel>
        )}
      </div>

      <Note>
        You pay on PayDirect&rsquo;s own page. Dawuro never sees your card, wallet or bank details.
      </Note>
    </PageShell>
  );
}

function Row({
  label,
  detail,
  value,
  strong,
}: {
  label: string;
  detail?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <dt
          className={
            strong ? 'text-sm font-semibold text-text-primary' : 'text-sm text-text-primary'
          }
        >
          {label}
        </dt>
        {detail ? <p className="mt-0.5 text-2xs text-text-muted">{detail}</p> : null}
      </div>
      <dd
        className={
          strong
            ? 'tabular shrink-0 text-base font-semibold text-text-primary'
            : 'tabular shrink-0 text-sm text-text-secondary'
        }
      >
        {value}
      </dd>
    </div>
  );
}
