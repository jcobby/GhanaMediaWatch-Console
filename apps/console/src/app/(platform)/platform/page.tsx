import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, Share2, BadgeCheck } from 'lucide-react';
import { formatCedis, formatRelativeTime } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Panel, Outage, load } from '@/components/ui';
import { platform } from '@/lib/consoleApi';
import { normaliseOnboarding } from '@/lib/onboarding';
import { normaliseMetrics, type DayCount, type PlatformMetrics } from '@/lib/metrics';

/**
 * The operator's console.
 *
 * Leads with what needs a person: the two queues someone is accountable for
 * draining. Then the platform's volume and revenue, from `/platform/metrics`.
 */
export default async function PlatformConsole() {
  const result = await load(async () => {
    const [queue, applications, metrics] = await Promise.all([
      platform.routing(),
      platform.applications<Record<string, unknown>>(),
      /*
       * Soft. The queues are the work; the figures are context. A metrics
       * outage says so in its own panel rather than taking the queues with it.
       */
      platform
        .metrics<unknown>()
        .then(normaliseMetrics)
        .catch(() => null),
    ]);
    return {
      awaitingRouting: queue.filter((r) => r.status === 'awaiting_routing'),
      /*
       * Waiting on a person: sent for review and not yet approved. A draft is
       * somebody still typing, and counting it would send the owner to a queue
       * with nothing to decide.
       */
      awaitingApproval: applications.filter(
        (a) => a.status === 'pending' || (Boolean(a.submittedAtIso) && !a.approvedAtIso),
      ),
      metrics,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Operations"
        description="Reports route automatically. These are the ones that need a person."
      />

      {!result.ok ? (
        <Outage error={result.error} retryHref="/platform" />
      ) : (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-7">
          {/* Queues first — the only things here that are anyone's job today. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <QueueCard
              href="/platform/routing"
              icon={<Share2 className="h-4 w-4" strokeWidth={2} />}
              label="Awaiting routing"
              count={result.data.awaitingRouting.length}
              detail={oldestWaiting(result.data.awaitingRouting)}
              urgent={result.data.awaitingRouting.length > 0}
            />
            <QueueCard
              href="/platform/approvals"
              icon={<BadgeCheck className="h-4 w-4" strokeWidth={2} />}
              label="Organisations awaiting approval"
              count={result.data.awaitingApproval.length}
              detail={
                result.data.awaitingApproval[0]
                  ? normaliseOnboarding(result.data.awaitingApproval[0]).application
                      .organisationName || 'An organisation'
                  : 'Nothing waiting'
              }
              urgent={result.data.awaitingApproval.length > 0}
            />
          </div>

          {result.data.metrics ? (
            <Figures metrics={result.data.metrics} />
          ) : (
            <Panel className="p-5">
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                Volume and revenue
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                The figures could not be read just now. The two queues above are live.
              </p>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

/** "—" for a figure the service did not report. Never a zero standing in for one. */
const num = (value: number | null) => (value === null ? '—' : value.toLocaleString('en-GB'));
const money = (value: number | null) => (value === null ? '—' : formatCedis(value));

function Figures({ metrics }: { metrics: PlatformMetrics }) {
  const measured = formatRelativeTime(metrics.generatedAtIso);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          Volume and revenue
        </h2>
        {measured ? <p className="text-2xs text-text-faint">Measured {measured}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label="Reports today" value={num(metrics.submissionsToday)} />
        <Figure
          label="Waiting for review"
          value={num(metrics.pendingReview)}
          warn={(metrics.pendingReview ?? 0) > 0}
        />
        <Figure
          label="Published"
          value={num(metrics.published)}
          hint={metrics.submissionsTotal !== null ? `of ${num(metrics.submissionsTotal)} filed` : undefined}
        />
        <Figure
          label="Active organisations"
          value={num(metrics.organisationsActive)}
          hint={
            metrics.organisationsTotal !== null
              ? `of ${num(metrics.organisationsTotal)} registered`
              : undefined
          }
        />
        <Figure label="Revenue this month" value={money(metrics.revenueThisMonthPesewas)} />
        <Figure label="Subscriptions per month" value={money(metrics.subscriptionMrrPesewas)} />
        <Figure label="Download charges this period" value={money(metrics.downloadChargesPesewas)} />
        <Figure
          label="Paid to reporters this month"
          value={money(metrics.payoutsReleasedThisMonthPesewas)}
        />
      </div>

      <Panel className="p-5">
        <p className="text-xs font-medium text-text-secondary">Reports filed, last 14 days</p>
        <DailyChart days={metrics.last14Days} />
      </Panel>
    </section>
  );
}

function Figure({
  label,
  value,
  hint,
  warn = false,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  warn?: boolean;
}) {
  return (
    <Panel className="p-4">
      <p className="text-2xs uppercase tracking-wider text-text-faint">{label}</p>
      <p
        className={
          warn
            ? 'tabular mt-1.5 text-xl font-semibold text-warning'
            : 'tabular mt-1.5 text-xl font-semibold'
        }
      >
        {value}
      </p>
      {hint ? <p className="text-2xs text-text-muted">{hint}</p> : null}
    </Panel>
  );
}

/**
 * Fourteen bars on one scale.
 *
 * The tallest day sets the scale and is labelled with its count, so the height
 * of every other bar can be read against a real number rather than guessed.
 */
function DailyChart({ days }: { days: DayCount[] }) {
  if (days.length === 0) {
    return <p className="mt-3 text-xs text-text-muted">No daily figures were reported.</p>;
  }

  const max = Math.max(...days.map((d) => d.count));
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-2xs text-text-faint">
        <span>Busiest day: {max.toLocaleString('en-GB')}</span>
      </div>
      <div className="mt-2 flex h-28 items-end gap-1" role="img" aria-label="Reports filed per day over the last 14 days">
        {days.map((day) => (
          <div
            key={day.date}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${label(day.date)}: ${day.count}`}
          >
            <div
              className={day.count === max && max > 0 ? 'rounded-t-xs bg-accent' : 'rounded-t-xs bg-accent/45'}
              style={{ height: max > 0 ? `${Math.max(2, (day.count / max) * 100)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-2xs text-text-faint">
        <span>{label(days[0]!.date)}</span>
        <span>{label(days[days.length - 1]!.date)}</span>
      </div>
    </div>
  );
}

/**
 * How long the oldest waiting report has been there, if that is knowable.
 *
 * Returns a whole sentence rather than a fragment to interpolate, so there is
 * no call site where a null can reach the screen.
 */
function oldestWaiting(queue: { submittedAtIso?: string }[]): string {
  if (queue.length === 0) return 'Queue is clear';
  const age = formatRelativeTime(queue[0]?.submittedAtIso ?? null);
  return age ? `Oldest ${age}` : 'Waiting times unavailable';
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
