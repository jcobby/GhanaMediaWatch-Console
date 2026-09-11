'use client';

import { useMemo, useState } from 'react';
import { Check, ImageOff, Plus, Search, Send, UserCircle2, X } from 'lucide-react';
import {
  SCORE_SCALE,
  autoRoute,
  formatExactCapture,
  formatRelativeTime,
  type Branch,
  type OrganisationAccount,
  type Employee,
} from '@dawuro/core';
import type { RoutingRow } from '@/lib/normaliseRouting';
import { byNewsValue, type RoutingAssessment } from '@/lib/routingNewsValue';
import { NewsValueChip, NewsValueReason, NewsValueSummary } from './NewsValue';
import { Badge, Button, Panel } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import { mediaHref } from '@/lib/mediaHref';
import { EmployeeAssignment } from '@/components/EmployeeAssignment';
import { cn } from '@/lib/cn';

/**
 * The routing desk.
 *
 * Reports route themselves — the matcher has already chosen recipients by the
 * time anything appears here. The operator's job is oversight: confirm what
 * the matcher decided, or override it when they know something the matcher
 * cannot, such as an ongoing investigation.
 *
 * So the auto-matched recipients are pre-selected rather than blank. An empty
 * form would imply the operator must route everything by hand, which is the
 * opposite of how the platform works and would not scale past a few hundred
 * reports a day.
 */
