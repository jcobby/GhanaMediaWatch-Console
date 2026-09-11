import type { OrganisationAccount, Incident } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { NotWired, load } from '@/components/ui';
import { org, publicApi } from '@/lib/consoleApi';
import { PublishedWorkspace } from './PublishedWorkspace';

/**
 * What this organisation licensed, and what the public can see of it.
 *
 * The licensed set used to be `SAMPLE_INCIDENTS.slice(0, 4)` — four arbitrary
 * reports labelled as this organisation's paid-for work. Releasing one of those
 * would have published somebody else's footage under this masthead.
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
        description="What you licensed, and what the public can see."
      />
      <NotWired what="Releasing a report publicly, and withholding one" />
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
