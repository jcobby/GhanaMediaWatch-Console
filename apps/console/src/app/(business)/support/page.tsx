import { redirect } from 'next/navigation';
import { roleCan } from '@dawuro/core';
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

/**
 * The desk a reporter reaches when something has gone wrong.
 *
 * Its defining constraint is what it *cannot* do: it can see a case and route
 * it, but never decide it. A support agent who could reverse a verification
 * decision or release a payout would be a way around every gate the platform
 * has, reachable by anyone willing to be persistent on the phone.
 */
const CASES = [
  {
    id: 'SD-002841',
    from: 'Araba Nkrumah',
    about: 'DW-WQD-JW4',
    subject: 'Report rejected — asking why',
    opened: '2 hours ago',
    state: 'open' as const,
    route: 'Editorial',
  },
  {
    id: 'SD-002838',
    from: 'Kwesi Boateng',
    about: '—',
    subject: 'Payout did not arrive on MTN number',
    opened: '5 hours ago',
    state: 'open' as const,
    route: 'Finance',
  },
  {
    id: 'SD-002835',
    from: 'Member of the public',
    about: 'DW-VPR-WCH',
    subject: 'Asks to be removed from footage',
    opened: '1 day ago',
    state: 'routed' as const,
    route: 'Compliance',
  },
  {
    id: 'SD-002830',
    from: 'Adjoa Tetteh',
    about: '—',
    subject: 'Cannot complete GPS lock indoors',
    opened: '2 days ago',
    state: 'answered' as const,
    route: '—',
  },
  {
    id: 'SD-002827',
    from: 'Ama Kufuor',
    about: 'DW-YNG-6JR',
    subject: 'Commission lower than the estimate shown',
    opened: '3 days ago',
    state: 'answered' as const,
    route: '—',
  },
];

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'handle_support')) redirect('/');

  const open = CASES.filter((c) => c.state === 'open');
  const routed = CASES.filter((c) => c.state === 'routed');

  return (
    <PageShell>
      <PageIntro
        title="Support desk"
        blurb="Queries from reporters, and disputes on their way to someone who decides."
      />

      <StatGrid>
        <Stat label="Open" value={String(open.length)} tone={open.length ? 'warn' : 'good'} />
        <Stat label="Routed on" value={String(routed.length)} hint="Waiting on another desk" />
        <Stat label="Answered today" value="2" tone="good" />
        <Stat label="Median first reply" value="3.2h" />
      </StatGrid>

      <Panel title="Cases" subtitle="Routing a case is an action. Deciding it is not.">
        <Table
          columns={['Reference', 'From', 'About', 'Subject', 'Opened', 'State']}
          rows={CASES.map((c) => [
            <code key="i" className="text-xs text-text-primary">
              {c.id}
            </code>,
            <span key="f" className="text-xs text-text-muted">
              {c.from}
            </span>,
            c.about === '—' ? (
              <span key="a" className="text-xs text-text-faint">
                —
              </span>
            ) : (
              <code key="a" className="text-xs text-text-muted">
                {c.about}
              </code>
            ),
            <span key="s" className="text-xs text-text-secondary">
              {c.subject}
            </span>,
            <span key="o" className="whitespace-nowrap text-xs text-text-muted">
              {c.opened}
            </span>,
            c.state === 'open' ? (
              <Pill key="st" tone="warn">
                Open
              </Pill>
            ) : c.state === 'routed' ? (
              <Pill key="st" tone="info">
                With {c.route}
              </Pill>
            ) : (
              <Pill key="st" tone="good">
                Answered
              </Pill>
            ),
          ])}
        />
      </Panel>

      <Panel
        title="Where a case goes"
        subtitle="This desk holds no authority over any of these outcomes."
      >
        <Table
          columns={['If the reporter is asking about', 'It goes to', 'Who decides']}
          rows={[
            ['Why a report was rejected', 'Editorial', 'Verification Editor'],
            ['A payout that has not arrived', 'Finance', 'Finance Officer'],
            ['Removal from footage', 'Compliance', 'Compliance Officer'],
            ['How capture or GPS works', 'Nobody — answer it here', 'Support Desk'],
            ['A commission figure', 'Finance, if it looks wrong', 'Finance Officer'],
          ]}
        />
      </Panel>

      <Note tone="warn">
        <span className="font-semibold">
          This desk can see a case and route it, never decide it.
        </span>{' '}
        An agent who could reverse a verification or release a payment would be a way around every
        gate the platform has, available to whoever is most persistent on the phone.
      </Note>
    </PageShell>
  );
}
