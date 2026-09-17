'use client';

import { useMemo, useState } from 'react';
import { Building2, Search, Users, Download, AlertCircle } from 'lucide-react';
import {
  downloadCharge,
  formatCedis,
  isUnlimited,
  planFor,
  type OrganisationAccount,
  type Employee,
} from '@dawuro/core';
import { Badge, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

type SubStatus = OrganisationAccount['subscriptionStatus'];

const STATUS: Record<
  SubStatus,
  { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }
> = {
  active: { label: 'Active', tone: 'success' },
  trialing: { label: 'Trial', tone: 'info' },
  past_due: { label: 'Past due', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

type SortKey = 'revenue' | 'name' | 'downloads';

/**
 * Every organisation on the platform.
 *
 * The operator's question here is rarely "who exists" — it is "who is worth
 * attention". Two kinds of organisation qualify: the ones about to stop paying,
 * and the ones with nobody on the platform to act on what they receive.
 *
 * The second is easy to miss and quietly fatal. An organisation with no staff
 * still receives reports into a shared inbox that nobody is assigned to and
 * nobody opens. It looks like a healthy customer right up until it churns, so
 * it is flagged here rather than left to be discovered.
 */
export function OrganisationsWorkspace({
  organisations,
  employees,
}: {
  organisations: OrganisationAccount[];
  employees: Employee[];
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('revenue');
  /*
   * Which organisation the operator has opened. Onboarding detail is expensive
   * to read across a whole list, and only ever wanted for one at a time.
   */
  const [openId, setOpenId] = useState<string | null>(null);

  const staffCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of employees) counts.set(e.businessId, (counts.get(e.businessId) ?? 0) + 1);
    return counts;
  }, [employees]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const mapped = organisations
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.sector.toLowerCase().includes(q))
      .map((b) => {
        const plan = planFor(b.tier);
        // What this organisation is actually worth per period: the recurring
        // fee plus whatever its downloads have added.
        /*
         * An organisation on a tier this console does not price contributes
         * nothing rather than crashing the whole table. One unrecognised row
         * must not take the other forty with it.
         */
        const periodRevenue = plan
          ? plan.feePesewas + (downloadCharge(plan) ?? 0) * b.reportsUsedThisPeriod
          : 0;
        return {
          organisation: b,
          plan,
          periodRevenue,
          staff: staffCount.get(b.id) ?? 0,
        };
      });

    return mapped.sort((a, b) => {
      if (sort === 'name') return a.organisation.name.localeCompare(b.organisation.name);
      if (sort === 'downloads')
        return b.organisation.reportsUsedThisPeriod - a.organisation.reportsUsedThisPeriod;
      return b.periodRevenue - a.periodRevenue;
    });
  }, [organisations, query, sort, staffCount]);

  const totalRevenue = rows.reduce((sum, r) => sum + r.periodRevenue, 0);
  const unstaffed = rows.filter((r) => r.staff === 0).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 px-7 py-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Organisations" value={String(rows.length)} />
          <Metric label="Recurring this period" value={formatCedis(totalRevenue)} />
          <Metric
            label="With no staff"
            value={String(unstaffed)}
            tone={unstaffed > 0 ? 'warning' : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-0.5 rounded-sm bg-canvas-raise/70 p-0.5">
            {(
              [
                ['revenue', 'Revenue'],
                ['downloads', 'Downloads'],
                ['name', 'Name'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                aria-pressed={sort === key}
                className={cn(
                  'rounded-xs px-3 py-1.5 text-xs transition',
                  sort === key
                    ? 'bg-canvas-soft font-medium text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or sector"
              aria-label="Search organisations"
              className="h-8 w-full rounded-sm border border-hairline/12 bg-canvas-soft pl-8 pr-2.5 text-xs placeholder:text-text-faint focus:border-accent"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {rows.length === 0 ? (
            <Panel className="p-8 text-center text-xs text-text-faint">
              No organisation matches that.
            </Panel>
          ) : (
            rows.map(({ organisation, plan, periodRevenue, staff }) => {
              const status = STATUS[organisation.subscriptionStatus];
              const open = openId === organisation.id;
              return (
                <Panel key={organisation.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : organisation.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3.5 p-3.5 text-left transition hover:bg-canvas-raise/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-canvas-raise">
                      <Building2 className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{organisation.name}</p>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <span className="rounded-pill bg-canvas-raise px-2 py-px text-2xs capitalize text-text-muted">
                          {organisation.tier}
                        </span>
                        {/* The quiet failure: receiving reports with nobody to
                          act on them. Flagged before it becomes churn. */}
                        {staff === 0 ? (
                          <span className="flex items-center gap-1 text-2xs text-warning">
                            <AlertCircle className="h-3 w-3" />
                            No staff
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-2xs capitalize text-text-faint">
                        {organisation.sector} · {organisation.interests.length} categories
                      </p>
                    </div>

                    <div className="hidden shrink-0 items-center gap-6 sm:flex">
                      <Stat
                        icon={<Users className="h-3 w-3" />}
                        value={String(staff)}
                        label="staff"
                        tone={staff === 0 ? 'warning' : undefined}
                      />
                      <Stat
                        icon={<Download className="h-3 w-3" />}
                        value={String(organisation.reportsUsedThisPeriod)}
                        label={isUnlimited(plan) ? 'unlimited' : 'downloads'}
                      />
                      <div className="w-24 text-right">
                        <p className="tabular text-sm font-semibold">
                          {formatCedis(periodRevenue)}
                        </p>
                        <p className="text-2xs text-text-faint">
                          {plan ? `per ${plan.billingPeriod === 'annual' ? 'year' : 'month'}` : '—'}
                        </p>
                      </div>
                    </div>
                  </button>
                </Panel>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <Panel className="p-4">
      <p className="text-2xs uppercase tracking-wider text-text-faint">{label}</p>
      <p
        className={cn(
          'tabular mt-1.5 text-xl font-semibold tracking-[-0.01em]',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </p>
    </Panel>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone?: 'warning';
}) {
  return (
    <div className="text-right">
      <p
        className={cn(
          'tabular flex items-center justify-end gap-1 text-xs font-medium',
          tone === 'warning' && 'text-warning',
        )}
      >
        {icon}
        {value}
      </p>
      <p className="text-2xs text-text-faint">{label}</p>
    </div>
  );
}
