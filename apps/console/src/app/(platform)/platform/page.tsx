import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, Share2, BadgeCheck } from 'lucide-react';
import { formatRelativeTime, type OrganisationApplication } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Panel, Outage, load } from '@/components/ui';
import { platform } from '@/lib/consoleApi';
import { applicationsAwaitingDecision } from '@/lib/applications';

/**
 * The operator's console.
 *
 * Leads with what needs a person: the two queues someone is accountable for
 * draining. Both are read from the backend, because a queue length is the one
 * number on this page that someone acts on this morning.
 */
export default async function PlatformConsole() {
  const result = await load(async () => {
    const [queue, applications, held] = await Promise.all([
      platform.routing(),
      platform.applications<OrganisationApplication>(),
      /*
       * Organisations that registered through this console.
       *
       * Counted here because this card is the only place anyone looks to find
       * out whether there is approval work waiting, and it read zero while real
       * newsrooms sat on `/onboarding` waiting to hear back. The backend cannot
       * be told about them yet — no endpoint files an application — so the
       * console holds them itself. See lib/applications.ts.
       */
      applicationsAwaitingDecision(),
    ]);
    return {
      awaitingRouting: queue.filter((r) => r.status === 'awaiting_routing'),
      pendingApplications: applications.filter((a) => a.status === 'pending'),
      held,
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
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-7 py-6">
          {/* Queues first — the only things here that are anyone's job today. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <QueueCard
              href="/platform/routing"
              icon={<Share2 className="h-4 w-4" strokeWidth={2} />}
              label="Awaiting routing"
              count={result.data.awaitingRouting.length}
              /*
                "Oldest null" was on screen.

                `formatRelativeTime` returns `string | null` — null for a date it
                cannot read — and interpolating that into a template literal
                stringifies it. The queue rows carry no `submittedAtIso`, so the
                card read "Oldest null" to an operator, which looks like a fault
                in the platform rather than a missing field.

                Checked before it is used, so an absent timestamp shows how many
                are waiting and simply says nothing about age.
              */
              detail={oldestWaiting(result.data.awaitingRouting)}
              urgent={result.data.awaitingRouting.length > 0}
            />
            <QueueCard
              href="/platform/approvals"
              icon={<BadgeCheck className="h-4 w-4" strokeWidth={2} />}
              label="Organisations awaiting approval"
              count={result.data.pendingApplications.length + result.data.held.length}
              detail={
                result.data.pendingApplications[0]?.organisationName ??
                result.data.held[0]?.organisationName ??
                'Nothing waiting'
              }
              urgent={result.data.pendingApplications.length + result.data.held.length > 0}
            />
          </div>

          {/*
            Volume, revenue and reach are absent rather than invented.

            This block used to render submissions today, revenue this month,
            payouts, active organisations and a fourteen-day trend — all from a
            seeded `PLATFORM_METRICS` constant. The API exposes no endpoint that
            can answer any of them: no metrics, no summary, no aggregate of any
            kind.

            Numbers on an operations console get quoted in meetings and put in
            board packs. Rendering seeded figures under real queue counts is how
            an invented revenue number ends up in front of the Ghana News Agency
            as fact, so the space says what is missing instead.
          */}
          <Panel className="p-5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
              Volume and revenue
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
              Not available yet. This console will not show figures it cannot verify, and these are
              not yet measured. The two queues above are live.
            </p>
          </Panel>
        </div>
      )}
    </>
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
