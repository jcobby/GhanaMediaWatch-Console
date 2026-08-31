'use client';

import { useMemo, useState } from 'react';
import { MapPin, Clock, Video, Image as ImageIcon, Check, Download, Crosshair } from 'lucide-react';
import {
  VERIFICATION_META,
  canLicenseReport,
  categoryHue,
  categoryLabel,
  downloadCharge,
  formatCedis,
  formatExactCapture,
  formatRelativeTime,
  isUnlimited,
  planFor,
  type BusinessAccount,
  type Incident,
  type ResponseAction,
  type ResponseEntry,
} from '@dawuro/core';
import { Badge, Button } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import { ResponsePanel } from '@/components/ResponsePanel';
import {
  AssuranceBadge,
  HandlingNotice,
  SeverityBadge,
  VerificationBadge,
} from '@/components/TrustBadges';
import { cn } from '@/lib/cn';

type Filter = 'offered' | 'licensed' | 'all';

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
 */
export function InboxWorkspace({
  reports,
  business,
}: {
  reports: Incident[];
  business: BusinessAccount;
}) {
  const plan = planFor(business.tier);
  const unlimited = isUnlimited(plan);
  const [licensed, setLicensed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('offered');
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null);
  /*
   * Append-only, keyed by report. Kept here rather than in the preview so a
   * response is not lost when an officer clicks away mid-triage.
   */
  const [responses, setResponses] = useState<Record<string, ResponseEntry[]>>({});

  const visible = useMemo(() => {
    if (filter === 'licensed') return reports.filter((r) => licensed.has(r.id));
    if (filter === 'offered') return reports.filter((r) => !licensed.has(r.id));
    return reports;
  }, [filter, reports, licensed]);

  const selected = reports.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  /*
   * Receiving a report costs nothing — routing chose to show it, and an
   * organisation cannot be billed for what it did not ask to see. Downloading
   * is the billable event, and on an unlimited plan it is already paid for.
   */
  const chargePerDownload = downloadCharge(plan);

  const counts = {
    offered: reports.filter((r) => !licensed.has(r.id)).length,
    licensed: licensed.size,
    all: reports.length,
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Queue */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-hairline/[0.07]">
        <div className="shrink-0 px-3 py-2.5">
          <div className="flex gap-0.5 rounded-sm bg-canvas-raise/70 p-0.5">
            {(['offered', 'licensed', 'all'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xs py-1.5 text-xs capitalize transition',
                  filter === key
                    ? 'bg-canvas-soft font-medium text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {key}
                <span className="tabular text-2xs text-text-faint">{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-4 py-12 text-center text-xs text-text-faint">
              {filter === 'licensed' ? 'Nothing downloaded yet.' : 'Nothing waiting.'}
            </li>
          ) : (
            visible.map((incident) => {
              const active = selected?.id === incident.id;
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
                       */}
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-text-faint">
                        {incident.media.durationMs ? (
                          <span className="tabular flex items-center gap-1">
                            <Video className="h-2.5 w-2.5" />
                            {formatDuration(incident.media.durationMs)}
                          </span>
                        ) : null}
                        {incident.location.label ? (
                          <span className="flex min-w-0 items-center gap-1">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{incident.location.label}</span>
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
            })
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
          takenThisPeriod={business.reportsUsedThisPeriod}
          onLicense={() => setLicensed((prev) => new Set(prev).add(selected.id))}
          responses={responses[selected.id] ?? []}
          onRecord={(action, note) =>
            setResponses((prev) => ({
              ...prev,
              [selected.id]: [
                ...(prev[selected.id] ?? []),
                {
                  id: `re_${Date.now()}`,
                  incidentId: selected.id,
                  businessId: business.id,
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

function PreviewPane({
  incident,
  licensed,
  charge,
  unlimited,
  takenThisPeriod,
  onLicense,
  responses,
  onRecord,
}: {
  incident: Incident;
  licensed: boolean;
  charge: number;
  unlimited: boolean;
  takenThisPeriod: number;
  onLicense: () => void;
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
                {licensed ? <Badge tone="success">Downloaded</Badge> : null}
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
                {VERIFICATION_META[incident.verification].permittedRepresentation}
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
            posterUrl={incident.media.posterUrl}
            alt={incident.description}
            when={when}
            where={incident.location.label}
            isVideo={incident.media.kind === 'video'}
            watermark={!licensed}
          />

          {/* Provenance, as one dense strip rather than a tall table. */}
          <dl className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-3 rounded-md border border-hairline/[0.07] bg-canvas-soft px-4 py-3">
            <Fact icon={<Clock className="h-3.5 w-3.5" />} label="Captured">
              {when ?? 'Hidden by the reporter'}
            </Fact>
            <Fact icon={<MapPin className="h-3.5 w-3.5" />} label="Place">
              {incident.location.label ?? 'Hidden by the reporter'}
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

          {/* Only once it has been paid for. Recording a response to footage
              you have not licensed would be claiming work on someone else's
              evidence. */}
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
                <p className="text-sm font-medium text-success">Downloaded</p>
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
            ) : (
              <>
                <p className="tabular text-sm font-semibold">{formatCedis(charge)}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Charged on top of your subscription —{' '}
                  <span className="tabular">{takenThisPeriod}</span> downloaded this month.
                </p>
              </>
            )}
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
            disabled={!licensed && !canLicenseReport(incident.verification)}
            className="shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {licensed
              ? 'Download original'
              : unlimited
                ? 'Download'
                : `Pay ${formatCedis(charge)} and download`}
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
