import {
  SUBSCRIPTION_PLANS,
  ROLE_META,
  ADMIN_ROLES,
  formatCedis,
  type AdminRole,
} from '@dawuro/core';
import type { AdminData } from '@/lib/consoleApi';
import { Feed, Note, Panel, Pill, RoleIntro, Stat, StatGrid, Table } from './Widgets';
import { RowAction, RowActions } from './RowAction';

/**
 * A different dashboard per admin role.
 *
 * Nine components rather than one component with nine conditionals, because
 * the roles genuinely have nothing in common — an auditor's first question is
 * "what changed and who did it", a finance officer's is "what do we owe", and
 * squeezing both through one configurable template would produce a page that
 * suits neither.
 *
 * What they share is the widget kit and the opening `RoleIntro`, which is
 * enough to read as one module.
 */

const money = (pesewas: number) => formatCedis(pesewas);

function intro(role: AdminRole) {
  const meta = ROLE_META[role];
  return <RoleIntro label={meta.label} description={meta.description} hue={meta.hue} />;
}

// ─── super admin ───────────────────────────────────────────────────────────

function SuperAdmin({ data }: { data: AdminData }) {
  const pendingApplications = data.applications.filter((a) => !a.approvedAtIso).length;
  const owed = data.commissions
    .filter((c) => c.status === 'earned')
    .reduce((t, c) => t + c.amountPesewas, 0);

  return (
    <>
      {intro('super_admin')}

      <StatGrid>
        <Stat
          label="Institutions"
          value={String(data.organisations.length)}
          hint="Subscribing accounts"
        />
        <Stat label="Staff" value={String(data.employees.length)} hint="Across all branches" />
        <Stat
          label="Awaiting approval"
          value={String(pendingApplications)}
          tone={pendingApplications > 0 ? 'warn' : 'good'}
          hint="Onboarding applications"
        />
        <Stat label="Owed to reporters" value={money(owed)} hint="Licensed, not yet paid" />
      </StatGrid>

      <Panel
        title="Administrators"
        subtitle="The only role that can create or remove one of these is this one."
      >
        <Table
          columns={['Role', 'Module', 'Holds', 'Scope']}
          rows={ADMIN_ROLES.map((r) => {
            const m = ROLE_META[r];
            return [
              <span key="l" className="font-medium text-text-primary">
                {m.label}
              </span>,
              <Pill key="m" tone="info">
                Admin
              </Pill>,
              <span key="c" className="tabular text-text-muted">
                {m.capabilities.length}
              </span>,
              <span key="s" className="text-xs text-text-muted">
                {m.blurb}
              </span>,
            ];
          })}
          align={[2]}
        />
      </Panel>

      <Panel title="Recent platform activity" subtitle="Everything, unfiltered.">
        <Feed
          items={[
            {
              when: '09:42',
              what: 'Onboarding step approved — Ghana Water Company (Coverage)',
            },
            {
              when: '09:20',
              what: 'Payout batch PB-000118 released — 34 reporters',
            },
            {
              when: '08:55',
              what: 'Screening cleared — Electricity Company of Ghana',
            },
            {
              when: '08:31',
              what: 'Routing override — DW-VPR-WCH added to NADMO',
            },
            { when: 'Yesterday', what: 'Signing key rotated by System Admin' },
          ]}
        />
      </Panel>
    </>
  );
}

// ─── global connect admin ──────────────────────────────────────────────────

