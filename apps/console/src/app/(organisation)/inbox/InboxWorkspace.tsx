'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  MapPin,
  Clock,
  Video,
  Image as ImageIcon,
  Check,
  Download,
  Crosshair,
  PanelLeftOpen,
} from 'lucide-react';
import {
  canLicenseReport,
  categoryHue,
  categoryLabel,
  downloadCharge,
  formatCedis,
  formatExactCapture,
  formatPlace,
  formatRelativeTime,
  isUnlimited,
  planFor,
  verificationMeta,
  type Incident,
  type IncidentCategory,
  type OrganisationAccount,
  type ResponseAction,
  type ResponseEntry,
  type Severity,
} from '@dawuro/core';
import { Badge, Button } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import { mediaHref } from '@/lib/mediaHref';
import { ResponsePanel } from '@/components/ResponsePanel';
import { NotesPanel } from '@/components/NotesPanel';
import { SendToEditor } from '@/components/SendToEditor';
import {
  AssuranceBadge,
  HandlingNotice,
  SeverityBadge,
  VerificationBadge,
} from '@/components/TrustBadges';
import { groupReports } from '@/lib/queueGroups';
import { cn } from '@/lib/cn';
import { InboxFilters, type InboxFilterState, type Status } from './InboxFilters';

/**
 * The organisation's report inbox.
 *
 * Two panes: the queue on the left, one report on the right. This is the shape
 * the phone could not offer — an officer comparing four flood reports had to
 * page back and forth, losing the previous one each time. Here the queue stays
 * put while the preview changes.
 *
 * Both panes scroll independently inside a fixed shell. Nothing here computes a
 * height from the viewport: a hardcoded `calc(100vh - Xrem)` is only correct
 * until the header changes, and when it is wrong the whole document scrolls and
 * takes the navigation with it.
 *
 * **Finding one report is a first-class job here, not only working through
 * them.** Three tabs were the whole of it, so an officer with twenty-two
 * waiting and a question about Kaneshie read every row. Search, two facets and
 * three groupings are in the queue head, arranged the way the verification desk
 * arranges its own.
 */
