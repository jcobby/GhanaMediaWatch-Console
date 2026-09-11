import { redirect } from 'next/navigation';
import {
  ONBOARDING_STEPS,
  SUBSCRIPTION_PLANS,
  approvalProblem,
  formatCedis,
  roleCan,
  stepState,
  type OrganisationAccount,
  type OrganisationApplication,
  type OnboardingApplication,
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
import { RowAction, RowActions } from '@/components/admin/RowAction';
import { requireSession } from '@/lib/session';
import { NotWired, Outage, load } from '@/components/ui';
import { platform } from '@/lib/consoleApi';

const PROBLEM_LABEL: Record<string, string> = {
  not_submitted: 'Applicant still working',
  steps_not_approved: 'Steps awaiting review',
  screening_not_run: 'Screening not run',
  screening_not_clear: 'Screening returned a hit',
  already_approved: 'Approved',
};

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'approve_institutions')) redirect('/');

  /*
   * Who is on the platform, and who is still asking to be.
   *
   * Both come from the backend. An approval decision made against a seeded
   * application would approve nothing, while telling the operator it had.
   */
  const result = await load(async () => {
    const [organisations, applications] = await Promise.all([
      platform.organisations<OrganisationAccount>(),
      platform.applications<OnboardingApplication>(),
    ]);
    return { organisations, applications };
  });

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Institutions"
          blurb="Every organisation on the platform, and where its application stands."
        />
        <NotWired what="Approving an institution" />
        <Outage error={result.error} retryHref="/admin/institutions" />
      </PageShell>
    );
  }

  const ORGANISATIONS = result.data.organisations;
  const ONBOARDING_APPLICATIONS = result.data.applications;
  /*
   * The same list, read as enquiries.
   *
   * The API has one applications endpoint; the two fixtures this page used —
   * `ORGANISATION_APPLICATIONS` and `ONBOARDING_APPLICATIONS` — were two views of
   * the same thing. Everything that has not been approved is still an enquiry.
   */
  const ORGANISATION_APPLICATIONS = result.data.applications.filter(
    (a) => !a.approvedAtIso,
  ) as unknown as OrganisationApplication[];
  const live = ORGANISATIONS.filter(
    (b) => b.subscriptionStatus === 'active' || b.subscriptionStatus === 'trialing',
  );
  const pending = ONBOARDING_APPLICATIONS.filter((a) => !a.approvedAtIso);
  const readyNow = pending.filter((a) => approvalProblem(a) === null);

  return (
    <PageShell>
      <PageIntro
        title="Institutions"
        blurb="Every organisation on the platform, and where its application stands."
      />

      <StatGrid>
        <Stat label="On the platform" value={String(ORGANISATIONS.length)} />
        <Stat label="Receiving reports" value={String(live.length)} tone="good" />
        <Stat
          label="In onboarding"
          value={String(pending.length)}
          tone={pending.length ? 'warn' : 'neutral'}
        />
        <Stat
          label="Ready to approve"
          value={String(readyNow.length)}
          tone={readyNow.length ? 'good' : 'neutral'}
          hint="Every step approved, screening clear"
        />
      </StatGrid>

      <Panel
        title="Onboarding"
        subtitle="Approval needs every step approved and screening run and clear — no single click reaches it."
      >
        <Table
          columns={['Organisation', 'Reference', 'Steps', 'Screening', 'Blocked on', '']}
          rows={ONBOARDING_APPLICATIONS.map((a) => {
            const approved = ONBOARDING_STEPS.filter(
              (s) => stepState(a, s.id).status === 'approved',
            ).length;
            const problem = approvalProblem(a);
            return [
              <span key="o" className="font-medium text-text-primary">
                {a.organisationName}
              </span>,
              <code key="r" className="text-xs text-text-muted">
                {a.reference}
              </code>,
              <span
                key="s"
                className={
                  approved === ONBOARDING_STEPS.length
                    ? 'tabular text-success'
                    : 'tabular text-text-muted'
                }
              >
                {approved} / {ONBOARDING_STEPS.length}
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
              problem === null ? (
                <Pill key="p" tone="good">
                  Nothing
                </Pill>
              ) : (
                <span key="p" className="text-xs text-text-muted">
                  {PROBLEM_LABEL[problem] ?? problem}
                </span>
              ),
              <RowActions key="a">
                {a.screeningRunAtIso === null ? (
                  <RowAction label="Run screening" done="Screening run" />
                ) : null}
                <RowAction
                  label="Approve"
                  done="Approved"
                  tone="primary"
                  confirm="Grant access to public footage?"
                  disabled={problem !== null}
                  disabledReason={problem ? (PROBLEM_LABEL[problem] ?? problem) : undefined}
                />
              </RowActions>,
            ];
          })}
          align={[2, 5]}
          rowHref={(i) => {
            const a = ONBOARDING_APPLICATIONS[i];
            return a ? `/platform/approvals` : undefined;
          }}
        />
      </Panel>

      <Panel title="Live accounts" subtitle="What each is on, and how much of it they are using.">
        <Table
          columns={['Organisation', 'Sector', 'Tier', 'Status', 'Seats', 'Downloads', 'Fee']}
          rows={ORGANISATIONS.map((b) => {
            const plan = SUBSCRIPTION_PLANS[b.tier];
            return [
              <span key="n" className="font-medium text-text-primary">
                {b.name}
              </span>,
              <span key="s" className="text-xs text-text-muted">
                {b.sector}
              </span>,
              <Pill key="t" tone={b.tier === 'enterprise' ? 'info' : 'neutral'}>
                {b.tier}
              </Pill>,
              <Pill
                key="st"
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
              <span key="se" className="tabular text-text-muted">
                {b.seatsUsed} / {plan.seats}
              </span>,
              <span key="d" className="tabular text-text-muted">
                {b.reportsUsedThisPeriod}
              </span>,
              <span key="f" className="tabular">
                {formatCedis(plan.feePesewas)}
              </span>,
            ];
          })}
          align={[4, 5, 6]}
        />
      </Panel>

      {ORGANISATION_APPLICATIONS.length > 0 ? (
        <Panel title="New enquiries" subtitle="Registered, not yet through onboarding.">
          <Table
            columns={['Organisation', 'Sector', 'Contact', 'Wants', 'Status']}
            rows={ORGANISATION_APPLICATIONS.map((a) => [
              <span key="o" className="font-medium text-text-primary">
                {a.organisationName}
              </span>,
              <span key="s" className="text-xs text-text-muted">
                {a.sector}
              </span>,
              <span key="c" className="text-xs text-text-muted">
                {a.contactName}
              </span>,
              <Pill key="t">{a.requestedTier}</Pill>,
              <Pill key="st" tone={a.status === 'pending' ? 'warn' : 'good'}>
                {a.status}
              </Pill>,
            ])}
          />
        </Panel>
      ) : null}

      <Note tone="warn">
        Approval is what grants an organisation access to footage of the public. It is the one
        decision in the product deliberately placed beyond the reach of a single click — the
        applicant submits, the platform approves, and never the same person for both.
      </Note>
    </PageShell>
  );
}
