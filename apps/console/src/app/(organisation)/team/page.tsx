import { redirect } from 'next/navigation';
import {
  roleCan,
  type Branch,
  type OrganisationAccount,
  type Employee,
  type MembershipRequest,
  type OrgAffiliation,
  type Invite,
} from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { load } from '@/components/ui';
import { org, platform } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';
import { TeamWorkspace } from './TeamWorkspace';

/**
 * Who can act on this organisation's account.
 *
 * Every list is scoped by the server to the caller's own organisation, so the
 * `employeesOf(organisation.id)` filters this replaces are gone — along with the
 * chance of listing another organisation's staff if an id ever mismatched.
 */
export default async function Page() {
  /*
   * `manage_staff`, because this page is not a roster — it is the door.
   *
   * It lists employees and branches, but it also accepts membership requests and
   * issues invites, and an invite is how somebody gets inside the organisation at
   * all. Anyone who can work this screen can decide who else may read citizens'
   * footage, which is a strictly larger power than reading it.
   *
   * Only enforced when the account has a role: see the note on the inbox page.
   */
  const session = await requireSession();
  if (session.role && !roleCan(session.role, 'manage_staff')) redirect('/');

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
