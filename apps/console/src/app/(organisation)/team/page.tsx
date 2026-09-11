import type {
  Branch,
  OrganisationAccount,
  Employee,
  MembershipRequest,
  OrgAffiliation,
  Invite,
} from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { NotWired, load } from '@/components/ui';
import { org, platform } from '@/lib/consoleApi';
import { TeamWorkspace } from './TeamWorkspace';

/**
 * Who can act on this organisation's account.
 *
 * Every list is scoped by the server to the caller's own organisation, so the
 * `employeesOf(organisation.id)` filters this replaces are gone — along with the
 * chance of listing another organisation's staff if an id ever mismatched.
 */
export default async function Page() {
  const result = await load(async () => {
    const organisation = await org.current<OrganisationAccount>();
    const [employees, branches, requests, invites, affiliations, organisations] = await Promise.all(
      [
        org.employees<Employee>(),
        org.branches<Branch>(),
        org.membershipRequests<MembershipRequest>(),
        org.invites<Invite>(),
        org.affiliations<OrgAffiliation>(),
        // Only for naming an affiliated organisation in the list. An operator who
        // cannot read the directory still gets their own team.
        platform.organisations<OrganisationAccount>().catch(() => [] as OrganisationAccount[]),
      ],
    );
    return { organisation, employees, branches, requests, invites, affiliations, organisations };
  });

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="People"
        description={
          !result.ok
            ? 'Your team could not be read.'
            : result.data.requests.length > 0
              ? `${result.data.employees.length} staff · ${result.data.requests.length} waiting to be accepted`
              : `${result.data.employees.length} staff across ${result.data.branches.length} branches`
        }
      />
      <NotWired what="Accepting or declining someone into your team" />
      {result.ok ? (
        <TeamWorkspace
          employees={result.data.employees}
          branches={result.data.branches}
          requests={result.data.requests}
          invites={result.data.invites}
          affiliations={result.data.affiliations}
          organisations={result.data.organisations}
          businessId={result.data.organisation.id}
        />
      ) : (
        <OrganisationOutage error={result.error} retryHref="/team" />
      )}
    </>
  );
}