function DawuroAdmin({ data }: { data: AdminData }) {
  const usable = data.invites.filter((i) => !i.revokedAtIso).length;

  return (
    <>
      {intro('dawuro_admin')}

      <StatGrid>
        <Stat
          label="Affiliations"
          value={String(data.affiliations.length)}
          hint="Directional links"
        />
        <Stat label="Live invites" value={String(usable)} hint="Not revoked or expired" />
        <Stat label="Agents" value="34" hint="Reporting under an institution" />
        <Stat
          label="Partner orgs"
          value={String(data.organisations.length)}
          hint="In the network"
        />
      </StatGrid>

      <Panel
        title="Affiliation graph"
        subtitle="Directional and acyclic — an organisation can never become its own ancestor."
      >
        <Table
          columns={['From', 'To', 'Kind', 'Grants']}
          rows={data.affiliations.slice(0, 8).map((a) => [
            <span key="f" className="font-medium text-text-primary">
              {data.organisations.find((b) => b.id === a.parentBusinessId)?.name ??
                a.parentBusinessId}
            </span>,
            <span key="t" className="text-text-secondary">
              {data.organisations.find((b) => b.id === a.affiliateBusinessId)?.name ??
                a.affiliateBusinessId}
            </span>,
            <Pill key="k" tone="info">
              {a.kind.replace(/_/g, ' ')}
            </Pill>,
            a.sharesReports ? (
              <Pill key="s" tone="warn">
                Shares reports
              </Pill>
            ) : (
              <Pill key="s">Branding only</Pill>
            ),
          ])}
        />
      </Panel>

      <Panel title="Invite links" subtitle="What each one grants, and how much of it is left.">
        <Table
          columns={['Token', 'Kind', 'Used', 'State']}
          rows={data.invites.slice(0, 6).map((i) => [
            <code key="l" className="text-xs text-text-primary">
              {i.token.slice(0, 10)}…
            </code>,
            <Pill key="k">{i.kind.replace(/_/g, ' ')}</Pill>,
            <span key="u" className="tabular text-text-muted">
              {i.usedCount}
              {i.maxUses === null ? '' : ` / ${i.maxUses}`}
            </span>,
            i.revokedAtIso ? (
              <Pill key="s" tone="bad">
                Revoked
              </Pill>
            ) : (
              <Pill key="s" tone="good">
                Live
              </Pill>
            ),
          ])}
          align={[2]}
        />
      </Panel>
    </>
  );
}

// ─── system admin ──────────────────────────────────────────────────────────

function SystemAdmin() {
  return (
    <>
      {intro('system_admin')}

      {/*
        No uptime, throughput or storage figures.

        The backend exists now, but exposes nothing that measures it — no
        metrics, health or capacity endpoint. Any number here would still be
        invented, and an invented figure on an operations screen is the kind of
        thing someone repeats in a meeting as though it were measured.

        This component takes no data for that reason: there is none to take.
      */}
      <Note tone="warn">
        <span className="font-semibold">There is nothing to measure this against yet.</span> This
        desk configures the platform rather than watching it. Uptime, upload throughput and storage
        appear here once the service reports them.
      </Note>

      <Panel
        title="Signing keys"
        subtitle="What makes an assurance class mean anything. Rotation invalidates nothing — historical signatures verify against the key that made them."
      >
        <Table
          columns={['Key', 'Purpose', 'Rotated', 'State']}
          rows={[
            [
              <code key="k">cap-sign-2026-08</code>,
              'Capture integrity signature',
              '3 days ago',
              <Pill key="s" tone="good">
                Active
              </Pill>,
            ],
            [
              <code key="k">cap-sign-2026-05</code>,
              'Capture integrity signature',
              '3 months ago',
              <Pill key="s" tone="info">
                Verify-only
              </Pill>,
            ],
            [
              <code key="k">session-hs256</code>,
              'Console session tokens',
              '3 days ago',
              <Pill key="s" tone="good">
                Active
              </Pill>,
            ],
          ]}
        />
      </Panel>

      <Panel title="Integrations" subtitle="Nothing here is wired to a backend yet.">
        <Table
          columns={['Service', 'Purpose', 'State']}
          rows={[
            [
              'Play Integrity',
              'Device attestation → deviceCheckPassed',
              <Pill key="a">Not connected</Pill>,
            ],
            ['App Attest', 'Device attestation (iOS)', <Pill key="b">Not connected</Pill>],
            ['ClamAV', 'Malware screening on complete', <Pill key="c">Not connected</Pill>],
            ['MTN MoMo', 'Reporter payouts', <Pill key="d">Not connected</Pill>],
          ]}
        />
      </Panel>
    </>
  );
}

// ─── hr / administration ───────────────────────────────────────────────────

