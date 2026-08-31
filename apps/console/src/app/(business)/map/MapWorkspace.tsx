'use client';

import { useMemo, useState } from 'react';
import { Layers, MapPin } from 'lucide-react';
import {
  CATEGORY_META,
  bucketByTime,
  categoryLabel,
  clusterPoints,
  formatRelativeTime,
  hotspots,
  type ClusterPoint,
  type Incident,
} from '@dawuro/core';
import { Panel } from '@/components/ui';
import { IncidentMap } from '@/components/IncidentMap';
import { Timeline } from '@/components/Timeline';
import { cn } from '@/lib/cn';

const WINDOWS = [
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
] as const;

/**
 * Where reports are concentrated, and whether it is getting worse.
 *
 * A queue answers "what came in today". This answers the two questions a queue
 * cannot be read for — is this one incident or a pattern, and is the pattern
 * growing. Those are what turn a subscription into evidence an agency can act
 * on rather than a feed it skims.
 */
export function MapWorkspace({ reports }: { reports: Incident[] }) {
  const [days, setDays] = useState<number>(30);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const now = Date.now();
  const fromIso = new Date(now - days * 86_400_000).toISOString();
  const toIso = new Date(now).toISOString();

  const inWindow = useMemo(
    () =>
      reports.filter((r) => {
        if (category && r.category !== category) return false;
        const t = r.capturedAtIso ? Date.parse(r.capturedAtIso) : NaN;
        return Number.isFinite(t) && t >= Date.parse(fromIso);
      }),
    [reports, category, fromIso],
  );

  /*
   * Only located reports can be mapped. Reports whose reporter hid the
   * location are counted in the timeline but cannot be plotted, and saying so
   * is better than quietly showing fewer points than the total.
   */
  const points: ClusterPoint[] = useMemo(
    () =>
      inWindow
        .filter((r) => r.location.latitude !== null && r.location.longitude !== null)
        .map((r) => ({
          id: r.id,
          location: {
            latitude: r.location.latitude!,
            longitude: r.location.longitude!,
          },
          category: r.category,
          label: r.location.label,
          atIso: r.capturedAtIso ?? toIso,
        })),
    [inWindow, toIso],
  );

  const clusters = useMemo(() => clusterPoints(points), [points]);
  const spots = useMemo(() => hotspots(clusters), [clusters]);
  const hidden = inWindow.length - points.length;

  const buckets = useMemo(
    () =>
      bucketByTime(
        inWindow.map((r) => r.capturedAtIso).filter((t): t is string => t !== null),
        days > 14 ? 'day' : 'hour',
        fromIso,
        toIso,
      ),
    [inWindow, days, fromIso, toIso],
  );

  const categories = useMemo(() => [...new Set(reports.map((r) => r.category))].sort(), [reports]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 px-7 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-0.5 rounded-sm bg-canvas-raise/70 p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setDays(w.days)}
                aria-pressed={days === w.days}
                className={cn(
                  'rounded-xs px-3 py-1.5 text-xs transition',
                  days === w.days
                    ? 'bg-canvas-soft font-medium text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategory(null)}
              aria-pressed={category === null}
              className={cn(
                'rounded-pill border px-2.5 py-1 text-2xs transition',
                category === null
                  ? 'border-accent bg-accent-wash text-accent'
                  : 'border-hairline/12 text-text-muted hover:border-accent/30',
              )}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? null : c)}
                aria-pressed={category === c}
                className={cn(
                  'flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-2xs transition',
                  category === c
                    ? 'border-accent bg-accent-wash text-accent'
                    : 'border-hairline/12 text-text-muted hover:border-accent/30',
                )}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-pill"
                  style={{ backgroundColor: CATEGORY_META[c]?.hue }}
                />
                {categoryLabel(c)}
              </button>
            ))}
          </div>
        </div>

        <Panel className="p-4">
          <IncidentMap
            points={points}
            clusters={clusters}
            selectedClusterId={selectedCluster}
            onSelect={setSelectedCluster}
          />
          {hidden > 0 ? (
            <p className="mt-2 text-2xs text-text-faint">
              {hidden} report{hidden === 1 ? '' : 's'} in this period could not be plotted — the
              reporter hid the location.
            </p>
          ) : null}
        </Panel>

        <Panel className="p-4">
          <Timeline buckets={buckets} label={`Reports over the last ${days} days`} />
        </Panel>

        <Panel className="p-4">
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
            <Layers className="h-3.5 w-3.5" />
            Hotspots
          </p>

          {spots.length === 0 ? (
            <p className="mt-2 text-xs text-text-muted">
              {/* One incident is a report; it becomes a pattern when it repeats. */}
              Nothing has repeated in the same place yet.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-1.5">
              {spots.map((cluster) => {
                const active = selectedCluster === cluster.id;
                return (
                  <li key={cluster.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCluster(active ? null : cluster.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-sm border p-2.5 text-left transition',
                        active
                          ? 'border-accent bg-accent-wash/40'
                          : 'border-hairline/[0.08] hover:border-accent/30',
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-2xs font-semibold text-text-on-dark"
                        style={{
                          backgroundColor: CATEGORY_META[cluster.dominantCategory]?.hue,
                        }}
                      >
                        {cluster.pointIds.length}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          <MapPin className="h-3 w-3 shrink-0 text-text-faint" />
                          {cluster.label ?? 'Unnamed area'}
                        </span>
                        <span className="mt-px block text-2xs text-text-muted">
                          mostly {categoryLabel(cluster.dominantCategory)}
                          {cluster.mixed > 0.3 ? ' · mixed causes' : ''} · within{' '}
                          {(cluster.radiusM / 1000).toFixed(1)} km
                        </span>
                      </span>
                      <span className="shrink-0 text-2xs text-text-faint">
                        {formatRelativeTime(cluster.newestAtIso) ?? ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
