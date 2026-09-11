import type { OrganisationAccount, Employee } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { platform, org } from '@/lib/consoleApi';
import { OrganisationsWorkspace } from './OrganisationsWorkspace';

/**
 * Everyone licensing footage.
 *
 * Read from the backend, never from fixtures. This page decides who an operator
 * believes is on the platform and what they are paying — seeded data here would
 * show an organisation that does not exist, or hide one that does.
 */
export default async function Page() {
  const result = await load(async () => ({
    organisations: await platform.organisations<OrganisationAccount>(),
    // Staff counts come from the same call the team page uses; an operator
    // reading this list is asking "who can act on this account".
    employees: await org.employees<Employee>().catch(() => [] as Employee[]),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Organisations"
        description="Everyone licensing footage, what they pay, and who can act on it."
      />
      {result.ok ? (
        <OrganisationsWorkspace
          organisations={result.data.organisations}
          employees={result.data.employees}
        />
      ) : (
        <Outage error={result.error} retryHref="/platform/organisations" />
      )}
    </>
  );
}
