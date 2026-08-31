import {
  branchesOf,
  employeesOf,
  pendingMembershipsOf,
  invitesOf,
  BUSINESSES,
  ORG_AFFILIATIONS,
} from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { TeamWorkspace } from './TeamWorkspace';

export default async function Page() {
  const session = await requireSession();
  const business = BUSINESSES.find((b) => b.id === session.businessId) ?? BUSINESSES[1]!;

  const employees = employeesOf(business.id);
  const branches = branchesOf(business.id);
  const requests = pendingMembershipsOf(business.id);
  const invites = invitesOf(business.id);

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="People"
        description={
          requests.length > 0
            ? `${employees.length} staff · ${requests.length} waiting to be accepted`
            : `${employees.length} staff across ${branches.length} branches`
        }
      />
      <TeamWorkspace
        employees={employees}
        branches={branches}
        requests={requests}
        invites={invites}
        affiliations={ORG_AFFILIATIONS}
        businesses={BUSINESSES}
        businessId={business.id}
      />
    </>
  );
}
