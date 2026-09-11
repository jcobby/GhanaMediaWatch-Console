import { redirect } from 'next/navigation';
import { roleCan, type Branch, type OrganisationAccount, type Employee } from '@dawuro/core';
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

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'manage_branches')) redirect('/');

  /*
   * Branch coverage, live.
   *
   * The note below is the reason this page matters: assignment treats a branch
   * radius as a hard limit, so a boundary drawn too tightly silently stops
   * reports reaching anyone. Reading that from fixtures would show an operator
   * a coverage map that is not the one doing the stopping.
   */
  const result = await load(async () => {
    const [branches, employees, organisations] = await Promise.all([
      org.branches<Branch>(),
      org.employees<Employee>(),
      platform.organisations<OrganisationAccount>().catch(() => [] as OrganisationAccount[]),
    ]);
    return { branches, employees, organisations };
  });

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Branches"
          blurb="Institution offices, depots and bureaux, and the area each covers."
        />
        <Outage error={result.error} retryHref="/admin/branches" />
      </PageShell>
    );
  }

  const { branches: BRANCHES, employees: EMPLOYEES, organisations: ORGANISATIONS } = result.data;
  const unassigned = EMPLOYEES.filter((e) => e.branchId === null);
  const avgRadius =
    BRANCHES.reduce((t, b) => t + b.jurisdictionRadiusM, 0) / Math.max(1, BRANCHES.length);

  return (
    <PageShell>
      <PageIntro
        title="Branches"
        blurb="Institution offices, depots and bureaux, and the area each covers."
      />

      <Note tone="warn">
        <span className="font-semibold">
          These branches belong to the institutions, not to Dawuro.
        </span>{' '}
        Their jurisdiction and staffing are the institution&rsquo;s to set. They appear here because
        assignment treats a branch radius as a hard limit — a boundary drawn too tightly is a
        boundary that silently stops reports reaching anyone.
      </Note>

      <StatGrid>
        <Stat label="Branches" value={String(BRANCHES.length)} />
        <Stat label="Staff assigned" value={String(EMPLOYEES.length - unassigned.length)} />
        <Stat
          label="Unassigned"
          value={String(unassigned.length)}
          tone={unassigned.length > 0 ? 'warn' : 'good'}
          hint="Still routable org-wide"
        />
        <Stat label="Median jurisdiction" value={`${(avgRadius / 1000).toFixed(0)} km`} />
      </StatGrid>

      <Panel title="Branches" subtitle="Jurisdiction is a hard limit in assignment scoring.">
        <Table
          empty="No branches yet. Institutions create their own; they appear once an organisation adds one."
          columns={['Branch', 'Organisation', 'Area', 'Radius', 'Staff', 'On duty']}
          rows={BRANCHES.map((b) => {
            const staff = EMPLOYEES.filter((e) => e.branchId === b.id);
            const onDuty = staff.filter((e) => e.shiftStatus === 'on_duty').length;
            return [
              <span key="n" className="font-medium text-text-primary">
                {b.name}
              </span>,
              <span key="o" className="text-xs text-text-muted">
                {ORGANISATIONS.find((x) => x.id === b.businessId)?.name ?? b.businessId}
              </span>,
              <span key="a" className="text-xs text-text-muted">
                {b.areaLabel}
              </span>,
              <span key="r" className="tabular">
                {(b.jurisdictionRadiusM / 1000).toFixed(1)} km
              </span>,
              <span key="s" className="tabular text-text-muted">
                {staff.length}
              </span>,
              onDuty === 0 ? (
                <Pill key="d" tone="bad">
                  none
                </Pill>
              ) : (
                <span key="d" className="tabular text-success">
                  {onDuty}
                </span>
              ),
            ];
          })}
          align={[3, 4, 5]}
        />
      </Panel>

      {unassigned.length > 0 ? (
        <Panel
          title="Staff without a branch"
          subtitle="Still eligible for routing across the whole organisation — a missing branch narrows nothing."
        >
          <Table
            columns={['Name', 'Duties', 'Shift']}
            rows={unassigned.map((e) => [
              <span key="n" className="font-medium text-text-primary">
                {e.displayName}
              </span>,
              <span key="d" className="text-xs text-text-muted">
                {e.duties.map((d) => d.replace(/_/g, ' ')).join(', ') || '—'}
              </span>,
              <Pill key="s" tone={e.shiftStatus === 'on_duty' ? 'good' : 'neutral'}>
                {e.shiftStatus.replace(/_/g, ' ')}
              </Pill>,
            ])}
          />
        </Panel>
      ) : null}

      <Note>
        A circle is a crude stand-in for a real administrative boundary, which is a polygon. It is
        deliberately crude: the shape of these boundaries is each organisation&rsquo;s decision, and
        guessing at them would bake in borders nobody agreed to. Scoring treats the radius as a hard
        limit, so replacing it with real geometry later changes one function.
      </Note>
    </PageShell>
  );
}
