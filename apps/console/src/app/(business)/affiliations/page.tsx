import { redirect } from 'next/navigation';
import { BUSINESSES, INVITES, ORG_AFFILIATIONS, roleCan } from '@dawuro/core';
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
import { requireSession } from '@/lib/session';

const nameOf = (id: string) => BUSINESSES.find((b) => b.id === id)?.name ?? id;

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'manage_affiliations')) redirect('/');

  const me = session.businessId ?? 'biz_ama';
  const outgoing = ORG_AFFILIATIONS.filter((a) => a.parentBusinessId === me);
  const incoming = ORG_AFFILIATIONS.filter((a) => a.affiliateBusinessId === me);
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
