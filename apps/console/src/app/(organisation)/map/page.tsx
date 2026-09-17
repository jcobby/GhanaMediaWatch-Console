import { redirect } from 'next/navigation';
import { roleCan, type Incident } from '@dawuro/core';
import { load } from '@/components/ui';
import { org } from '@/lib/consoleApi';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { requireSession } from '@/lib/session';
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
  /*
   * `view_inbox`, because this page *is* the inbox.
   *
   * It reads `org.inbox` and plots it. Gating the queue and leaving its own map
   * open would hand the same reports to the same person through a different
   * door — and in aggregate, which is arguably the more revealing view. The two
   * must always carry the same capability; if one moves, move both.
   *
   * Only enforced when the account has a role: see the note on the inbox page.
   */
  const session = await requireSession();
  if (session.role && !roleCan(session.role, 'view_inbox')) redirect('/');

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
