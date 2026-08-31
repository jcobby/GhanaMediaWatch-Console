import { redirect } from 'next/navigation';
import {
  ACK_TARGET_HOURS,
  RESPONSE_META,
  SEVERITY_META,
  roleCan,
  slaState,
  type ResponseAction,
} from '@dawuro/core';
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

const NOW = new Date('2026-08-28T09:00:00.000Z');
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();

const MINE = [
  {
    ref: 'DW-VPR-WCH',
    what: 'Burst main flooding Kaneshie market road',
    where: 'Kaneshie, Accra',
    severity: 'emergency' as const,
    submitted: 2.3,
    ack: null,
  },
  {
    ref: 'DW-DC9-VKM',
    what: 'Collapsed culvert, road impassable',
    where: 'Achimota',
    severity: 'urgent' as const,
    submitted: 3.6,
    ack: null,
  },
  {
    ref: 'DW-TKM-2QP',
    what: 'Refuse uncollected for eleven days',
    where: 'Nima',
    severity: 'concern' as const,
    submitted: 20,
    ack: 2,
  },
  {
    ref: 'DW-RJH-9CF',
    what: 'Blocked storm drain on the high street',
    where: 'Osu',
    severity: 'concern' as const,
    submitted: 30,
    ack: 4,
  },
];

const ORDER: ResponseAction[] = [
  'acknowledged',
  'more_info_requested',
  'inspecting',
  'referred',
  'resolved',
  'closed_no_action',
];

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'record_response')) redirect('/');

  const rows = MINE.map((m) => ({
    ...m,
    sla: slaState(
      m.severity,
      at(m.submitted),
      m.ack === null ? null : at(m.submitted - m.ack),
      NOW.toISOString(),
    ),
  }));

  const unacknowledged = rows.filter((r) => r.ack === null);
  const breaching = rows.filter((r) => r.sla.status === 'breached' && r.ack === null);

  return (
    <PageShell>
      <PageIntro
        title="Assignments"
        blurb="What has been sent to you, and the clock running against each one."
      />

      <StatGrid>
        <Stat label="Assigned to you" value={String(rows.length)} />
        <Stat
          label="Not acknowledged"
          value={String(unacknowledged.length)}
          tone={unacknowledged.length ? 'warn' : 'good'}
        />
        <Stat
          label="Breaching"
          value={String(breaching.length)}
          tone={breaching.length ? 'bad' : 'good'}
        />
        <Stat label="Capacity" value="4 / 6" hint="Open assignments against your limit" />
      </StatGrid>

      <Panel
        title="Your queue"
        subtitle="Acknowledging stops the clock. It does not commit you to a conclusion."
      >
        <Table
          columns={['Report', 'Incident', 'Where', 'Severity', 'Target', 'Remaining']}
          rows={rows.map((r) => [
            <code key="r" className="text-xs">
              {r.ref}
            </code>,
            <span key="w" className="text-xs text-text-secondary">
              {r.what}
            </span>,
            <span key="p" className="text-xs text-text-muted">
              {r.where}
            </span>,
            <span
              key="s"
              className="whitespace-nowrap text-xs"
              style={{ color: SEVERITY_META[r.severity].hue }}
            >
              {SEVERITY_META[r.severity].label}
            </span>,
            <span key="t" className="tabular text-xs text-text-muted">
              {ACK_TARGET_HOURS[r.severity]}h
            </span>,
            r.ack !== null ? (
              <Pill key="h" tone={r.sla.status === 'met' ? 'good' : 'bad'}>
                {r.sla.status}
              </Pill>
            ) : (
              <span
                key="h"
                className={
                  r.sla.hoursRemaining <= 0 ? 'tabular text-xs text-danger' : 'tabular text-xs'
                }
              >
                {r.sla.hoursRemaining >= 0
                  ? `${r.sla.hoursRemaining.toFixed(1)}h`
                  : `−${Math.abs(r.sla.hoursRemaining).toFixed(1)}h`}
              </span>
            ),
          ])}
          align={[4, 5]}
        />
      </Panel>

      <Panel
        title="What you can record"
        subtitle="The log is append-only. A decision stands rather than being quietly rewritten."
      >
        <Table
          columns={['Action', 'Means', 'Ends the case', 'Reporter told']}
          rows={ORDER.map((a) => {
            const meta = RESPONSE_META[a];
            return [
              <span key="a" className="whitespace-nowrap font-medium text-text-primary">
                {meta.label}
              </span>,
              <span key="d" className="text-xs text-text-muted">
                {meta.description}
              </span>,
              meta.terminal ? (
                <Pill key="t" tone="info">
                  Yes
                </Pill>
              ) : (
                <Pill key="t">No</Pill>
              ),
              meta.notifiesReporter ? (
                <Pill key="n" tone="good">
                  Yes
                </Pill>
              ) : (
                <Pill key="n">No</Pill>
              ),
            ];
          })}
        />
      </Panel>

      <Note>
        Every action notifies the reporter, including the ones nobody enjoys sending. A reporter who
        never learns anything happened stops filing, and an agency that cannot show it responded has
        no evidence of its own work — the notification serves both.
      </Note>
    </PageShell>
  );
}
