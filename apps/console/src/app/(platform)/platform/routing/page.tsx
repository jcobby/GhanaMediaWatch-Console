import { BRANCHES, BUSINESSES, EMPLOYEES, ROUTING_QUEUE } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { RoutingDesk } from './RoutingDesk';

/**
 * Oversight of automatic routing.
 *
 * Everything in the queue has already been matched. This is where a person
 * checks that the match was right and changes it when it was not.
 */
export default async function RoutingPage() {
  const queue = ROUTING_QUEUE.filter((item) => item.status !== 'rejected');

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Routing desk"
        description="Reports are matched automatically. Confirm the match, or override it."
      />
      <RoutingDesk
        queue={queue}
        businesses={BUSINESSES}
        employees={EMPLOYEES}
        branches={BRANCHES}
      />
    </>
  );
}
