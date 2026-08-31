import { redirect } from 'next/navigation';
import {
  ACK_TARGET_HOURS,
  SEVERITIES,
  SEVERITY_META,
  BUSINESSES,
  EMPLOYEES,
  roleCan,
  slaState,
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

/**
 * Live cases, computed through the real `slaState` rather than hand-written.
 *
 * The whole point of this screen is the clock, so the statuses shown here go
 * through the same function the rest of the platform uses. Hard-coding
 * "breached" next to a timestamp would let the two drift, and the drift would
 * be invisible.
 */
const NOW = new Date('2026-08-28T09:00:00.000Z');
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();

const CASES = [
  {
    ref: 'DW-VPR-WCH',
    what: 'Burst main flooding Kaneshie market road',
    severity: 'emergency' as const,
    submitted: 2.3,
    ack: null,
    org: 'biz_ama',
  },
  {
    ref: 'DW-DC9-VKM',
    what: 'Collapsed culvert, road impassable',
    severity: 'urgent' as const,
    submitted: 3.6,
    ack: null,
    org: 'biz_nadmo',
  },
  {
    ref: 'DW-WQD-JW4',
    what: 'Illegal mining beside the river',
    severity: 'urgent' as const,
    submitted: 5.1,
    ack: null,
    org: 'biz_ama',
  },
  {
    ref: 'DW-YNG-6JR',
    what: 'Transformer sparking over a walkway',
    severity: 'emergency' as const,
    submitted: 0.7,
    ack: null,
    org: 'biz_ec',
  },
  {
    ref: 'DW-TKM-2QP',
    what: 'Refuse uncollected for eleven days',
    severity: 'concern' as const,
    submitted: 20,
    ack: null,
    org: 'biz_ama',
  },
  {
    ref: 'DW-RJH-9CF',
    what: 'Blocked storm drain on the high street',
    severity: 'concern' as const,
    submitted: 30,
    ack: 4,
    org: 'biz_ama',
  },
  {
    ref: 'DW-GBN-4XW',
    what: 'Faded markings at a school crossing',
    severity: 'observation' as const,
    submitted: 80,
    ack: 70,
    org: 'biz_nadmo',
  },
];

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'view_sla')) redirect('/');

  const rows = CASES.map((c) => ({
    ...c,
    sla: slaState(
      c.severity,
      at(c.submitted),
      c.ack === null ? null : at(c.submitted - c.ack),
      NOW.toISOString(),
    ),
  }));

  const count = (s: string) => rows.filter((r) => r.sla.status === s).length;
  const escalating = rows.filter((r) => r.sla.status === 'breached' && r.ack === null);

  return (
    <PageShell>
      <PageIntro
        title="Service levels"
        blurb="Acknowledgement targets against severity, and what is running out of time."
      />

      <StatGrid>
        <Stat label="Breached" value={String(count('breached'))} tone="bad" />
        <Stat
          label="At risk"
          value={String(count('at_risk'))}
          tone="warn"
          hint="Last quarter of the window"
        />
        <Stat label="Due" value={String(count('due'))} />
        <Stat label="Met" value={String(count('met'))} tone="good" />
      </StatGrid>

      <Panel title="Targets" subtitle="Set by the reporter's own account of urgency.">
        <Table
          columns={['Severity', 'Meaning', 'Acknowledge within', 'Open']}
          rows={SEVERITIES.slice()
            .reverse()
            .map((s) => [
              <span key="s" className="whitespace-nowrap font-medium text-text-primary">
                {SEVERITY_META[s].label}
              </span>,
              <span key="m" className="text-xs text-text-muted">
                {SEVERITY_META[s].hint}
              </span>,
              <span key="t" className="tabular">
                {ACK_TARGET_HOURS[s]}h
              </span>,
              <span key="o" className="tabular text-text-muted">
                {rows.filter((r) => r.severity === s && r.ack === null).length}
              </span>,
            ])}
          align={[2, 3]}
        />
      </Panel>

      <Panel title="Open cases" subtitle="The clock stops at acknowledgement, late or not.">
        <Table
          columns={['Report', 'Incident', 'Severity', 'Organisation', 'Remaining', 'Status']}
          rows={rows.map((r) => [
            <code key="r" className="text-xs">
              {r.ref}
            </code>,
            <span key="w" className="text-xs text-text-secondary">
              {r.what}
            </span>,
            <span
              key="s"
              className="whitespace-nowrap text-xs"
              style={{ color: SEVERITY_META[r.severity].hue }}
            >
              {SEVERITY_META[r.severity].label}
            </span>,
            <span key="o" className="text-xs text-text-muted">
              {BUSINESSES.find((b) => b.id === r.org)?.name ?? r.org}
            </span>,
            <span key="h" className="tabular text-xs">
              {r.sla.hoursRemaining >= 0
                ? `${r.sla.hoursRemaining.toFixed(1)}h`
                : `−${Math.abs(r.sla.hoursRemaining).toFixed(1)}h`}
            </span>,
            <Pill
              key="st"
              tone={
                r.sla.status === 'breached'
                  ? 'bad'
                  : r.sla.status === 'at_risk'
                    ? 'warn'
                    : r.sla.status === 'met'
                      ? 'good'
                      : 'neutral'
              }
            >
              {r.sla.status.replace(/_/g, ' ')}
            </Pill>,
          ])}
          align={[4]}
        />
      </Panel>

      {escalating.length > 0 ? (
        <Panel
          title="Escalating"
          subtitle="Only unacknowledged breaches escalate — a case acknowledged late is already with a person."
        >
          <Table
            columns={['Report', 'Over by', 'Suggested']}
            rows={escalating.map((r) => [
              <code key="r" className="text-xs">
                {r.ref}
              </code>,
              <span key="o" className="tabular text-danger">
                {Math.abs(r.sla.hoursRemaining).toFixed(1)}h
              </span>,
              <span key="s" className="text-xs text-text-muted">
                {EMPLOYEES.find((e) => e.shiftStatus === 'on_duty')?.displayName ??
                  'Anyone on duty'}
              </span>,
            ])}
            align={[1]}
          />
        </Panel>
      ) : null}

      <Note>
        Escalating a case that has already been acknowledged tells a supervisor to chase work
        somebody is doing. That is why the clock stops at acknowledgement rather than at resolution,
        and why only unacknowledged breaches appear above.
      </Note>
    </PageShell>
  );
}
