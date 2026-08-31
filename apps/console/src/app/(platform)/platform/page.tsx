import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, Share2, BadgeCheck } from 'lucide-react';
import {
  PLATFORM_METRICS,
  ROUTING_QUEUE,
  BUSINESS_APPLICATIONS,
  formatCedis,
  formatRelativeTime,
} from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Panel } from '@/components/ui';
import { Sparkline } from '@/components/Sparkline';

/**
 * The operator's console.
 *
 * Leads with what needs a person: the two queues someone is accountable for
 * draining. Volume and money come second — they describe the platform, but
 * nobody has to do anything about them this morning.
 */
export default async function PlatformConsole() {
  const awaitingRouting = ROUTING_QUEUE.filter((r) => r.status === 'awaiting_routing');
  const pendingApplications = BUSINESS_APPLICATIONS.filter((a) => a.status === 'pending');
  const m = PLATFORM_METRICS;

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Operations"
        description="Reports route automatically. These are the ones that need a person."
      />

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-7 py-6">
        {/* Queues first — the only things here that are anyone's job today. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <QueueCard
            href="/platform/routing"
            icon={<Share2 className="h-4 w-4" strokeWidth={2} />}
            label="Awaiting routing"
            count={awaitingRouting.length}
            detail={
              awaitingRouting[0]
                ? `Oldest ${formatRelativeTime(awaitingRouting[0].submittedAtIso)}`
                : 'Queue is clear'
            }
            urgent={awaitingRouting.length > 0}
          />
          <QueueCard
            href="/platform/approvals"
            icon={<BadgeCheck className="h-4 w-4" strokeWidth={2} />}
            label="Organisations awaiting approval"
            count={pendingApplications.length}
            detail={
              pendingApplications[0] ? pendingApplications[0].organisationName : 'Nothing waiting'
            }
            urgent={pendingApplications.length > 0}
          />
        </div>

        {/* Volume */}
        <Panel className="p-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                Submissions
              </p>
              <p className="tabular mt-1 text-2xl font-semibold">{m.reportsToday}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                today · {m.reportsRoutedToday} routed automatically
              </p>
            </div>
            <Sparkline values={m.submissionTrend} label="Submissions over the last fourteen days" />
          </div>
        </Panel>

        {/* Money and reach */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Revenue this month" value={formatCedis(m.revenueThisMonthPesewas)} />
          <Stat
            label="Paid to reporters"
            value={formatCedis(m.payoutsThisMonthPesewas)}
            hint="Same period"
          />
          <Stat label="Active organisations" value={String(m.activeBusinesses)} />
          <Stat label="Active reporters" value={m.activeReporters.toLocaleString('en-GH')} />
        </div>
      </div>
    </>
  );
}

function QueueCard({
  href,
  icon,
  label,
  count,
  detail,
  urgent,
}: {
  href: Route;
  icon: React.ReactNode;
  label: string;
  count: number;
  detail: string;
  urgent: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <Panel className="p-5 transition group-hover:border-accent/25 group-hover:shadow-sm">
        <div className="flex items-center gap-2">
          <span
            className={
              urgent
                ? 'flex h-7 w-7 items-center justify-center rounded-xs bg-accent-wash text-accent'
                : 'flex h-7 w-7 items-center justify-center rounded-xs bg-canvas-raise text-text-faint'
            }
          >
            {icon}
          </span>
          <p className="flex-1 text-xs font-medium text-text-secondary">{label}</p>
          <ArrowRight className="h-3.5 w-3.5 text-text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
        <p className="tabular mt-3 text-2xl font-semibold">{count}</p>
        <p className="mt-0.5 text-xs text-text-muted">{detail}</p>
      </Panel>
    </Link>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Panel className="p-4">
      <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">{label}</p>
      <p className="tabular mt-1.5 text-lg font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-2xs text-text-faint">{hint}</p> : null}
    </Panel>
  );
}
