'use client';

import { useMemo, useState } from 'react';
import { MapPin, Clock, Video, Image as ImageIcon, Check, Download, Crosshair } from 'lucide-react';
import {
  downloadCharge,
  formatCedis,
  formatExactCapture,
  formatRelativeTime,
  isUnlimited,
  planFor,
  type BusinessAccount,
  type Incident,
} from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { CaptureStamp } from '@/components/CaptureStamp';
import { SampleWatermark } from '@/components/SampleWatermark';
import { cn } from '@/lib/cn';

type Filter = 'offered' | 'licensed' | 'all';

/**
 * The organisation's report inbox.
 *
 * Two panes: the queue on the left, one report on the right. This is the
 * shape the phone could not offer — an officer comparing four flood reports
 * had to page back and forth, losing the previous one each time. Here the
 * queue stays put while the preview changes.
 *
 * Licensing is where money moves, so the cost is on the button rather than
 * discovered on an invoice at month end.
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

  const license = (incident: Incident) => {
    setLicensed((prev) => new Set(prev).add(incident.id));
  };

  const counts = {
    offered: reports.filter((r) => !licensed.has(r.id)).length,
    licensed: licensed.size,
    all: reports.length,
  };

  return (
    <div className="flex h-[calc(100vh-5.5rem)]">
      {/* Queue */}
      <div className="flex w-[22rem] shrink-0 flex-col border-r border-hairline/[0.08]">
        <div className="flex gap-1 border-b border-hairline/[0.08] px-3 py-2.5">
          {(['offered', 'licensed', 'all'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition',
                filter === key
                  ? 'bg-accent-wash text-accent'
                  : 'text-text-muted hover:bg-canvas-raise hover:text-text-primary',
              )}
            >
              {key} <span className="tabular opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>

        <ul className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-text-faint">
              {filter === 'licensed' ? 'Nothing licensed yet.' : 'Nothing waiting.'}
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
                      'flex w-full gap-3 border-b border-hairline/[0.05] px-3 py-3 text-left transition',
                      active ? 'bg-accent-wash/50' : 'hover:bg-canvas-raise/60',
                    )}
                  >
                    <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-xs bg-canvas-raise">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={incident.media.posterUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {incident.media.kind === 'video' ? (
                        <span className="absolute bottom-0.5 right-0.5 rounded-[3px] bg-black/65 p-0.5">
                          <Video className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-pill"
                          style={{ backgroundColor: categoryHue(incident.category) }}
                        />
                        <span className="text-2xs uppercase tracking-wide text-text-muted">
                          {incident.category}
                        </span>
                        {licensed.has(incident.id) ? (
                          <Check className="ml-auto h-3 w-3 text-success" strokeWidth={3} />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-text-primary">
                        {incident.description}
                      </span>
                      <span className="mt-1 block text-2xs text-text-faint">
                        {formatRelativeTime(incident.capturedAtIso)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <PreviewPane
            incident={selected}
            licensed={licensed.has(selected.id)}
            charge={chargePerDownload}
            unlimited={unlimited}
            takenThisPeriod={business.reportsUsedThisPeriod}
            onLicense={() => license(selected)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <p className="max-w-xs text-sm text-text-faint">
              Select a report to review it.
            </p>
          </div>
        )}
      </div>
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
}: {
  incident: Incident;
  licensed: boolean;
  charge: number;
  unlimited: boolean;
  takenThisPeriod: number;
  onLicense: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-pill"
              style={{ backgroundColor: categoryHue(incident.category) }}
            />
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              {incident.category}
            </span>
            {licensed ? <Badge tone="success">Licensed</Badge> : null}
            {incident.media.kind === 'video' ? (
              <Badge tone="neutral">
                <Video className="h-2.5 w-2.5" /> Video
              </Badge>
            ) : (
              <Badge tone="neutral">
                <ImageIcon className="h-2.5 w-2.5" /> Photo
              </Badge>
            )}
          </div>
          <p className="mt-2 text-base leading-relaxed">{incident.description}</p>
        </div>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-md bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={incident.media.posterUrl}
          alt={incident.description}
          className="max-h-[26rem] w-full object-contain"
        />
        {/* Provenance stays on the frame whether or not it has been paid for. */}
        <CaptureStamp incident={incident} />
        {licensed ? null : <SampleWatermark />}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Panel className="divide-y divide-hairline/[0.06]">
          <Meta
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Captured"
            /* null means the reporter chose to hide the timestamp. That is a
               decision to respect and show, not a missing value to paper over. */
            value={
              formatExactCapture(incident.capturedAtIso, incident.capturedAtPrecision) ??
              'Hidden by the reporter'
            }
          />
          <Meta
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Place"
            value={incident.location.label ?? 'Hidden by the reporter'}
          />
          <Meta
            icon={<Crosshair className="h-3.5 w-3.5" />}
            label="GPS confidence"
            value={incident.location.confidence === 'high' ? 'High' : 'Low'}
            tone={incident.location.confidence === 'high' ? undefined : 'warning'}
          />
        </Panel>

        <Panel className="flex flex-col justify-between p-4">
          {licensed ? (
            <>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                  Paid
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  The watermark is gone and the original file is yours to use.
                </p>
              </div>
              <Button variant="secondary" fullWidth className="mt-4">
                <Download className="h-3.5 w-3.5" /> Download original
              </Button>
            </>
          ) : unlimited ? (
            <>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                  Included
                </p>
                <p className="mt-1 text-xl font-semibold">No charge</p>
                <p className="mt-1 text-xs text-text-muted">
                  Your annual plan covers unlimited downloads. {takenThisPeriod} taken this year.
                </p>
              </div>
              <Button fullWidth size="lg" className="mt-4" onClick={onLicense}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                  Download cost
                </p>
                <p className="tabular mt-1 text-xl font-semibold">{formatCedis(charge)}</p>
                <p className="mt-1 text-xs text-text-muted">
                  Charged on top of your subscription. {takenThisPeriod} downloaded this month.
                </p>
              </div>
              <Button fullWidth size="lg" className="mt-4" onClick={onLicense}>
                Pay {formatCedis(charge)} and download
              </Button>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'warning';
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-text-faint">{icon}</span>
      <span className="flex-1 text-xs text-text-muted">{label}</span>
      <span className={cn('text-xs font-medium', tone === 'warning' && 'text-warning')}>
        {value}
      </span>
    </div>
  );
}

/** Category hues, mirroring the phone app's palette. */
function categoryHue(category: string): string {
  const hues: Record<string, string> = {
    fire: '#C2410C',
    accident: '#B91C1C',
    disorder: '#A21CAF',
    infrastructure: '#0F766E',
    utility: '#1D4ED8',
    corruption: '#7C2D12',
    environment: '#15803D',
    wildlife: '#4D7C0F',
    flood: '#0369A1',
    crime: '#9F1239',
    health: '#0E7490',
    other: '#475569',
  };
  return hues[category] ?? '#475569';
}
