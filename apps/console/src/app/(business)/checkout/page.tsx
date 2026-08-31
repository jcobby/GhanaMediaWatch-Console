import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  BUSINESSES,
  SUBSCRIPTION_PLANS,
  downloadCharge,
  formatCedis,
  isUnlimited,
  periodCost,
} from '@dawuro/core';
import { Note, PageShell, Panel } from '@/components/admin/Widgets';
import { requireSession } from '@/lib/session';
import { CheckoutPanel } from './CheckoutPanel';

export const metadata = { title: 'Checkout — Dawuro' };

/**
 * Paying an invoice.
 *
 * The summary sits beside the payment panel rather than on a screen before it,
 * because the single most common checkout mistake is paying the wrong amount
 * without ever seeing what it was for.
 */
export default async function Page() {
  const session = await requireSession();

  const business =
    BUSINESSES.find((b) => b.id === (session.businessId ?? 'biz_ama')) ?? BUSINESSES[0]!;
  const plan = SUBSCRIPTION_PLANS[business.tier];
  const downloads = business.reportsUsedThisPeriod;
  const perDownload = downloadCharge(plan);
  const total = periodCost(plan, downloads);

  return (
    <PageShell>
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-xs text-text-muted transition hover:text-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to invoices
      </Link>

      <div>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">Checkout</h1>
        <p className="mt-1 text-sm text-text-muted">
          {business.name} — {plan.billingPeriod} billing
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* ── What you are paying for ───────────────────────────────────── */}
        <Panel title="Summary" subtitle="Every figure is integer pesewas.">
          <dl className="space-y-3">
            <Row
              label={`${business.tier} subscription`}
              detail={`${plan.seats} seats · ${plan.concurrentSurveys} concurrent surveys`}
              value={formatCedis(plan.feePesewas)}
            />
            <Row
              label="Report downloads"
              detail={
                isUnlimited(plan)
                  ? 'Included on this plan'
                  : `${downloads} × ${formatCedis(perDownload)}`
              }
              value={formatCedis(perDownload * downloads)}
            />

            <div className="border-t border-hairline/[0.07] pt-3">
              <Row label="Total due" value={formatCedis(total)} strong />
            </div>
          </dl>

          <p className="mt-4 text-2xs leading-relaxed text-text-faint">
            Charged {plan.billingPeriod === 'annual' ? 'once a year' : 'each month'}. You were shown
            the price of a download before taking each one — nothing here is a charge you have not
            already seen.
          </p>
        </Panel>

        {/* ── How you are paying ────────────────────────────────────────── */}
        <CheckoutPanel amountPesewas={total} />
      </div>

      <Note tone="warn">
        <span className="font-semibold">This checkout is simulated.</span> Nothing entered goes
        anywhere and no payment is taken — the PayDirect integration is backend work that has not
        been built. It exists so the flow can be walked through and corrected before money is real.
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
