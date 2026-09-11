import { Building2, CreditCard, Users } from 'lucide-react';
import {
  CATEGORY_META,
  annualCost,
  downloadCharge,
  formatCedis,
  isUnlimited,
  planFor,
  type Branch,
  type OrganisationAccount,
  type Employee,
} from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { PlanUnavailable } from '@/components/PlanUnavailable';
import { Badge, Panel, load } from '@/components/ui';
import { org } from '@/lib/consoleApi';

/**
 * The organisation's own account.
 *
 * Spend leads, because it is the only number here that changes what they pay
 * next month. Interests sit beside it: together those two explain both the bill
 * and why the inbox looks the way it does, which is the question an officer
 * actually arrives with.
 */
export default async function Page() {
  const result = await load(async () => {
    const organisation = await org.current<OrganisationAccount>();
    const [staff, branches] = await Promise.all([
      org.employees<Employee>(),
      org.branches<Branch>(),
    ]);
    return { organisation, staff, branches };
  });

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Account" title="Your organisation" />
        <OrganisationOutage error={result.error} retryHref="/account" />
      </>
    );
  }

  const { organisation, staff, branches } = result.data;
  const plan = planFor(organisation.tier);

  /*
   * Every figure below is a price. Without a plan there is nothing honest to
   * print — a zero would read as "free" and a default tier as "this is what you
   * are on", and an organisation could act on either.
   */
  if (!plan) return <PlanUnavailable what="your fee, seats and charges" />;

  const uncapped = isUnlimited(plan);
  const perDownload = downloadCharge(plan) ?? 0;
  // Integer pesewas throughout — never a float, and never rounded here.
  const spent = perDownload * organisation.reportsUsedThisPeriod;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={organisation.name}
        description={`${plan.tier} plan · ${organisation.sector}`}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-7 py-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              icon={<CreditCard className="h-3.5 w-3.5" />}
              label={plan.billingPeriod === 'annual' ? 'Annual fee' : 'Monthly fee'}
              value={formatCedis(plan.feePesewas)}
            />
            <Stat
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Downloads this period"
              value={String(organisation.reportsUsedThisPeriod)}
              suffix={uncapped ? 'included' : `${formatCedis(spent)} charged`}
            />
            <Stat
              icon={<Users className="h-3.5 w-3.5" />}
              label="Seats"
              value={`${staff.length} / ${plan.seats}`}
            />
          </div>

          <Panel className="p-5">
            <h2 className="text-sm font-semibold">What reaches your inbox</h2>
            <p className="mt-1 text-xs text-text-muted">
              Reports in these categories are routed to you automatically.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {organisation.interests.map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1.5 rounded-pill bg-canvas-raise px-2.5 py-1 text-xs"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-pill"
                    style={{ backgroundColor: CATEGORY_META[c]?.hue }}
                  />
                  {CATEGORY_META[c]?.label ?? c}
                </span>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <h2 className="text-sm font-semibold">Cost at your current rate</h2>
            <p className="mt-1 text-xs text-text-muted">
              {uncapped
                ? 'Your annual plan covers unlimited downloads.'
                : `${formatCedis(perDownload)} per download on top of the subscription.`}
            </p>
            <p className="tabular mt-3 text-2xl font-semibold tracking-[-0.02em]">
              {formatCedis(annualCost(plan, organisation.reportsUsedThisPeriod * 12))}
            </p>
            <p className="text-2xs text-text-faint">
              projected for a year at this month&rsquo;s volume
            </p>
          </Panel>

          <Panel className="p-5">
            <h2 className="text-sm font-semibold">Branches</h2>
            <div className="mt-3 space-y-1.5">
              {branches.length === 0 ? (
                <p className="text-xs text-text-muted">
                  No branches yet. Areas decide which incidents can reach your staff.
                </p>
              ) : (
                branches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-text-muted">
                      {b.areaLabel} · {(b.jurisdictionRadiusM / 1000).toFixed(0)} km
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel className="flex items-center gap-3 p-4">
            <Badge tone={organisation.verified ? 'success' : 'warning'}>
              {organisation.verified ? 'Verified' : 'Unverified'}
            </Badge>
            <p className="text-xs text-text-muted">
              {organisation.verified
                ? 'Your registration has been checked against the public register.'
                : 'A platform operator is still checking your registration.'}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <Panel className="p-4">
      <p className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-text-faint">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1.5 text-xl font-semibold tracking-[-0.01em]">{value}</p>
      {suffix ? <p className="text-2xs text-text-muted">{suffix}</p> : null}
    </Panel>
  );
}
