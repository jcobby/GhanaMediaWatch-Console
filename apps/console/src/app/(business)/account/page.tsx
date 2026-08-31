import { Building2, CreditCard, Users } from 'lucide-react';
import {
  BUSINESSES,
  BRANCHES,
  EMPLOYEES,
  CATEGORY_META,
  annualCost,
  downloadCharge,
  formatCedis,
  isUnlimited,
  planFor,
} from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Badge, Panel } from '@/components/ui';
import { requireSession } from '@/lib/session';

/**
 * The organisation's own account.
 *
 * Spend leads, because it is the only number here that changes what they pay
 * next month. Interests sit beside it: together those two explain both the bill
 * and why the inbox looks the way it does, which is the question an officer
 * actually arrives with.
 */
export default async function Page() {
  const session = await requireSession();
  const business = BUSINESSES.find((b) => b.id === session.businessId) ?? BUSINESSES[1]!;
  const plan = planFor(business.tier);
  const uncapped = isUnlimited(plan);
  const perDownload = downloadCharge(plan);
  const spent = perDownload * business.reportsUsedThisPeriod;

  const staff = EMPLOYEES.filter((e) => e.businessId === business.id);
  const branches = BRANCHES.filter((b) => b.businessId === business.id);

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={business.name}
        description={`${plan.tier} plan · ${business.sector}`}
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
              value={String(business.reportsUsedThisPeriod)}
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
              {business.interests.map((c) => (
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
              {formatCedis(annualCost(plan, business.reportsUsedThisPeriod * 12))}
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
            <Badge tone={business.verified ? 'success' : 'warning'}>
              {business.verified ? 'Verified' : 'Unverified'}
            </Badge>
            <p className="text-xs text-text-muted">
              {business.verified
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
