import type { Incident } from '@dawuro/core';
import { load } from '@/components/ui';
import { org } from '@/lib/consoleApi';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { MapWorkspace } from './MapWorkspace';

/**
 * Where reports are concentrated.
 *
 * Drawn from this organisation's own routed inbox, which is the only set it is
 * entitled to analyse. A map is read as evidence — somebody points at a cluster
 * in a meeting and decides where to send a crew — so plotting seeded incidents
 * here would put invented geography behind a real decision.
 */
export default async function Page() {
  const result = await load(() => org.inbox<Incident>());

  return (
    <>
      <PageHeader
        eyebrow="Analysis"
        title="Map and trends"
        description="Where reports are concentrated, and whether it is getting worse."
      />
      {result.ok ? (
        <MapWorkspace reports={result.data} />
      ) : (
        <OrganisationOutage error={result.error} retryHref="/map" />
      )}
    </>
  );
}