export function RoutingDesk({
  queue,
  organisations,
  employees,
  branches,
}: {
  queue: RoutingRow[];
  organisations: OrganisationAccount[];
  employees: Employee[];
  branches: Branch[];
}) {
  const [handled, setHandled] = useState<Record<string, string[]>>({});

  /*
   * The queue, biggest story first, scored on arrival.
   *
   * It was in arrival order, which is not a priority — it is the order the
   * uploads finished in. An operator faced with twenty rows had to open each
   * one to find out which a newsroom needed in the next ten minutes.
   *
   * `now` is fixed for the whole render so every row is measured against the
   * same instant; scoring each against its own clock would let two reports
   * filmed a second apart land in different freshness buckets depending on the
   * order they were mapped in.
   */
  const now = new Date().toISOString();
  const ranked = useMemo(() => byNewsValue(queue, now), [queue, now]);
  const scores = useMemo(
    () => new Map(ranked.map(({ row, assessment }) => [row.id, assessment])),
    [ranked],
  );

  const [selectedId, setSelectedId] = useState<string | null>(ranked[0]?.row.id ?? null);
  /*
   * What the server said, per report.
   *
   * Pressing send used to do nothing but remove the row from this list — no
   * request, no confirmation, and the report back again on the next reload. A
   * decision an operator believes they made and the platform never received is
   * the worst outcome this desk can produce, so the result of the call is shown
   * rather than assumed.
   */
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const act = async (item: RoutingRow, payload: Record<string, unknown>) => {
    setBusy(item.id);
    setFailure(null);
    try {
      const res = await fetch(`/api/routing/${encodeURIComponent(item.incidentId || item.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const answer = (await res.json()) as { error?: string; upstreamStatus?: number };
      if (!res.ok) {
        // The server's own words. These two endpoints document no request body,
        // so its validation message is the only specification available.
        setFailure(
          answer.error
            ? `${answer.error}${answer.upstreamStatus ? ` (${answer.upstreamStatus})` : ''}`
            : 'The report could not be updated.',
        );
        return;
      }
      setHandled((prev) => ({ ...prev, [item.id]: (payload.businessIds as string[]) ?? [] }));
    } catch {
      setFailure('The console could not reach its own server. Check that it is still running.');
    } finally {
      setBusy(null);
    }
  };

  const ordered = ranked.map(({ row }) => row);
  const pending = ordered.filter((item) => !(item.id in handled));
  const selected = ordered.find((q) => q.id === selectedId) ?? pending[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex w-[340px] shrink-0 flex-col border-r border-hairline/[0.07]">
        {/*
          What the order means, said once at the top.

          The list is ranked by a number, and a ranked list that does not say
          what it is ranked on asks an operator to trust an ordering they cannot
          check. The editorial desk states its ordering the same way — "ordered
          by what needs attention, not by what arrived first" — and this desk
          had no equivalent while quietly reordering itself.
        */}
        <div className="border-b border-hairline/[0.08] px-4 py-2.5">
          <p className="text-xs text-text-muted">
            <span className="tabular font-semibold text-text-primary">{pending.length}</span>{' '}
            awaiting a decision
          </p>
          <p className="mt-0.5 text-2xs leading-relaxed text-text-faint">
            Ranked by news value, biggest story first &mdash; scored out of {SCORE_SCALE} from what
            the report itself says. Open one to see the working.
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {ordered.map((item) => {
            const active = selected?.id === item.id;
            const done = item.id in handled;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'flex w-full gap-3 border-b border-hairline/[0.05] px-3 py-3 text-left transition',
                    active ? 'bg-accent-wash/50' : 'hover:bg-canvas-raise/60',
                    done && 'opacity-55',
                  )}
                >
                  <span className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-canvas-raise">
                    <QueueTile item={item} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {/*
                        The category, only when the server actually sent one.

                        `category ?? 'other'` printed OTHER on eight rows whose
                        record had never been read, and an operator routes on
                        exactly this field — they cannot tell a report genuinely
                        filed under "other" from one whose category never
                        arrived.
                      */}
                      <span className="text-2xs uppercase tracking-wide text-text-muted">
                        {item.contentUnavailable ? 'Report not loaded' : item.category}
                      </span>
                      {/*
                        What this would be worth if it stands up.

                        Derived, so every row carries it the moment it arrives
                        rather than only the ones somebody has opened. Muted:
                        the tier decides the order of this list, and styling it
                        as loudly as the category would read as a verdict on a
                        report nobody has checked.
                      */}
                      <NewsValueChip assessment={scores.get(item.id)} />
                      {done ? (
                        <Check className="ml-auto h-3 w-3 text-success" strokeWidth={3} />
                      ) : null}
                    </span>
                    {/*
                      A row is never blank.

                      The server does not always send a description, and an
                      empty row is unusable — four identical white boxes, no way
                      to tell one report from another or to say which one you
                      opened. The reference code identifies it when the words
                      do not, and the absence is stated rather than left as
                      whitespace somebody reads as a rendering fault.
                    */}
                    {/*
                      "No description filed" is a claim about the report. When
                      its record could not be read, the honest statement is
                      about the console instead — otherwise eight reports look
                      like eight people who filed nothing.
                    */}
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-snug">
                      {item.contentUnavailable ? (
                        <span className="italic text-text-faint">Details could not be read</span>
                      ) : (
                        item.summary || (
                          <span className="italic text-text-faint">No description filed</span>
                        )
                      )}
                    </span>

                    {/*
                      Why this row is where it is, in four words.

                      Directly under the description, because the two are read
                      together: what this report is, then what put it above the
                      one below it. The number alone ranks without explaining,
                      and an operator scanning twenty rows will not open each
                      one to find out — so the two criteria carrying the most
                      weight in this particular score are named on the row.
                    */}
                    <NewsValueReason assessment={scores.get(item.id)} />
                    {/*
                      Something that identifies this row, always.

                      `reportId` is the readable code (DW-XXX-XXX) an operator
                      says aloud, and it is the right thing to show. But the
                      routing overview sends only an incident id, so when the
                      report itself could not be read this said "No reference"
                      on all eight rows at once — a queue of identical entries
                      with no way to tell which one you had open. The incident
                      id is uglier and it is real.
                    */}
                    <span className="mt-1 block truncate text-2xs text-text-faint">
                      {[item.reportId ?? item.incidentId, formatRelativeTime(item.submittedAtIso)]
                        .filter(Boolean)
                        .join(' · ') || 'No reference'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected ? (
          <RoutingPane
            key={selected.id}
            item={selected}
            organisations={organisations}
            employees={employees}
            branches={branches}
            assessment={scores.get(selected.id)}
            routedTo={handled[selected.id] ?? null}
            busy={busy === selected.id}
            failure={failure}
            onRoute={(ids) => void act(selected, { action: 'route', businessIds: ids })}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-text-faint">The queue is clear.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The small frame beside each queue row.
 *
 * A photo, or a video's poster, is an image and goes in an `<img>`. A video
 * usually has no poster — the service stores `posterUrl: null` for every clip —
 * so the first frame is pulled from the file itself: `#t=0.1` asks the browser
 * to seek just past the start, because frame zero of a phone video is often
 * black, and `preload="metadata"` fetches only enough to decode that frame
 * rather than the whole clip, once per row.
 *
 * Previously every case went through one `<img>`, so a video URL was handed to
 * an element that cannot decode it. That fails with no error and no
 * broken-image icon: the tile was simply an empty grey box, which reads as
 * missing footage. Nothing was missing — the wrong element was asked to draw it.
 *
 * Where there is genuinely nothing, an icon says so rather than leaving a blank
 * an operator has to interpret.
 */
function QueueTile({ item }: { item: RoutingRow }) {
  if (item.thumbnailUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />;
  }

  if (item.mediaUrl && item.mediaKind === 'video') {
    return (
      <video
        src={`${item.mediaUrl}#t=0.1`}
        className="h-full w-full object-cover"
        preload="metadata"
        muted
        playsInline
      />
    );
  }

  return <ImageOff className="h-4 w-4 text-text-faint" strokeWidth={1.75} />;
}

function RoutingPane({
  item,
  assessment,
  organisations,
  employees,
  branches,
  routedTo,
  busy,
  failure,
  onRoute,
}: {
  item: RoutingRow;
  assessment: RoutingAssessment | undefined;
  organisations: OrganisationAccount[];
  employees: Employee[];
  branches: Branch[];
  routedTo: string[] | null;
  busy: boolean;
  failure: string | null;
  onRoute: (ids: string[]) => void;
}) {
  /*
   * The same matcher the phone and the organisation inbox run. Showing the
   * operator a different answer from the one the system acted on would make
   * this screen actively misleading.
   */
  const matches = useMemo(
    () =>
      autoRoute(
        {
          category: item.category,
          destination: item.destination,
          requestedBusinessIds: item.requestedBusinessIds,
          location: null,
        },
        organisations,
      ),
    [item, organisations],
  );

  const [selected, setSelected] = useState<string[]>(() => matches.map((m) => m.businessId));
  const [query, setQuery] = useState('');
  /*
   * Which person inside each recipient organisation gets it, keyed by organisation
   * id. Naming nobody is valid and common — the report then waits in that
   * organisation's shared inbox, which is what happens today.
   */
  const [assignees, setAssignees] = useState<Record<string, string | null>>({});

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const matchedIds = new Set(matches.map((m) => m.businessId));
  const others = organisations.filter((b) => !matchedIds.has(b.id));

  /*
   * Matches name and sector. Sector matters because an operator often knows the
   * kind of body they want ("some district assembly") before the exact name.
   * Anything already selected stays visible regardless of the query, so a
   * search cannot silently hide a recipient the operator just added.
   */
  const visibleOthers = others.filter((b) => {
    if (selected.includes(b.id)) return true;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || b.sector.toLowerCase().includes(q);
  });
  const changed = selected.length !== matches.length || selected.some((id) => !matchedIds.has(id));

  return (
    <div className="mx-auto max-w-3xl px-7 py-6">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          Shown only when the report itself was read.

          Both of these come from the incident record, and both are defaulted
          when it could not be fetched — to `other` and `marketplace`. An
          operator routes on exactly these two fields, and `public` and
          `marketplace` are opposite instructions, so a guess presented as a
          badge is worse than no badge.
        */}
        {item.contentUnavailable ? (
          <Badge tone="neutral">Report not loaded</Badge>
        ) : (
          <>
            <Badge tone="accent">{item.category}</Badge>
            <Badge tone={item.destination === 'directed' ? 'info' : 'neutral'}>
              {item.destination}
            </Badge>
          </>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-text-muted">
          <UserCircle2 className="h-3.5 w-3.5" /> {item.reporterHandle}
          <span className="text-text-faint">
            · submitted {formatRelativeTime(item.submittedAtIso)}
          </span>
        </span>
      </div>

      <p className="mt-2.5 text-[15px] leading-relaxed">{item.summary}</p>

      {/*
        Above the footage, because it can say not to send this at all.

        A harm gate failing is a reason to stop, and a reason to stop belongs
        before the thing it is about — not below a video an operator has already
        watched and made up their mind on.
      */}
      <div className="mt-3.5">
        <NewsValueSummary assessment={assessment} />
      </div>

      {/* Time and place are stamped on the frame, not printed beside it — an
          operator forwarding this to a patrol unit sends the image, and the
          claim has to survive the trip.

          Watermarked here too. Nobody has paid for this report yet, and the
          operator can forward it onward, so a clean frame reachable from this
          screen would be a hole in the same protection the inbox relies on. */}
      <MediaFrame
        className="mt-4"
        posterUrl={mediaHref(item.incidentId)}
        {...(item.mediaKind !== 'photo' ? { videoUrl: mediaHref(item.incidentId) } : {})}
        byteSize={item.mediaByteSize}
        alt={item.summary}
        when={formatExactCapture(item.capturedAtIso, 'exact')}
        where={item.locationLabel}
        isVideo
        watermark
      />

      {routedTo ? (
        <Panel className="mt-6 flex items-center gap-3 border-success/25 bg-success-wash/40 p-4">
          <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={2.5} />
          <p className="text-sm text-text-secondary">
            Sent to{' '}
            <span className="font-medium text-text-primary">
              {routedTo.length === 0
                ? 'nobody'
                : routedTo
                    .map((id) => organisations.find((b) => b.id === id)?.name ?? id)
                    .join(', ')}
            </span>
            .
          </p>
        </Panel>
      ) : (
        <>
          <section className="mt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                Matched automatically
              </h2>
              {changed ? <Badge tone="warning">Overridden</Badge> : null}
            </div>
            <div className="mt-2 space-y-1.5">
              {matches.length === 0 ? (
                <p className="rounded-sm bg-canvas-raise px-3 py-2.5 text-xs text-text-muted">
                  No organisation matched. This report reaches nobody unless you route it.
                </p>
              ) : (
                matches.map((match) => {
                  const organisation = organisations.find((b) => b.id === match.businessId);
                  if (!organisation) return null;
                  return (
                    <RecipientRow
                      key={match.businessId}
                      name={organisation.name}
                      reason={match.reasons.join(' · ').replaceAll('_', ' ')}
                      selected={selected.includes(match.businessId)}
                      onToggle={() => toggle(match.businessId)}
                    />
                  );
                })
              )}
            </div>
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                Send to another organisation
              </h2>
              {/* Search rather than a wall of chips: this list grows with every
                  organisation that signs up, and an operator overriding a match
                  usually has one specific recipient in mind already. */}
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search organisations"
                  aria-label="Search organisations to send this report to"
                  className="h-8 w-full rounded-sm border border-hairline/12 bg-canvas-soft pl-8 pr-2.5 text-xs placeholder:text-text-faint focus:border-accent"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleOthers.length === 0 ? (
                <p className="w-full rounded-sm bg-canvas-raise px-3 py-2.5 text-xs text-text-muted">
                  {/*
                    With no query typed this read: No organisation matches "".
                    An empty search is not a failed search — it is the state the
                    panel opens in, and the real reason nothing is listed is
                    that the platform has no organisations on it yet.
                  */}
                  {query
                    ? `No organisation matches “${query}”.`
                    : 'No organisations to send to yet.'}
                </p>
              ) : (
                visibleOthers.map((organisation) => (
                  <button
                    key={organisation.id}
                    type="button"
                    onClick={() => toggle(organisation.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs transition',
                      selected.includes(organisation.id)
                        ? 'border-accent bg-accent-wash text-accent'
                        : 'border-hairline/12 text-text-muted hover:border-accent/30 hover:text-text-primary',
                    )}
                  >
                    {selected.includes(organisation.id) ? (
                      <X className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {organisation.name}
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Who inside each organisation. Rendered per recipient because the
              right person at a district assembly is not the right person at a
              newsroom, and one combined list would hide that. */}
          {selected.map((businessId) => {
            const organisation = organisations.find((b) => b.id === businessId);
            if (!organisation) return null;
            const staff = employees.filter((e) => e.businessId === businessId);

            return (
              <EmployeeAssignment
                key={businessId}
                organisation={organisation}
                employees={staff}
                branches={branches.filter((b) => b.businessId === businessId)}
                incident={{
                  category: item.category,
                  location: item.location,
                  // Fire and road collisions are time-critical: reliability and
                  // seniority matter more when minutes count.
                  urgent: item.category === 'fire' || item.category === 'accident',
                }}
                assignedTo={assignees[businessId] ?? null}
                onAssign={(employeeId) =>
                  setAssignees((prev) => ({
                    ...prev,
                    [businessId]: employeeId,
                  }))
                }
              />
            );
          })}

          {/*
            A report filed for the public feed is not waiting to be routed.

            `destination` is the reporter's own instruction, and `public` means
            "no commission — visibility is the reward". This desk was asking an
            operator to choose organisations for reports that had explicitly
            asked not to go to any, and offering "Send to nobody" as the
            alternative — two ways to bury something whose author had already
            said where it should go.

            It is said here rather than hidden, because the operator can see
            more than the matcher: a report marked public that names a child, or
            a street address, is exactly the one somebody should stop. The
            controls stay available for that.
          */}
          {!item.contentUnavailable &&
          (item.destination === 'public' || item.destination === 'both') ? (
            <div className="mt-6 rounded-md border border-info/25 bg-info-wash/30 p-4">
              <p className="text-xs font-medium text-text-secondary">
                {item.destination === 'public'
                  ? 'The reporter filed this for the public feed'
                  : 'The reporter filed this for the public feed and for licensing'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {item.destination === 'public'
                  ? 'They asked for no commission — visibility is the reward. Routing it to organisations is not what they chose, and sending it to nobody buries it.'
                  : 'It should reach the public feed whether or not an organisation licenses it.'}{' '}
                Releasing to the feed is the verification desk&rsquo;s action, from Triage.
              </p>
            </div>
          ) : null}

          <div className="mt-6 border-t border-hairline/[0.08] pt-5">
            <div className="flex items-center gap-3">
              <Button onClick={() => onRoute(selected)} disabled={selected.length === 0 || busy}>
                <Send className="h-3.5 w-3.5" />
                {changed ? 'Send with override' : 'Confirm and send'}
              </Button>
              <Button variant="ghost" onClick={() => onRoute([])} disabled={busy}>
                Send to nobody
              </Button>
              <p className="ml-auto text-xs text-text-faint">
                {selected.length} recipient{selected.length === 1 ? '' : 's'}
              </p>
            </div>

            {/*
              The decision a platform owner is actually left with.

              When nothing matched, sending to nobody buries the report — and it
              is still a real thing somebody filmed. Releasing it to the public
              feed is the other half of the choice, and without it this screen
              offers only ways to make a report disappear.
            */}
            {matches.length === 0 ? (
              <div className="mt-4 rounded-md border border-hairline/[0.08] bg-canvas-raise p-4">
                <p className="text-xs font-medium text-text-secondary">
                  No organisation wanted this report
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  It can still be released to the public feed, where anyone using Dawuro will see
                  it. The reporter earns nothing for a public release — visibility is the reward.
                </p>
                {/*
                  Not a button here, because the server refuses it here.

                  This offered a release button and the API answered
                  `Token cannot access this endpoint. (403)`: publishing goes
                  through `/editorial/{id}/transition`, which a platform owner
                  may read but not write. An owner can load these reports — that
                  is how this queue fills — and cannot release them.

                  A control that always fails is worse than no control, so this
                  says who does it instead. The verification desk has the action,
                  and middleware keeps owners off `/editorial`, so this is a
                  handover between two people rather than a link.
                */}
                {/*
                  Accurate now that the mechanism is known. Releasing is not a
                  separate action anybody performs: recording a report as
                  corroborating on the verification desk is what publishes it.
                */}
                <p className="mt-3 text-xs leading-relaxed text-text-faint">
                  It reaches the feed by being verified: an editor records it as corroborating in
                  Triage, and that publishes it. There is no release button, here or there.
                </p>
              </div>
            ) : null}

            {failure ? (
              <p className="mt-4 rounded-md border border-danger/25 bg-danger-wash p-3 text-xs leading-relaxed text-danger">
                {failure}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function RecipientRow({
  name,
  reason,
  selected,
  onToggle,
}: {
  name: string;
  reason: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 transition',
        selected ? 'border-accent/30 bg-accent-wash/40' : 'border-hairline/[0.08] opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-3.5 w-3.5 accent-[rgb(var(--color-accent))]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-2xs capitalize text-text-faint">{reason}</span>
      </span>
    </label>
  );
}