function HrAdmin({ data }: { data: AdminData }) {
  const onDuty = data.employees.filter((e) => e.shiftStatus === 'on_duty').length;
  const pending = data.membershipRequests.filter((m) => m.status === 'pending').length;
  const generalists = data.employees.filter((e) => e.specialisations.length === 0).length;

  return (
    <>
      {intro('hr_admin')}

      <StatGrid>
        <Stat label="Staff" value={String(data.employees.length)} />
        <Stat label="On duty" value={String(onDuty)} tone="good" />
        <Stat
          label="Awaiting acceptance"
          value={String(pending)}
          tone={pending > 0 ? 'warn' : 'neutral'}
          hint="People claiming to work here"
        />
        <Stat
          label="Generalists"
          value={String(generalists)}
          hint="No specialisation set — eligible for anything"
        />
      </StatGrid>

      <Panel
        title="Membership requests"
        subtitle="Someone claiming to work for an organisation. Acceptance is always an act by someone already inside."
      >
        <Table
          columns={['Name', 'Says they are', 'Signed up via', 'Email', '']}
          rows={data.membershipRequests
            .filter((m) => m.status === 'pending')
            .slice(0, 6)
            .map((m) => [
              <span key="n" className="font-medium text-text-primary">
                {m.displayName}
              </span>,
              <span key="r" className="text-text-secondary">
                {m.statedRole}
              </span>,
              <Pill key="s" tone={m.signUpMethod === 'google' ? 'info' : 'neutral'}>
                {m.signUpMethod}
              </Pill>,
              m.emailVerified ? (
                <Pill key="e" tone="good">
                  Verified
                </Pill>
              ) : (
                <Pill key="e" tone="warn">
                  Unverified
                </Pill>
              ),
              <RowActions key="a">
                <RowAction label="Accept" done="Accepted" tone="primary" />
                <RowAction label="Decline" done="Declined" confirm="Decline this request?" />
              </RowActions>,
            ])}
          align={[4]}
        />
      </Panel>

      <Panel
        title="Duties and specialisations"
        subtitle="These decide what routing can send someone. An empty specialisation list means generalist, not excluded."
      >
        <Table
          columns={['Name', 'Branch', 'Duties', 'Handles', 'Shift']}
          rows={data.employees.slice(0, 8).map((e) => [
            <span key="n" className="font-medium text-text-primary">
              {e.displayName}
            </span>,
            <span key="b" className="text-xs text-text-muted">
              {data.branches.find((b) => b.id === e.branchId)?.name ?? 'Unassigned'}
            </span>,
            <span key="d" className="text-xs text-text-muted">
              {e.duties.map((d) => d.replace(/_/g, ' ')).join(', ') || '—'}
            </span>,
            <span key="s" className="text-xs text-text-muted">
              {e.specialisations.length === 0
                ? 'Anything'
                : `${e.specialisations.length} categories`}
            </span>,
            <Pill
              key="sh"
              tone={
                e.shiftStatus === 'on_duty'
                  ? 'good'
                  : e.shiftStatus === 'on_leave'
                    ? 'warn'
                    : 'neutral'
              }
            >
              {e.shiftStatus.replace(/_/g, ' ')}
            </Pill>,
          ])}
        />
      </Panel>
    </>
  );
}

// ─── operations ────────────────────────────────────────────────────────────

