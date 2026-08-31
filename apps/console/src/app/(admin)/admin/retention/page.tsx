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

const HOLDS = [
  {
    reference: 'DW-VPR-WCH',
    reason: 'Subject of a takedown request under Act 843',
    since: '4 days',
  },
  {
    reference: 'DW-DC9-VKM',
    reason: 'Cited in a licensed publication; dispute open',
    since: '11 days',
  },
];

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'manage_retention')) redirect('/');

  return (
    <PageShell>
      <PageIntro
        title="Retention"
        blurb="How long footage survives, and what a reporter sees once it does not."
      />

      <StatGrid>
        <Stat label="Originals held" value="2.4 TB" />
        <Stat label="Oldest original" value="14 mo" />
        <Stat label="Due for deletion" value="1,208" hint="Next 30 days" />
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
