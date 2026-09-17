import Link from 'next/link';
import type { Route } from 'next';
import { formatRelativeTime, verificationMeta, type Incident } from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { Panel, Outage, load } from '@/components/ui';
import { AssuranceBadge, VerificationBadge } from '@/components/TrustBadges';
import { editorial } from '@/lib/consoleApi';
import { mapWithLimit } from '@/lib/fanOut';
import { cn } from '@/lib/cn';
import { LeadToggle } from '../LeadToggle';

/**
 * Reports the desk has finished with.
 *
 * Kept visible rather than archived. A verification that cannot be found again
 * cannot be revisited when new evidence turns up, and "disputed" exists
 * precisely because that happens.
 *
 * **And where a published report is put on the top stories, or taken off.**
 * Triage lists only reports still waiting for a decision, so once something was
 * published there was no screen that could lead it. Every published row here
 * carries the control.
 *
 * **Filtered by where the story stands with readers.** One long list mixed
 * what is on the public feed with what was kept back, and an editor looking for
 * "what are readers seeing right now" had to read every badge. The filter lives
 * in the URL, so a view can be reloaded or shared.
 */

type Show = 'all' | 'feed' | 'off' | 'top';

const FILTERS: { id: Show; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'feed', label: 'On the feed' },
  { id: 'off', label: 'Not on the feed' },
  { id: 'top', label: 'Top stories' },
];

const onFeed = (incident: Incident) => incident.vettingState === 'published';

