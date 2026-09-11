import { redirect } from 'next/navigation';
import { roleCan, type OrganisationAccount, type OrgAffiliation, type Invite } from '@dawuro/core';
import {
  Note,
  PageIntro,
  PageShell,
  Panel,
  Pill,
  Stat,
  StatGrid,
  Table,
} from '@/components/admin/Widgets';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { requireSession } from '@/lib/session';
import { load } from '@/components/ui';
import { org, platform } from '@/lib/consoleApi';

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'manage_affiliations')) redirect('/');

  /*
   * Who this organisation shares reports with, both directions.
   *
   * `me` used to default to the literal `'biz_ama'`, so an operator whose
   * session carried no organisation id was shown the Accra Metropolitan Assembly's
   * affiliations — and offered the buttons to revoke them.
   */
  const result = await load(async () => {
    const organisation = await org.current<OrganisationAccount>();
    const affiliations = await org.affiliations<OrgAffiliation>();
    const [invites, directory] = await Promise.all([
      org.invites<Invite>().catch(() => [] as Invite[]),
      platform.organisations<OrganisationAccount>().catch(() => [] as OrganisationAccount[]),
    ]);
    return { me: organisation.id, affiliations, invites, directory };
  });

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Affiliations"
          blurb="What another organisation has granted you, and what you have granted."
        />
        <OrganisationOutage error={result.error} retryHref="/affiliations" />
      </PageShell>
    );
  }

  const { me, affiliations, invites: INVITES, directory } = result.data;
  // An organisation the directory does not name shows its id rather than a
  // borrowed name.
  const nameOf = (id: string) => directory.find((b) => b.id === id)?.name ?? id;
  const outgoing = affiliations.filter((a) => a.parentBusinessId === me);
  const incoming = affiliations.filter((a) => a.affiliateBusinessId === me);
  const sharing = [...outgoing, ...incoming].filter((a) => a.sharesReports);

  return (
    <PageShell>
      <PageIntro
        title="Affiliations"
        blurb="What another organisation has granted you, and what you have granted."
      />

      <StatGrid>
        <Stat label="You invited" value={String(outgoing.length)} hint="Organisations under you" />
        <Stat label="You accepted" value={String(incoming.length)} hint="Organisations above you" />
        <Stat
          label="Sharing reports"
          value={String(sharing.length)}
          tone={sharing.length ? 'warn' : 'neutral'}
          hint="Not the default"
        />
        <Stat label="Invite links" value={String(INVITES.filter((i) => !i.revokedAtIso).length)} />
      </StatGrid>

      <Panel
        title="Outgoing"
        subtitle="Organisations you invited. Direction matters — it decides who can see whom."
      >
        <Table
          columns={['Organisation', 'Kind', 'Reports shared', 'Since']}
          rows={
            outgoing.length
              ? outgoing.map((a) => [
                  <span key="n" className="font-medium text-text-primary">
                    {nameOf(a.affiliateBusinessId)}
                  </span>,
                  <Pill key="k" tone="info">
                    {a.kind.replace(/_/g, ' ')}
                  </Pill>,
                  a.sharesReports ? (
                    <Pill key="s" tone="warn">
                      Yes — you can read their inbox
                    </Pill>
                  ) : (
                    <Pill key="s">No</Pill>
                  ),
                  <span key="d" className="text-xs text-text-muted">
                    {new Date(a.createdAtIso).toLocaleDateString('en-GB')}
                  </span>,
                ])
              : []
          }
        />
      </Panel>

      <Panel title="Incoming" subtitle="Organisations that invited you, and what they can see.">
        <Table
          columns={['Organisation', 'Kind', 'Reports shared', 'Since']}
          rows={
            incoming.length
              ? incoming.map((a) => [
                  <span key="n" className="font-medium text-text-primary">
                    {nameOf(a.parentBusinessId)}
                  </span>,
                  <Pill key="k" tone="info">
                    {a.kind.replace(/_/g, ' ')}
                  </Pill>,
                  a.sharesReports ? (
                    <Pill key="s" tone="bad">
                      Yes — they can read your inbox
                    </Pill>
                  ) : (
                    <Pill key="s">No</Pill>
                  ),
                  <span key="d" className="text-xs text-text-muted">
                    {new Date(a.createdAtIso).toLocaleDateString('en-GB')}
                  </span>,
                ])
              : []
          }
        />
      </Panel>

      <Note tone="warn">
        <span className="font-semibold">Sharing reports is off by default and stated plainly.</span>{' '}
        A parent that can read its affiliate&rsquo;s inbox is a very different arrangement from one
        that merely shares a logo, and nobody should discover which one they agreed to after the
        fact.
      </Note>

      <Note>
        Affiliation is directional and can never form a cycle — an organisation cannot become its
        own ancestor. So whatever reaches you through one of these links is always traceable back to
        a decision a person made.
      </Note>
    </PageShell>
  );
}
