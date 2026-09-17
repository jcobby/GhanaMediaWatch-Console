import type { OrganisationAccount, Incident } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { load } from '@/components/ui';
import { org, publicApi } from '@/lib/consoleApi';
import { PublishedWorkspace } from './PublishedWorkspace';

/**
 * What this organisation licensed, and what the public can see of it.
 *
 * The licensed set used to be `SAMPLE_INCIDENTS.slice(0, 4)` — four arbitrary
 * reports labelled as this organisation's paid-for work. Releasing one of those
 * would have published somebody else's footage under this masthead.
 *
 * **Deliberately not capability-gated**, unlike the inbox, the map, surveys and
 * the team. Every row here is already on the public feed: the list is read from
 * the public record, by publisher id. There is nothing on this screen that a
 * member of the organisation could not see by opening the app.
 *
 * The one real power here is withdrawal, and that is guarded where it happens —
 * `POST /api/org/incidents/{id}/unpublish` checks the session itself, because an
 * endpoint is reachable directly and a page gate was never a boundary for it.
 * If withdrawal should be narrowed to particular roles, narrow it there and in
 * the button, rather than hiding the public record from staff.
 */
export default async function Page() {
  const result = await load(async () => {
    const organisation = await org.current<OrganisationAccount>();
    return {
      organisation,
      // Credited to this organisation — the public record of what it released.
      licensed: await publicApi.incidents<Incident>(
        `?publisherId=${encodeURIComponent(organisation.id)}`,
      ),
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Published"
        title="Released reports"
        description="What the public can see under your name, and withdrawing it."
      />
      {result.ok ? (
        <PublishedWorkspace
          licensed={result.data.licensed}
          organisation={result.data.organisation}
        />
      ) : (
        <OrganisationOutage error={result.error} retryHref="/published" />
      )}
    </>
  );
}
