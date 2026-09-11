import { redirect } from 'next/navigation';
import {
  ACK_TARGET_HOURS,
  SEVERITIES,
  SEVERITY_META,
  roleCan,
  severityMeta,
  slaState,
  type Employee,
  type OrganisationAccount,
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
import { Outage, load } from '@/components/ui';
import { platform, org } from '@/lib/consoleApi';

/**
 * Live cases, computed through the real `slaState` rather than hand-written.
 *
 * The whole point of this screen is the clock, so the statuses shown here go
 * through the same function the rest of the platform uses. Hard-coding
 * "breached" next to a timestamp would let the two drift, and the drift would
 * be invisible.
 */
export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'view_sla')) redirect('/');

  /*
   * The clock, running against real time.
   *
   * This page carried five invented cases measured against a frozen `NOW` of
   * 2026-08-28, so "breached" and "at risk" were arithmetic over a fixture and
   * would have read the same on any day of any year. An operator escalating
   * from this screen was escalating nothing.
   *
   * A routed report with no routing timestamp is left out rather than given an
   * invented deadline: an acknowledgement target is a commitment, and a
   * fabricated one is worse than a missing one.
   */
  const result = await load(async () => {
    const routing = await platform.routing();
    // Only for naming the organisation and its responders beside each case; a
    // role that cannot read them still sees the clocks, which is the point of
    // the page.
    const [ORGANISATIONS, EMPLOYEES] = await Promise.all([
      platform.organisations<OrganisationAccount>().catch(() => [] as OrganisationAccount[]),
      org.employees<Employee>().catch(() => [] as Employee[]),
    ]);
    return { routing, ORGANISATIONS, EMPLOYEES };
  });

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Service levels"
          blurb="Acknowledgement targets against severity, and what is running out of time."
        />
        <Outage error={result.error} retryHref="/admin/sla" />
      </PageShell>
    );
  }

  const now = new Date().toISOString();
  const { routing, ORGANISATIONS, EMPLOYEES } = result.data;
  const rows = routing.flatMap((c) => {
    /*
     * A row needs a clock and something to measure. Without a submission time
     * or a severity there is no acknowledgement target, and inventing one would
     * put a deadline on screen that nobody agreed to — so the row is left out
     * rather than given a made-up target.
     */
    if (!c.submittedAtIso || !c.severity) return [];
    const ack = c.acknowledgedAtIso ?? null;
    return [
      {
        ref: c.reportId ?? c.incidentId,
        what: c.summary,
        severity: c.severity,
        org: c.suggestedBusinessIds[0] ?? '',
        ack,
        sla: slaState(c.severity, c.submittedAtIso, ack, now),
      },
    ];
  });

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
          empty="No reports on the clock. Acknowledgement targets start when a report is routed to an organisation."
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
              style={{ color: severityMeta(r.severity).hue }}
            >
              {severityMeta(r.severity).label}
            </span>,
            <span key="o" className="text-xs text-text-muted">
              {ORGANISATIONS.find((b) => b.id === r.org)?.name ?? r.org}
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