export function InboxWorkspace({
  reports,
  organisation,
}: {
  reports: Incident[];
  organisation: OrganisationAccount;
}) {
  const plan = planFor(organisation.tier);
  const unlimited = isUnlimited(plan);
  const [licensed, setLicensed] = useState<Set<string>>(new Set());
  /** The report a purchase is in flight for, so its button can say so. */
  const [buying, setBuying] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  /*
   * Licensing, sent to the service.
   *
   * This used to be `setLicensed(...)` alone: the row moved to the Licensed tab,
   * the button said "Downloaded", and nothing left the browser. A reload brought
   * the report back unlicensed, and an officer who had bought four reports had
   * bought none.
   *
   * The local state is set **after** the service confirms, never before. An
   * optimistic tick here is a claim that money changed hands, and it is the one
   * claim this screen must not make on the strength of a click.
   */
  const license = useCallback(async (incidentId: string) => {
    setBuying(incidentId);
    setPurchaseError(null);
    try {
      const response = await fetch(`/api/org/incidents/${encodeURIComponent(incidentId)}/license`, {
        method: 'POST',
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        /*
         * The service's own sentence. A report whose verification state forbids
         * licensing and a subscription that cannot cover it are different
         * answers, and only one of them is worth trying again.
         */
        setPurchaseError(
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: unknown }).error)
            : 'That could not be licensed.',
        );
        return;
      }
      setLicensed((prev) => new Set(prev).add(incidentId));
    } catch {
      setPurchaseError('The console could not be reached. Nothing was charged.');
    } finally {
      setBuying(null);
    }
  }, []);

  const [filters, setFilters] = useState<InboxFilterState>({
    status: 'offered',
    query: '',
    category: 'all',
    severity: 'all',
    grouping: 'recent',
    dateOrder: 'newest',
  });
  /*
   * Whether the queue is showing. The preview is where the footage is judged,
   * and on a laptop the 340px queue is most of what stands between it and a
   * usable size.
   */
  const [queueOpen, setQueueOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /*
   * Append-only, keyed by report. Kept here rather than in the preview so a
   * response is not lost when an officer clicks away mid-triage.
   */
  const [responses, setResponses] = useState<Record<string, ResponseEntry[]>>({});

  /*
   * Newest first, which is the order an inbox is read in.
   *
   * Nothing ranks these — routing delivered them because the interests matched,
   * and the server sends no ordering — so the one honest default is when it was
   * filmed. A report with no capture date sorts last rather than first: it has
   * no claim to being the most recent thing here.
   */
  const ordered = useMemo(
    () =>
      [...reports].sort((a, b) => {
        if (!a.capturedAtIso) return 1;
        if (!b.capturedAtIso) return -1;
        return b.capturedAtIso.localeCompare(a.capturedAtIso);
      }),
    [reports],
  );

  const counts: Record<Status, number> = {
    offered: reports.filter((r) => !licensed.has(r.id)).length,
    licensed: licensed.size,
    all: reports.length,
  };

  /** The tab's own list, before the facets narrow it. */
  const inTab = useMemo(() => {
    if (filters.status === 'licensed') return ordered.filter((r) => licensed.has(r.id));
    if (filters.status === 'offered') return ordered.filter((r) => !licensed.has(r.id));
    return ordered;
  }, [filters.status, ordered, licensed]);

  /*
   * The facets are built from what is in the tab, with counts — so every option
   * offered matches at least one report, and choosing one can never produce an
   * empty list the operator has to undo.
   */
  const categories = useMemo(() => tally(inTab.map((r) => r.category)), [inTab]);
  const severities = useMemo(() => tally(inTab.map((r) => r.severity)), [inTab]);

  const visible = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    return inTab.filter((incident) => {
      if (filters.category !== 'all' && incident.category !== filters.category) return false;
      if (filters.severity !== 'all' && incident.severity !== filters.severity) return false;
      if (!needle) return true;
      /*
       * What somebody actually remembers about a report: roughly what it said,
       * roughly where it was, or the reference off an email. The category is in
       * there too, so typing "flood" works before the facet is opened.
       */
      return [
        incident.description,
        formatPlace(incident.location),
        incident.reportId,
        categoryLabel(incident.category),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [inTab, filters.category, filters.severity, filters.query]);

  const groups = useMemo(
    () =>
      groupReports(visible, filters.grouping, filters.dateOrder, {
        capturedAtIso: (incident) => incident.capturedAtIso,
        category: (incident) => incident.category,
      }),
    [visible, filters.grouping, filters.dateOrder],
  );

  /*
   * Null until an officer picks something, which is not the same as nothing
   * being selected.
   *
   * Seeded with `reports[0]`, the preview could sit on a report the filters had
   * removed from the list beside it — a screen showing one thing on the left and
   * a different one on the right, with no way to tell which was being acted on.
   * The default follows whatever is at the top of the list as displayed; an
   * explicit choice does not, so narrowing rearranges the list around an officer
   * rather than moving them off what they are reading.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const firstShown = groups[0]?.items[0] ?? null;
  const selected =
    (selectedId ? (reports.find((r) => r.id === selectedId) ?? null) : null) ?? firstShown;

  /*
   * Receiving a report costs nothing — routing chose to show it, and an
   * organisation cannot be billed for what it did not ask to see. Downloading
   * is the billable event, and on an unlimited plan it is already paid for.
   */
  const chargePerDownload = downloadCharge(plan);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Collapsed, the queue keeps its count — hidden with no way back is a
          worse bug than the width it was taking. */}
      {!queueOpen ? (
        <button
          type="button"
          onClick={() => setQueueOpen(true)}
          title="Show the queue"
          className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-hairline/[0.07] py-3 transition hover:bg-canvas-raise/60"
        >
          <PanelLeftOpen className="h-4 w-4 text-text-muted" strokeWidth={2} />
          <span className="tabular text-2xs font-semibold text-text-secondary">
            {visible.length}
          </span>
          <span className="[writing-mode:vertical-rl] text-2xs uppercase tracking-[0.14em] text-text-faint">
            Reports
          </span>
        </button>
      ) : null}

      {/* Queue */}
      <div
        className={cn(
          'flex w-[340px] shrink-0 flex-col border-r border-hairline/[0.07]',
          queueOpen ? '' : 'hidden',
        )}
      >
        <InboxFilters
          state={filters}
          onChange={setFilters}
          counts={counts}
          categories={categories}
          severities={severities}
          shown={visible.length}
          total={reports.length}
          filtersOpen={filtersOpen}
          onFiltersOpen={setFiltersOpen}
          onCollapse={() => setQueueOpen(false)}
        />

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-4 py-12 text-center text-xs text-text-faint">
              {/*
                Three different silences, told apart.

                "Nothing waiting" under an active search is a lie about the
                queue — the reports are there and the filter is hiding them, and
                an officer who reads it stops looking.
              */}
              {inTab.length > 0
                ? 'No report here matches that.'
                : filters.status === 'licensed'
                  ? 'Nothing licensed yet.'
                  : 'Nothing waiting.'}
            </li>
          ) : (
            groups.map((group) => (
              <li key={group.key}>
                {/* Sticky, because the value of a group is knowing which one you
                    are in, and a queue scrolls past the heading in three rows. */}
                {group.label ? (
                  <p className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-hairline/[0.07] bg-canvas/95 px-3 py-1.5 backdrop-blur">
                    <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                      {group.label}
                    </span>
                    <span className="tabular text-2xs text-text-faint">{group.items.length}</span>
                  </p>
                ) : null}

                <ul>
                  {group.items.map((incident) => {
                    const active = selected?.id === incident.id;
                    const where = formatPlace(incident.location);
                    return (
                      <li key={incident.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(incident.id)}
                          aria-current={active ? 'true' : undefined}
                          className={cn(
                            'relative flex w-full gap-3 px-3 py-3 text-left transition',
                            active ? 'bg-accent-wash/45' : 'hover:bg-canvas-raise/50',
                          )}
                        >
                          {active ? (
                            <span
                              aria-hidden
                              className="absolute inset-y-0 left-0 w-[3px] rounded-r-pill bg-accent"
                            />
                          ) : null}
                          <span className="relative h-[52px] w-[42px] shrink-0 overflow-hidden rounded-xs bg-canvas-raise">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={incident.media.posterUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            {incident.media.kind === 'video' ? (
                              <span className="absolute bottom-0.5 right-0.5 rounded-[3px] bg-black/70 p-[3px]">
                                <Video className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                              </span>
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span
                                aria-hidden
                                className="h-1.5 w-1.5 shrink-0 rounded-pill"
                                style={{
                                  backgroundColor: categoryHue(incident.category),
                                }}
                              />
                              <span className="truncate text-2xs font-medium uppercase tracking-wide text-text-muted">
                                {categoryLabel(incident.category)}
                              </span>
                              <span className="ml-auto shrink-0 text-2xs tabular text-text-faint">
                                {formatRelativeTime(incident.capturedAtIso)}
                              </span>
                              {licensed.has(incident.id) ? (
                                <Check className="h-3 w-3 shrink-0 text-success" strokeWidth={3} />
                              ) : null}
                            </span>

                            {/* Severity and assurance decide whether this is worth
                                opening at all, so they sit on the row rather than
                                behind a click. */}
                            <span className="mt-1 flex flex-wrap items-center gap-1">
                              <SeverityBadge severity={incident.severity} />
                              <AssuranceBadge assurance={incident.assurance} showLabel={false} />
                              <VerificationBadge state={incident.verification} />
                            </span>
                            <span className="mt-1 block line-clamp-2 text-xs leading-[1.45] text-text-secondary">
                              {incident.description}
                            </span>

                            {/*
                             * Length, place and exact time on the row itself.
                             * An officer triaging a queue is deciding what to open,
                             * and those three answer it: a 4-second clip from
                             * yesterday two districts away is not worth a click,
                             * and nothing above this line says so.
                             *
                             * The place falls back to the fix, because the service
                             * names no place on any report it holds — reading the
                             * label alone left the location blank on footage whose
                             * whole claim is that it was filmed somewhere.
                             */}
                            <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-text-faint">
                              {incident.media.durationMs ? (
                                <span className="tabular flex items-center gap-1">
                                  <Video className="h-2.5 w-2.5" />
                                  {formatDuration(incident.media.durationMs)}
                                </span>
                              ) : null}
                              {where ? (
                                <span className="flex min-w-0 items-center gap-1">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{where}</span>
                                </span>
                              ) : null}
                              {formatExactCapture(
                                incident.capturedAtIso,
                                incident.capturedAtPrecision,
                              ) ? (
                                <span className="tabular flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatExactCapture(
                                    incident.capturedAtIso,
                                    incident.capturedAtPrecision,
                                  )}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                        <span className="mx-3 block h-px bg-hairline/[0.05]" />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Preview */}
      {selected ? (
        <PreviewPane
          key={selected.id}
          incident={selected}
          licensed={licensed.has(selected.id)}
          charge={chargePerDownload}
          unlimited={unlimited}
          takenThisPeriod={organisation.reportsUsedThisPeriod}
          onLicense={() => void license(selected.id)}
          buying={buying === selected.id}
          purchaseError={purchaseError}
          responses={responses[selected.id] ?? []}
          onRecord={(action, note) =>
            setResponses((prev) => ({
              ...prev,
              [selected.id]: [
                ...(prev[selected.id] ?? []),
                {
                  id: `re_${Date.now()}`,
                  incidentId: selected.id,
                  businessId: organisation.id,
                  action,
                  byEmployeeName: 'You',
                  note: note || null,
                  evidenceUrl: null,
                  atIso: new Date().toISOString(),
                },
              ],
            }))
          }
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-text-faint">Select a report to review it.</p>
        </div>
      )}
    </div>
  );
}

/** Count each distinct value, commonest first. Used to build the facets. */
function tally<T extends IncidentCategory | Severity>(values: T[]): { value: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

function PreviewPane({
  incident,
  licensed,
  charge,
  unlimited,
  takenThisPeriod,
  onLicense,
  buying,
  purchaseError,
  responses,
  onRecord,
}: {
  incident: Incident;
  licensed: boolean;
  /**
   * What one download costs, or null when the plan could not be read.
   *
   * Null is not zero. A price of zero says the report is free; not knowing the
   * price says nothing, and the button below says so rather than inviting a
   * click whose cost will turn up on an invoice.
   */
  charge: number | null;
  unlimited: boolean;
  takenThisPeriod: number;
  onLicense: () => void;
  /** A purchase for this report is in flight. */
  buying: boolean;
  /** Why the last purchase failed, in the service's own words. */
  purchaseError: string | null;
  responses: ResponseEntry[];
  onRecord: (action: ResponseAction, note: string) => void;
}) {
  const when = formatExactCapture(incident.capturedAtIso, incident.capturedAtPrecision);
  const lowGps = incident.location.confidence !== 'high';

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-7 py-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-[7px] h-2 w-2 shrink-0 rounded-pill"
              style={{ backgroundColor: categoryHue(incident.category) }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {categoryLabel(incident.category)}
                </span>
                <span className="rounded-xs bg-canvas-raise px-1.5 py-0.5 font-mono text-2xs text-text-muted">
                  {incident.reportId}
                </span>
                <SeverityBadge severity={incident.severity} />
                {licensed ? <Badge tone="success">Licensed</Badge> : null}
                <Badge tone="neutral">
                  {incident.media.kind === 'video' ? (
                    <Video className="h-2.5 w-2.5" />
                  ) : (
                    <ImageIcon className="h-2.5 w-2.5" />
                  )}
                  {incident.media.kind === 'video' ? 'Video' : 'Photo'}
                </Badge>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-text-primary">
                {incident.description}
              </p>

              {/* Two badges, always both. One says how the file got here, the
                  other how far a human has checked what it shows. */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <AssuranceBadge assurance={incident.assurance} />
                <VerificationBadge state={incident.verification} />
              </div>

              {/* The one phrase this state is allowed to be described with.
                  Taken from the model so no screen can soften it. */}
              <p className="mt-1.5 text-2xs italic text-text-faint">
                {verificationMeta(incident.verification).permittedRepresentation}
              </p>
            </div>
          </div>

          {/*
           * Portrait footage in a landscape frame leaves dead black bars either
           * side, and on a wide monitor that emptiness is most of the screen. A
           * blurred, dimmed copy of the same frame fills it — the eye reads it
           * as depth rather than as absence, and the real image stays uncropped.
           */}
          <MediaFrame
            className="mt-5"
            posterUrl={mediaHref(incident.id)}
            {...(incident.media.kind === 'video' ? { videoUrl: mediaHref(incident.id) } : {})}
            alt={incident.description}
            when={when}
            where={formatPlace(incident.location)}
            isVideo={incident.media.kind === 'video'}
            byteSize={incident.media.byteSize}
            watermark={!licensed}
          />

          {/* Provenance, as one dense strip rather than a tall table. */}
          <dl className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3 rounded-md border border-hairline/[0.07] bg-canvas-soft px-4 py-3">
            <Fact icon={<Clock className="h-3.5 w-3.5" />} label="Captured">
              {when ?? 'Hidden by the reporter'}
            </Fact>
            <Fact icon={<MapPin className="h-3.5 w-3.5" />} label="Place">
              {formatPlace(incident.location) ?? 'Hidden by the reporter'}
            </Fact>
            <Fact
              icon={<Crosshair className="h-3.5 w-3.5" />}
              label="GPS"
              tone={lowGps ? 'warning' : undefined}
            >
              {lowGps ? 'Low confidence' : 'High confidence'}
            </Fact>
          </dl>

          <HandlingNotice handling={incident.handling} className="mt-3" />

          {/* Notes are the organisation's own working record, licensed or not. */}
          <div className="mt-4">
            <NotesPanel incidentId={incident.id} />
          </div>

          {/* Only once it has been paid for. Recording a response to footage
              you have not licensed would be claiming work on someone else's
              evidence. */}
          {/* Once licensed, it can be sent to the editor to publish under this name. */}
          {licensed ? (
            <div className="mt-4">
              <SendToEditor
                incidentId={incident.id}
                section={incident.section}
                verification={incident.verification}
              />
            </div>
          ) : null}

          {licensed ? (
            <div className="mt-4">
              <ResponsePanel
                entries={responses}
                severity={incident.severity}
                submittedAtIso={incident.capturedAtIso ?? new Date().toISOString()}
                onRecord={onRecord}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/*
       * The action bar is pinned rather than scrolled to. It is the only thing
       * on this screen that costs money, and it must not be something an
       * officer has to go looking for.
       */}
      <footer className="shrink-0 border-t border-hairline/[0.07] bg-canvas-soft px-7 py-3.5">
        <div className="mx-auto flex max-w-4xl items-center gap-6">
          <div className="min-w-0 flex-1">
            {licensed ? (
              <>
                <p className="text-sm font-medium text-success">Licensed</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  The watermark is gone and the original file is yours to use.
                </p>
              </>
            ) : unlimited ? (
              <>
                <p className="text-sm font-medium">No charge</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Your annual plan covers unlimited downloads —{' '}
                  <span className="tabular">{takenThisPeriod}</span> taken this year.
                </p>
              </>
            ) : charge === null ? (
              <>
                <p className="text-sm font-medium">Price unavailable</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  We could not read your subscription, so we cannot say what this download costs.
                </p>
              </>
            ) : (
              <>
                <p className="tabular text-sm font-semibold">{formatCedis(charge)}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Charged on top of your subscription —{' '}
                  <span className="tabular">{takenThisPeriod}</span> downloaded this month.
                </p>
              </>
            )}
            {/* The failure sits where the price does, so a refusal and a charge
                are never on screen together saying different things. */}
            {purchaseError ? (
              <p className="mt-1.5 text-xs leading-relaxed text-danger">{purchaseError}</p>
            ) : null}
          </div>

          <Button
            size="lg"
            variant={licensed ? 'secondary' : 'primary'}
            onClick={licensed ? undefined : onLicense}
            /*
             * Licensing is gated on the verification state, not on payment.
             * A rejected or disputed report must not be purchasable however
             * much a subscriber wants it.
             */
            /*
             * And not while the price is unknown. A download button that cannot
             * state its cost is one somebody presses and then discovers the
             * charge for.
             */
            disabled={
              buying ||
              (!licensed &&
                (!canLicenseReport(incident.verification) || (!unlimited && charge === null)))
            }
            className="shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {/*
              One word for the act, one for the file.

              The button said "Download", then "Licensing…" while it worked, then
              "Downloaded" — three words for two different things, and the one
              that matters was the quiet one. Pressing this *licenses* the
              report: the organisation is charged and the reporter is paid. The
              download is what licensing entitles you to, and afterwards it is
              the only thing left to do, which is why that is the one case where
              the button says download.
            */}
            {buying
              ? 'Licensing…'
              : licensed
                ? 'Download original'
                : unlimited
                  ? 'License and download'
                  : charge === null
                    ? 'Price unavailable'
                    : `Pay ${formatCedis(charge)} and license`}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function Fact({
  icon,
  label,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'warning';
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-text-faint">{icon}</span>
      <div>
        <dt className="text-2xs uppercase tracking-wider text-text-faint">{label}</dt>
        <dd
          className={cn(
            'mt-px text-xs font-medium',
            tone === 'warning' ? 'text-warning' : 'text-text-primary',
          )}
        >
          {children}
        </dd>
      </div>
    </div>
  );
}

/** Clip length as m:ss. Sub-minute clips still read as 0:07, not "7s". */
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
