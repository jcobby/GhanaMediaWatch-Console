import type { Branch, OrganisationAccount, Employee } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { platform, org } from '@/lib/consoleApi';
import { RoutingDesk } from './RoutingDesk';

/**
 * Oversight of automatic routing.
 *
 * Everything in the queue has already been matched. This is where a person
 * checks that the match was right and changes it when it was not — so the
 * queue, the organisations it can be redirected to, and the people who would
 * receive it all have to be the real ones.
 */
export default async function RoutingPage() {
  const result = await load(async () => {
    const queue = await platform.routing();

    /*
     * The override targets, fetched alongside.
     *
     * Each is allowed to be missing on its own: an operator can still confirm
     * a match with an incomplete list of branches, and losing the whole desk
     * because one supporting call failed would be a worse outcome than a
     * shorter dropdown. The queue itself is not optional — without it there is
     * nothing to work on, so its failure takes the page.
     */
    const [organisations, employees, branches] = await Promise.all([
      platform.organisations<OrganisationAccount>().catch(() => [] as OrganisationAccount[]),
      org.employees<Employee>().catch(() => [] as Employee[]),
      org.branches<Branch>().catch(() => [] as Branch[]),
    ]);

    return {
      queue: queue.filter((item) => item.status !== 'rejected'),
      organisations,
      employees,
      branches,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Routing desk"
        description="Reports are matched automatically. Confirm the match, or override it."
      />
      {result.ok ? (
        <RoutingDesk
          queue={result.data.queue}
          organisations={result.data.organisations}
          employees={result.data.employees}
          branches={result.data.branches}
        />
      ) : (
        <Outage error={result.error} retryHref="/platform/routing" />
      )}
    </>
  );
}
