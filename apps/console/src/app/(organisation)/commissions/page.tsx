import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { roleCan } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { load } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { readOrganisationOffer, readPlatformRates } from '@/lib/commissionRates';
import { OfferForm } from './OfferForm';

/**
 * Offering reporters more for reports sent to this organisation.
 *
 * The platform sets the rate every report earns. An organisation that wants a
 * kind of report badly — a utility after outages, a newsroom after galamsey —
 * can offer more for reports sent directly to it, and the reporter sees the
 * higher figure when they choose it on the phone. It can never offer less than
 * the platform rate.
 */
export default async function Page() {
  /*
   * What this organisation pays reporters, so not merely a menu entry.
   *
   * The sidebar has always hidden this from roles without `view_earnings`, and
   * nothing enforced it — so the link was hidden and the page was served to
   * anyone who typed the URL. An offer set here raises what every directed
   * report costs the organisation, which is not a figure to leave open because
   * the navigation happened to be tidy.
   *
   * Permissive, like `/surveys` and unlike `/earnings` or `/invoices`: those two
   * already rejected roleless accounts before today, whereas this page was wide
   * open, and a roleless institution login *is* the organisation. Making it
   * strict would take away access such an account has today — a regression
   * wearing the clothes of a fix.
   */
  const session = await requireSession();
  if (session.role && !roleCan(session.role, 'view_earnings')) redirect('/');

  const result = await load(async () => {
    const platform = await readPlatformRates();
    const offer = await readOrganisationOffer(platform.rates);
    return { platform, offer };
  });

  return (
    <>
      <PageHeader
        eyebrow="Earnings"
        title="Commission offers"
        description="Pay reporters more than the platform rate for reports sent directly to you."
      />

      {!result.ok ? (
        <OrganisationOutage error={result.error} retryHref="/commissions" />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!result.data.offer.supported ? (
            <div className="mx-4 mt-5 flex items-start gap-3 rounded-md border border-warning/30 bg-warning-wash/40 p-4 sm:mx-7">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
              <p className="min-w-0 text-xs leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Offers cannot be saved yet.</span>{' '}
                The service has no place to keep them, so reporters see the platform rate. You can
                prepare an offer here; saving will say whether it was kept.
              </p>
            </div>
          ) : null}

          <OfferForm platform={result.data.platform.rates} initial={result.data.offer.offer} />
        </div>
      )}
    </>
  );
}
