import { redirect } from 'next/navigation';
import { VERIFICATION_META, VERIFICATION_STATES, roleCan } from '@dawuro/core';
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
import { platform } from '@/lib/consoleApi';

/**
 * How long footage survives.
 *
 * Windows are keyed off verification state rather than age alone, because what
 * a report turned out to be is the thing that decides how long it is worth
 * keeping. A rejected submission and a published one are not the same object.
 *
 * Simulated — the retention schedule is an open decision in the backend spec.
 */
const WINDOW_DAYS: Record<string, number | null> = {
  received_unreviewed: 90,
  integrity_passed: 365,
  integrity_flagged: 365,
  corroboration_in_progress: 365,
  verified_high_confidence: null,
  verified_in_part: null,
  disputed: 1095,
  rejected: 30,
};

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'manage_retention')) redirect('/');

  /*
   * What is actually exempt from deletion, and what is due for it.
   *
   * A legal hold is the one thing on this page with legal weight: it is what
   * stops footage being purged while a dispute or a request under Act 843 is
   * open. Two invented holds meant an operator could believe evidence was
   * protected when nothing was holding it, and the retention sweep would have
   * deleted it on schedule.
   */
  const result = await load(async () => {
    const holds = await platform.legalHolds<LegalHold>();
    const inventory = await platform.retentionInventory<RetentionInventory>().catch(() => null);
    return { holds, inventory };
  });

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Retention"
          blurb="How long footage survives, and what a reporter sees once it does not."
        />
        <Outage error={result.error} retryHref="/admin/retention" />
      </PageShell>
    );
  }

  const HOLDS = result.data.holds;
  const inventory = result.data.inventory;

  return (
    <PageShell>
      <PageIntro
        title="Retention"
        blurb="How long footage survives, and what a reporter sees once it does not."
      />

      <StatGrid>
        {/*
          These three were the literals "2.4 TB", "14 mo" and "1,208" — numbers
          that never moved and described nothing. They come from the retention
          inventory now, and read as unknown when it cannot be fetched rather
          than as a figure somebody might act on.
        */}
        <Stat label="Originals held" value={inventory?.originalsHeld ?? 'Not available'} />
        <Stat label="Oldest original" value={inventory?.oldestOriginal ?? 'Not available'} />
        <Stat
          label="Due for deletion"
          value={
            inventory?.dueForDeletion === undefined
              ? 'Not available'
              : String(inventory.dueForDeletion)
          }
          hint="Next 30 days"
        />
        <Stat
          label="Legal holds"
          value={String(HOLDS.length)}
          tone="warn"
          hint="Exempt from the schedule"
        />
      </StatGrid>

      <Panel
        title="Windows by verification state"
        subtitle="Keyed off what a report turned out to be, not merely how old it is."
      >
        <Table
          empty="No legal holds. Reports follow the retention schedule unless somebody places one."
          columns={['State', 'Keep for', 'Publishable', 'Rationale']}
          rows={VERIFICATION_STATES.map((state) => {
            const days = WINDOW_DAYS[state] ?? null;
            const meta = VERIFICATION_META[state];
            return [
              <span key="s" className="whitespace-nowrap font-medium text-text-primary">
                {meta.label}
              </span>,
              days === null ? (
                <Pill key="d" tone="info">
                  Indefinite
                </Pill>
              ) : (
                <span key="d" className="tabular">
                  {days >= 365 ? `${Math.round(days / 365)} yr` : `${days} d`}
                </span>
              ),
              meta.publishable ? (
                <Pill key="p" tone="good">
                  Yes
                </Pill>
              ) : (
                <Pill key="p">No</Pill>
              ),
              <span key="r" className="text-xs text-text-muted">
                {state === 'rejected'
                  ? 'Restricted audit retention only'
                  : days === null
                    ? 'Published work must remain checkable'
                    : 'Long enough to reopen, short enough to not hoard'}
              </span>,
            ];
          })}
          align={[1]}
        />
      </Panel>

      <Panel title="Legal holds" subtitle="These override the schedule entirely until lifted.">
        <Table
          columns={['Report', 'Reason', 'Held for']}
          rows={HOLDS.map((h) => [
            <code key="r" className="text-xs">
              {h.reference}
            </code>,
            <span key="w" className="text-xs text-text-secondary">
              {h.reason}
            </span>,
            <span key="s" className="text-xs text-text-muted">
              {h.since}
            </span>,
          ])}
        />
      </Panel>

      <Note tone="warn">
        Deletion is not an internal detail. The mobile app removes its local copy once the server
        confirms an upload, keeping only the metadata row — so when media expires here, a
        reporter&rsquo;s own history points at something that no longer exists. Whatever this
        schedule decides, the phone has to be able to say so honestly.
      </Note>
    </PageShell>
  );
}

/** A report exempted from the retention schedule. */
interface LegalHold {
  reference: string;
  reason: string;
  since: string;
}

/**
 * The retention inventory, as far as this page renders it.
 *
 * Every field is optional: the endpoint's shape is not pinned in
 * `@dawuro/core`, and a figure this console cannot source is shown as
 * unavailable rather than guessed.
 */
interface RetentionInventory {
  originalsHeld?: string;
  oldestOriginal?: string;
  dueForDeletion?: number;
}
