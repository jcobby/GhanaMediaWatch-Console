import { AlertTriangle, Info } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { readPlatformRates } from '@/lib/commissionRates';
import { CommissionRatesForm } from './CommissionRatesForm';

/**
 * What a reporter earns, set by the platform.
 *
 * The figure a reporter sees before sending a report — "You could earn ₵17.50" —
 * is worked out from these rates: a rate per category, extras for video, audio
 * and exclusive reports, a reduction for a low-accuracy location, and the
 * platform's share. They used to be numbers compiled into the app.
 *
 * Organisations may offer more than these rates for reports sent directly to
 * them, on their own Commission offers page. They can never offer less.
 */
export default async function Page() {
  const result = await load(() => readPlatformRates());

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Commission rates"
        description="What a reporter earns for each kind of report, and the platform's share."
      />

      {!result.ok ? (
        <Outage error={result.error} retryHref="/platform/commissions" />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {result.data.stored ? (
            <div className="mx-4 mt-5 flex items-start gap-3 rounded-md border border-info/25 bg-info-wash/40 p-4 sm:mx-7">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={2} />
              <p className="min-w-0 text-xs leading-relaxed text-text-muted">
                <span className="font-semibold text-text-primary">Sent to every phone.</span> A change
                reaches the estimate reporters see within five minutes. It does not change what was
                already earned: a commission is fixed when a report is licensed.
              </p>
            </div>
          ) : (
            <div className="mx-4 mt-5 flex items-start gap-3 rounded-md border border-warning/30 bg-warning-wash/40 p-4 sm:mx-7">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
              <p className="min-w-0 text-xs leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">The service is not storing rates yet.</span>{' '}
                These are the built-in rates every phone uses. You can save changes, and this page
                will tell you whether the service kept them.
              </p>
            </div>
          )}

          <CommissionRatesForm initial={result.data.rates} />
        </div>
      )}
    </>
  );
}