/** Leading the feed now: marked lead, published, and not past its end time. */
function isTopStory(incident: Incident, now: number): boolean {
  if (!onFeed(incident) || !incident.lead) return false;
  if (!incident.leadUntil) return true;
  const until = Date.parse(incident.leadUntil);
  return !Number.isFinite(until) || until > now;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show: requested } = await searchParams;
  const show: Show = FILTERS.some((f) => f.id === requested) ? (requested as Show) : 'all';

  /*
   * The server's own record of what it has decided, filled in per report.
   *
   * **This page said "Nothing decided yet." over five published reports.**
   * `GET /editorial/decided` answered with decision rows that name a report and
   * do not carry it, so a row without the report is completed from
   * `GET /editorial/{incidentId}`, and its own fields (section, lead) are kept
   * on top.
   */
  const result = await load(async () => {
    const rows = await editorial.decided<DecidedRow>();
    /*
     * One request per row that names a report without carrying it — a few at a
     * time rather than all at once. Fifty decided reports was fifty simultaneous
     * requests, which on its own exceeds what the service will take before it
     * locks this console out of every other page. A row past the deadline keeps
     * its own fields and is simply less complete, which is a state this page
     * already renders.
     */
    return mapWithLimit(rows, completeRow, { onSkipped: (row) => row });
  });

  /*
   * The rows, whatever shape they arrive in. All three readings are accepted,
   * and rows with no id are dropped — a bet on one shape once crashed the page.
   */
  const decided = result.ok
    ? result.data
        .map((row) => row.incident ?? row.report ?? (row as unknown as Incident))
        .filter((incident): incident is Incident => Boolean(incident?.id))
    : [];

  const now = Date.now();
  const matches: Record<Show, (incident: Incident) => boolean> = {
    all: () => true,
    feed: onFeed,
    off: (incident) => !onFeed(incident),
    top: (incident) => isTopStory(incident, now),
  };
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.id, decided.filter(matches[f.id]).length]),
  ) as Record<Show, number>;
  const shown = decided.filter(matches[show]);

  const EMPTY: Record<Show, string> = {
    all: 'Nothing decided yet.',
    feed: 'Nothing is on the public feed.',
    off: 'Every decided report is on the public feed.',
    top: 'No story is leading the feed. Put a published report on the top stories from its row.',
  };

  return (
    <>
      <PageHeader
        eyebrow="Editorial"
        title="Decided"
        description="Closed cases, kept so they can be reopened. Published reports can be put on the top stories from here."
      />
      {!result.ok ? (
        <Outage error={result.error} retryHref="/editorial/decided" />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-7">
            <nav aria-label="Filter decided reports" className="flex flex-wrap gap-1.5">
              {FILTERS.map((filter) => {
                const active = filter.id === show;
                return (
                  <Link
                    key={filter.id}
                    href={
                      (filter.id === 'all'
                        ? '/editorial/decided'
                        : `/editorial/decided?show=${filter.id}`) as Route
                    }
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs transition',
                      active
                        ? 'border-accent bg-accent-wash font-medium text-accent'
                        : 'border-hairline/12 text-text-muted hover:border-accent/30 hover:text-text-primary',
                    )}
                  >
                    {filter.label}
                    <span
                      className={cn(
                        'tabular rounded-pill px-1.5 text-2xs',
                        active ? 'bg-accent/15' : 'bg-canvas-raise',
                      )}
                    >
                      {counts[filter.id]}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-1.5">
              {shown.length === 0 ? (
                <Panel className="p-10 text-center text-sm text-text-muted">{EMPTY[show]}</Panel>
              ) : (
                shown.map((incident) => (
                  <Panel key={incident.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {incident.reportId ? (
                        <span className="rounded-xs bg-canvas-raise px-1.5 py-0.5 font-mono text-2xs">
                          {incident.reportId}
                        </span>
                      ) : null}
                      {incident.assurance ? (
                        <AssuranceBadge assurance={incident.assurance} showLabel={false} />
                      ) : null}
                      {incident.verification ? (
                        <VerificationBadge state={incident.verification} />
                      ) : null}
                      {onFeed(incident) ? (
                        <span className="rounded-pill bg-success-wash px-1.5 text-2xs text-success">
                          On the feed{incident.section ? ` · ${incident.section}` : ''}
                        </span>
                      ) : (
                        <span className="rounded-pill bg-canvas-raise px-1.5 text-2xs text-text-muted">
                          Not on the feed
                        </span>
                      )}
                      {isTopStory(incident, now) ? (
                        <span className="rounded-pill bg-accent-wash px-1.5 text-2xs font-medium text-accent">
                          Top story
                        </span>
                      ) : null}
                      <span className="ml-auto text-2xs text-text-faint">
                        {formatRelativeTime(incident.capturedAtIso) ?? ''}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">
                      {incident.description || 'No description filed.'}
                    </p>
                    {incident.verification ? (
                      <p className="mt-1.5 text-2xs italic text-text-faint">
                        {verificationMeta(incident.verification).permittedRepresentation}
                      </p>
                    ) : null}

                    {/*
                      Only a report on the public feed can lead it. An exclusive or
                      rejected report gets no control, rather than one that fails.
                    */}
                    {onFeed(incident) ? (
                      <div className="mt-3 border-t border-hairline/[0.07] pt-3">
                        <LeadToggle
                          incidentId={incident.id}
                          section={incident.section ?? null}
                          initial={{
                            lead: incident.lead ?? false,
                            leadAt: incident.leadAt ?? null,
                            leadUntil: incident.leadUntil ?? null,
                          }}
                        />
                      </div>
                    ) : null}
                  </Panel>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * A decided row, in any of the shapes the endpoint might use.
 *
 * Observed on 14 September: `{incidentId, vettingState, destination}` and the
 * lead fields, with no report inside.
 */
interface DecidedRow {
  id?: string;
  incidentId?: string;
  incident?: Incident;
  report?: Incident;
  description?: string;
  vettingState?: Incident['vettingState'];
  section?: Incident['section'] | null;
  lead?: boolean;
  leadAt?: string | null;
  leadUntil?: string | null;
}

/**
 * A row that names a report, made into one that carries it.
 *
 * The row's own decision fields — published or not, which desk, whether it
 * leads — are laid over the report, because the row is the record of the
 * decision.
 */
async function completeRow(row: DecidedRow): Promise<DecidedRow> {
  if (row.incident || row.report) return row;
  const id = row.id ?? row.incidentId;
  if (!id) return row;
  if (row.description) return { ...row, id };

  try {
    const workspace = await editorial.workspace<{ incident?: Incident }>(id);
    if (!workspace.incident) return row;
    return {
      ...row,
      incident: {
        ...workspace.incident,
        id: workspace.incident.id ?? id,
        ...(row.vettingState ? { vettingState: row.vettingState } : {}),
        ...(row.section ? { section: row.section } : {}),
        ...(row.lead !== undefined ? { lead: row.lead } : {}),
        ...(row.leadAt !== undefined ? { leadAt: row.leadAt } : {}),
        ...(row.leadUntil !== undefined ? { leadUntil: row.leadUntil } : {}),
      },
    };
  } catch {
    // Unreadable now; dropped from the list rather than drawn as a blank row.
    return row;
  }
}