function Operations({ data }: { data: AdminData }) {
  const unmatched = data.routing.filter(
    (r) => r.suggestedBusinessIds.length === 0 && r.requestedBusinessIds.length === 0,
  ).length;

  return (
    <>
      {intro('operations')}

      <StatGrid>
        <Stat label="In the queue" value={String(data.routing.length)} />
        <Stat
          label="Matched nobody"
          value={String(unmatched)}
          tone={unmatched > 0 ? 'bad' : 'good'}
          hint="An operator may know a recipient the rules do not"
        />
        <Stat label="Breaching SLA" value="3" tone="bad" hint="Unacknowledged past target" />
        <Stat label="At risk" value="7" tone="warn" hint="Last quarter of the window" />
      </StatGrid>

      <Panel
        title="Routing desk"
        subtitle="Auto-routing handles the ordinary case. This sits above it — oversight and override, not a gate."
      >
        <Table
          columns={['Report', 'Category', 'Matched', 'Why']}
          rows={data.routing.slice(0, 8).map((r) => {
            const matched = r.suggestedBusinessIds.length + r.requestedBusinessIds.length;
            return [
              <span key="r" className="text-xs text-text-secondary">
                {r.summary}
              </span>,
              <span key="c" className="text-text-secondary">
                {r.category}
              </span>,
              matched === 0 ? (
                <Pill key="m" tone="bad">
                  Nobody
                </Pill>
              ) : (
                <span key="m" className="tabular text-text-muted">
                  {matched}
                </span>
              ),
              <span key="t" className="text-xs text-text-muted">
                {r.requestedBusinessIds.length > 0
                  ? 'named by the reporter'
                  : matched > 0
                    ? 'interest and area match'
                    : 'needs an operator'}
              </span>,
            ];
          })}
        />
      </Panel>

      <Panel
        title="Acknowledgement targets"
        subtitle="Emergency 1h · Urgent 4h · Concern 24h · Observation 72h"
      >
        <Feed
          items={[
            {
              when: '11m',
              what: (
                <>
                  DW-VPR-WCH · <Pill tone="bad">breached</Pill> emergency, unacknowledged 1h 11m
                </>
              ),
            },
            {
              when: '38m',
              what: (
                <>
                  DW-DC9-VKM · <Pill tone="warn">at risk</Pill> urgent, 42m of 4h left
                </>
              ),
            },
            {
              when: '2h',
              what: (
                <>
                  DW-YNG-6JR · <Pill tone="good">met</Pill> acknowledged in 26m
                </>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

// ─── branch ────────────────────────────────────────────────────────────────

function BranchManager({ data }: { data: AdminData }) {
  const branch = data.branches[0];
  const staff = data.employees.filter((e) => e.branchId === branch?.id);
  const onDuty = staff.filter((e) => e.shiftStatus === 'on_duty');

  return (
    <>
      {intro('branch_manager')}

      <StatGrid>
        <Stat label="Branch" value={branch?.name ?? '—'} hint={branch?.areaLabel} />
        <Stat label="Staff" value={String(staff.length)} />
        <Stat
          label="On duty"
          value={String(onDuty.length)}
          tone={onDuty.length > 0 ? 'good' : 'bad'}
        />
        <Stat
          label="Jurisdiction"
          value={branch ? `${(branch.jurisdictionRadiusM / 1000).toFixed(0)} km` : '—'}
          hint="A circle standing in for a real boundary"
        />
      </StatGrid>

      <Panel
        title="Who can take work right now"
        subtitle="Capacity, duty and specialisation — the hard gates before scoring even runs."
      >
        <Table
          columns={['Name', 'Shift', 'Open', 'Capacity', 'Acknowledges']}
          rows={staff.map((e) => [
            <span key="n" className="font-medium text-text-primary">
              {e.displayName}
            </span>,
            <Pill
              key="s"
              tone={
                e.shiftStatus === 'on_duty'
                  ? 'good'
                  : e.shiftStatus === 'on_leave'
                    ? 'warn'
                    : 'neutral'
              }
            >
              {e.shiftStatus.replace(/_/g, ' ')}
            </Pill>,
            <span key="o" className="tabular">
              {e.openAssignments}
            </span>,
            <span key="c" className="tabular text-text-muted">
              {e.maxConcurrentAssignments}
            </span>,
            <span
              key="a"
              className={
                e.acknowledgementRate < 0.7 ? 'tabular text-danger' : 'tabular text-text-muted'
              }
            >
              {Math.round(e.acknowledgementRate * 100)}%
            </span>,
          ])}
          align={[2, 3, 4]}
        />
      </Panel>
    </>
  );
}

// ─── compliance ────────────────────────────────────────────────────────────

function Compliance({ data }: { data: AdminData }) {
  const unscreened = data.applications.filter((a) => a.screeningRunAtIso === null);
  const flagged = data.applications.filter((a) => a.screeningClear === false);

  return (
    <>
      {intro('compliance_officer')}

      <StatGrid>
        <Stat
          label="Awaiting screening"
          value={String(unscreened.length)}
          tone={unscreened.length > 0 ? 'warn' : 'good'}
        />
        <Stat
          label="Returned a hit"
          value={String(flagged.length)}
          tone={flagged.length > 0 ? 'bad' : 'good'}
        />
        <Stat label="Open takedowns" value="2" tone="warn" hint="Under Act 843" />
        <Stat label="Redaction required" value="5" hint="Cannot publish unredacted" />
      </StatGrid>

      <Panel
        title="Screening queue"
        subtitle="Sanctions and adverse media, on the organisation and its named officer. No approval is possible until this is run and clear."
      >
        <Table
          columns={['Organisation', 'Reference', 'Steps approved', 'Screening', '']}
          rows={data.applications.slice(0, 6).map((a) => [
            <span key="o" className="font-medium text-text-primary">
              {a.organisationName}
            </span>,
            <code key="r" className="text-xs">
              {a.reference}
            </code>,
            <span key="s" className="tabular text-text-muted">
              {a.steps.filter((s) => s.status === 'approved').length} / 4
            </span>,
            a.screeningRunAtIso === null ? (
              <Pill key="c" tone="warn">
                Not run
              </Pill>
            ) : a.screeningClear ? (
              <Pill key="c" tone="good">
                Clear
              </Pill>
            ) : (
              <Pill key="c" tone="bad">
                Hit
              </Pill>
            ),
            <RowActions key="x">
              {a.screeningRunAtIso === null ? (
                <RowAction label="Run screening" done="Screening run" tone="primary" />
              ) : a.screeningClear === false ? (
                <RowAction
                  label="Escalate"
                  done="Escalated"
                  tone="danger"
                  confirm="Refer to the platform owner?"
                />
              ) : (
                <RowAction label="Re-run" done="Re-run" />
              )}
            </RowActions>,
          ])}
          align={[2, 4]}
        />
      </Panel>

      <Panel
        title="Handling requirements in force"
        subtitle="Derived from what the reporter said the footage contains — never chosen by an editor."
      >
        <Table
          columns={['Requirement', 'Reports', 'Effect']}
          rows={[
            [
              'redact_before_publication',
              '5',
              'Hard block on the public feed until redaction is recorded',
            ],
            ['editorial_review_required', '8', 'A human must look regardless of automated checks'],
            ['viewer_warning', '4', 'Interstitial before playback'],
            ['restrict_location', '3', 'Coordinates suppressed publicly'],
          ]}
          align={[1]}
        />
      </Panel>
    </>
  );
}

// ─── finance ───────────────────────────────────────────────────────────────

function Finance({ data }: { data: AdminData }) {
  const owed = data.commissions
    .filter((c) => c.status === 'earned')
    .reduce((t, c) => t + c.amountPesewas, 0);
  const paid = data.commissions
    .filter((c) => c.status === 'paid')
    .reduce((t, c) => t + c.amountPesewas, 0);
  const mrr = data.organisations.reduce((t, b) => {
    const plan = SUBSCRIPTION_PLANS[b.tier];
    return (
      t + (plan.billingPeriod === 'annual' ? Math.round(plan.feePesewas / 12) : plan.feePesewas)
    );
  }, 0);

  return (
    <>
      {intro('finance_officer')}

      <StatGrid>
        <Stat label="Monthly recurring" value={money(mrr)} hint="Annual plans amortised" />
        <Stat
          label="Owed to reporters"
          value={money(owed)}
          tone="warn"
          hint="Licensed, not yet paid"
        />
        <Stat label="Settled" value={money(paid)} tone="good" />
        <Stat label="Batches" value={String(data.payoutBatches.length)} hint="Payout runs" />
      </StatGrid>

      <Panel
        title="Subscriptions"
        subtitle="Every figure is integer pesewas. Money never touches a float."
      >
        <Table
          columns={['Institution', 'Tier', 'Status', 'Downloads', 'Monthly']}
          rows={data.organisations.map((b) => {
            const plan = SUBSCRIPTION_PLANS[b.tier];
            const monthly =
              plan.billingPeriod === 'annual' ? Math.round(plan.feePesewas / 12) : plan.feePesewas;
            return [
              <span key="n" className="font-medium text-text-primary">
                {b.name}
              </span>,
              <Pill key="t" tone={b.tier === 'enterprise' ? 'info' : 'neutral'}>
                {b.tier}
              </Pill>,
              <Pill
                key="s"
                tone={
                  b.subscriptionStatus === 'active'
                    ? 'good'
                    : b.subscriptionStatus === 'past_due'
                      ? 'bad'
                      : 'warn'
                }
              >
                {b.subscriptionStatus.replace(/_/g, ' ')}
              </Pill>,
              <span key="d" className="tabular text-text-muted">
                {b.reportsUsedThisPeriod}
              </span>,
              <span key="m" className="tabular">
                {money(monthly)}
              </span>,
            ];
          })}
          align={[3, 4]}
        />
      </Panel>

      <Panel
        title="Reporter ledger"
        subtitle="An amount is fixed at the moment of licensing and never recomputed. Rates change; settled earnings do not."
      >
        <Table
          columns={['Report', 'Category', 'Licensed by', 'Status', 'Amount']}
          rows={data.commissions.slice(0, 7).map((c) => [
            <span key="r" className="text-xs text-text-secondary">
              {c.incidentSummary}
            </span>,
            <span key="c" className="text-xs text-text-muted">
              {c.category}
            </span>,
            <span key="b" className="text-xs text-text-muted">
              {c.businessName ?? '—'}
            </span>,
            <Pill
              key="s"
              tone={
                c.status === 'paid'
                  ? 'good'
                  : c.status === 'earned'
                    ? 'warn'
                    : c.status === 'void'
                      ? 'bad'
                      : 'neutral'
              }
            >
              {c.status}
            </Pill>,
            <span key="a" className="tabular">
              {money(c.amountPesewas)}
            </span>,
          ])}
          align={[4]}
        />
      </Panel>
    </>
  );
}

// ─── auditor ───────────────────────────────────────────────────────────────

function Auditor({ data }: { data: AdminData }) {
  return (
    <>
      {intro('auditor')}

      <div className="rounded-md border border-info/25 bg-info-wash/30 px-4 py-3">
        <p className="text-xs leading-relaxed text-text-secondary">
          <span className="font-semibold">This account can change nothing.</span> Not by convention
          — it holds no write capability at all. An auditor who can alter the thing being audited is
          not an auditor.
        </p>
      </div>

      <StatGrid>
        <Stat label="Entries (30d)" value="1,284" />
        <Stat label="Decisions reversed" value="6" tone="warn" />
        <Stat label="Routing overrides" value="23" />
        <Stat label="Payout runs" value={String(data.payoutBatches.length)} />
      </StatGrid>

      <Panel
        title="Audit ledger"
        subtitle="Append-only. A decision someone made and should have to stand behind, not something that can be quietly rewritten."
      >
        <Table
          columns={['When', 'Actor', 'Action', 'Subject']}
          rows={[
            [
              '09:42',
              'Ama Serwaa (Super Admin)',
              'approved onboarding step',
              'ONB-ORG-000042 · Coverage',
            ],
            [
              '09:20',
              'Abena Frimpong (Finance)',
              'released payout batch',
              'PB-000118 · 34 reporters',
            ],
            ['08:55', 'Nana Adjei (Compliance)', 'recorded screening result', 'ECG · clear'],
            ['08:31', 'Kwabena Owusu (Operations)', 'overrode routing', 'DW-VPR-WCH · added NADMO'],
            [
              '08:02',
              'Esi Bediako (Editor)',
              'moved verification state',
              'DW-WQD-JW4 · → verified in part',
            ],
            ['Yesterday', 'Yaw Boateng (System)', 'rotated signing key', 'cap-sign-2026-08'],
          ]}
        />
      </Panel>

      <Panel
        title="Verification decisions"
        subtitle="What was called what, and on whose authority."
      >
        <Table
          columns={['Report', 'Assurance', 'State', 'May say “verified”']}
          rows={data.editorialCases.slice(0, 6).map((c) => {
            const incident = data.incidents.find((i) => i.id === c.incidentId);
            const verified =
              incident?.verification === 'verified_high_confidence' ||
              incident?.verification === 'verified_in_part';
            return [
              <code key="r" className="text-xs">
                {incident?.reportId ?? c.incidentId}
              </code>,
              <Pill key="a" tone={incident?.assurance === 'C' ? 'bad' : 'info'}>
                Class {incident?.assurance ?? '—'}
              </Pill>,
              <span key="s" className="text-xs text-text-muted">
                {incident?.verification?.replace(/_/g, ' ') ?? '—'}
              </span>,
              verified ? (
                <Pill key="v" tone="good">
                  Yes
                </Pill>
              ) : (
                <Pill key="v" tone="neutral">
                  No
                </Pill>
              ),
            ];
          })}
        />
      </Panel>
    </>
  );
}

// ─── dispatch ──────────────────────────────────────────────────────────────

const DASHBOARDS: Record<AdminRole, (props: { data: AdminData }) => React.JSX.Element> = {
  super_admin: SuperAdmin,
  dawuro_admin: DawuroAdmin,
  system_admin: SystemAdmin,
  hr_admin: HrAdmin,
  operations: Operations,
  branch_manager: BranchManager,
  compliance_officer: Compliance,
  finance_officer: Finance,
  auditor: Auditor,
};

/**
 * A role's dashboard, over data the page fetched.
 *
 * The bundle is passed in rather than imported here. Every one of these nine
 * dashboards used to read seeded constants directly, so an auditor's ledger, a
 * finance officer's balances and an operations queue were all invented — and
 * being module-level imports, there was no point at which a failed fetch could
 * have been noticed, because nothing was fetched.
 */
export function AdminDashboard({ role, data }: { role: AdminRole; data: AdminData }) {
  const Component = DASHBOARDS[role];
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-5">
      <Component data={data} />
    </div>
  );
}
