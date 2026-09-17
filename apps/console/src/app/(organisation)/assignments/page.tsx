import { redirect } from 'next/navigation';
import {
  ACK_TARGET_HOURS,
  RESPONSE_META,
  roleCan,
  severityMeta,
  slaState,
  type Incident,
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
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { requireSession } from '@/lib/session';
import { load } from '@/components/ui';
import { org } from '@/lib/consoleApi';
import { normaliseAssignments } from '@/lib/assignments';
import { AssignmentsBoard } from './AssignmentsBoard';

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

  /*
   * What has actually been routed to this organisation.
   *
   * This page carried four hand-written reports and a frozen `NOW` of
   * 2026-08-28, so every SLA clock on it counted down from a date that had
   * nothing to do with today. An officer reading "breaching" here was reading
   * arithmetic against a fixture.
   *
   * The clock is computed by the shared `slaState` — the same rule the platform
   * SLA sweep uses — from the report's real timestamps and the real time now.
   */
  const result = await load(async () => {
    const [inbox, dispatch] = await Promise.all([
      org.inbox<AssignedReport>(),
      /*
       * Soft: a dispatch list that cannot be read says so in its own panel, and
       * does not take the SLA queue with it.
       */
      org
        .assignments<unknown>()
        .then(normaliseAssignments)
        .catch(() => null),
    ]);
    return Object.assign(inbox, { dispatch });
  });
  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Assignments"
          blurb="What has been sent to you, and the clock running against each one."
        />
        <OrganisationOutage error={result.error} retryHref="/assignments" />
      </PageShell>
    );
  }

  const now = new Date().toISOString();
  const rows = result.data.flatMap((incident) => {
    /*
     * The clock runs from when the report reached this organisation.
     *
     * Not from `capturedAtIso`, which is nullable — a reporter may suppress the
     * capture time, and an SLA measured from a withheld timestamp would be
     * measured from nothing. A row the server gives no routing time for is left
     * out of the queue rather than given an invented deadline: an SLA is a
     * commitment, and a fabricated one is worse than an absent one.
     */
    const submittedAt = incident.submittedAtIso ?? incident.routedAtIso;
    if (!submittedAt) return [];

    const acknowledgedAt = firstAcknowledgement(incident);
    return [
      {
        ref: incident.reportId,
        what: incident.description,
        where: incident.location.label ?? 'Location withheld',
        severity: incident.severity,
        ack: acknowledgedAt,
        sla: slaState(incident.severity, submittedAt, acknowledgedAt, now),
      },
    ];
  });

  const dispatch = result.data.dispatch;
  const openDispatch = dispatch?.filter((a) => a.status !== 'closed').length ?? null;
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
        <Stat
          label="Staff dispatched"
          value={openDispatch === null ? '—' : String(openDispatch)}
          hint="Assignments not yet closed"
        />
      </StatGrid>

      <Panel
        title="Dispatch"
        subtitle="Who has been sent to which report, and how far they have got."
      >
        {dispatch ? (
          <AssignmentsBoard assignments={dispatch} />
        ) : (
          <p className="text-xs text-text-muted">
            The dispatch list could not be read just now. The queue below is unaffected.
          </p>
        )}
      </Panel>

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
              style={{ color: severityMeta(r.severity).hue }}
            >
              {severityMeta(r.severity).label}
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

/**
 * When this organisation first acknowledged the report, if it has.
 *
 * Acknowledgement is what stops the SLA clock, so it is read from the response
 * timeline the organisation itself wrote rather than assumed. A report with no
 * timeline has not been acknowledged, which is the honest reading of silence.
 */
function firstAcknowledgement(incident: AssignedReport): string | null {
  const timeline = incident.responses;
  if (!Array.isArray(timeline)) return null;
  const ack = timeline.find((r) => r.action === 'acknowledged');
  return ack?.atIso ?? null;
}

/**
 * An inbox entry, with the routing metadata the SLA clock needs.
 *
 * `Incident` alone does not carry when a report was routed to a particular
 * organisation — it is a property of the delivery, not of the report — so the
 * two fields the inbox adds are declared here rather than pushed onto the
 * shared type, where they would be wrong for every other caller.
 */
type AssignedReport = Incident & {
  submittedAtIso?: string;
  routedAtIso?: string;
  responses?: { action: string; atIso: string }[];
};
