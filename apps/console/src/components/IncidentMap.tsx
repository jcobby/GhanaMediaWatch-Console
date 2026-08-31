'use client';

import {
  CATEGORY_META,
  categoryLabel,
  formatDistance,
  type Cluster,
  type ClusterPoint,
} from '@dawuro/core';
import { cn } from '@/lib/cn';

/** Share of the span left as margin on each side, so nothing sits on the frame. */
const PADDING = 0.14;

/**
 * Where reports are concentrated.
 *
 * Drawn from the coordinates themselves rather than over map tiles. That is a
 * deliberate limitation: a tile server is a third-party dependency that will
 * eventually be down during a demo, and this product already learned that
 * lesson from an image host. Swapping in real tiles later is a change to this
 * one component — the clustering underneath is unaffected.
 *
 * What it must do honestly is show *relative* position and concentration. Two
 * things make that work at the scale a regional dashboard actually holds —
 * a few dozen reports across a city:
 *
 *   1. Points are labelled. An unlabelled dot on an unlabelled grid carries no
 *      information at all; the place name is the whole content.
 *   2. The frame is padded. Without it, the outermost reports land exactly on
 *      the boundary and read as clipped rather than as edges of the data.
 */
export function IncidentMap({
  points,
  clusters,
  selectedClusterId,
  onSelect,
}: {
  points: ClusterPoint[];
  clusters: Cluster[];
  selectedClusterId: string | null;
  onSelect: (clusterId: string | null) => void;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-md border border-hairline/[0.08] bg-canvas-raise/40">
        <p className="text-xs text-text-faint">No located reports in this period.</p>
      </div>
    );
  }

  const lats = points.map((p) => p.location.latitude);
  const lngs = points.map((p) => p.location.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // A floor on the span stops two reports 50m apart filling the whole plot,
  // and the padding is applied on top so extremes never touch the frame.
  const rawLat = Math.max(0.01, maxLat - minLat);
  const rawLng = Math.max(0.01, maxLng - minLng);
  const latSpan = rawLat * (1 + PADDING * 2);
  const lngSpan = rawLng * (1 + PADDING * 2);
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;

  const x = (lng: number) => ((lng - (cLng - lngSpan / 2)) / lngSpan) * 100;
  // Latitude rises northward; SVG y rises downward.
  const y = (lat: number) => (1 - (lat - (cLat - latSpan / 2)) / latSpan) * 100;

  const clusterOf = new Map<string, Cluster>();
  for (const cluster of clusters) {
    for (const id of cluster.pointIds) clusterOf.set(id, cluster);
  }

  // One label per cluster rather than per point, or nearby reports overprint
  // each other into an unreadable smear.
  const labelled = clusters.filter((c) => c.label);

  return (
    <div className="relative h-[280px] overflow-hidden rounded-md border border-hairline/[0.08] bg-canvas-raise/25">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern id="dawuro-grid" width="12.5" height="12.5" patternUnits="userSpaceOnUse">
            <path
              d="M 12.5 0 L 0 0 0 12.5"
              fill="none"
              stroke="rgb(14 16 36 / 0.045)"
              strokeWidth="0.25"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#dawuro-grid)" />
      </svg>

      {/* Halos behind the points, sized by how many reports sit together. */}
      {clusters
        .filter((c) => c.pointIds.length > 1)
        .map((cluster) => {
          const size = Math.min(56, 22 + cluster.pointIds.length * 7);
          const active = selectedClusterId === cluster.id;
          return (
            <span
              key={`halo-${cluster.id}`}
              aria-hidden
              className={cn(
                'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-pill transition',
                active && 'ring-2 ring-accent',
              )}
              style={{
                left: `${x(cluster.centre.longitude)}%`,
                top: `${y(cluster.centre.latitude)}%`,
                width: size,
                height: size,
                backgroundColor: `${CATEGORY_META[cluster.dominantCategory]?.hue ?? '#475569'}22`,
              }}
            />
          );
        })}

      {points.map((point) => {
        const cluster = clusterOf.get(point.id);
        const dimmed = selectedClusterId !== null && cluster?.id !== selectedClusterId;
        const hue = CATEGORY_META[point.category]?.hue ?? '#475569';
        return (
          <button
            key={point.id}
            type="button"
            onClick={() =>
              onSelect(cluster && cluster.id !== selectedClusterId ? cluster.id : null)
            }
            aria-label={`${categoryLabel(point.category)}${point.label ? ` at ${point.label}` : ''}`}
            title={`${categoryLabel(point.category)}${point.label ? ` — ${point.label}` : ''}`}
            className={cn(
              'absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-pill ring-2 ring-canvas-soft transition hover:scale-125',
              dimmed && 'opacity-30',
            )}
            style={{
              left: `${x(point.location.longitude)}%`,
              top: `${y(point.location.latitude)}%`,
              backgroundColor: hue,
            }}
          />
        );
      })}

      {/* Place names. Without these the plot is dots on graph paper. */}
      {labelled.map((cluster) => {
        const left = x(cluster.centre.longitude);
        const dimmed = selectedClusterId !== null && cluster.id !== selectedClusterId;
        // Labels flip to the inside near an edge rather than overflowing.
        const alignRight = left > 62;
        return (
          <span
            key={`label-${cluster.id}`}
            className={cn(
              'pointer-events-none absolute max-w-[42%] -translate-y-1/2 truncate text-2xs font-medium text-text-secondary transition',
              alignRight ? '-translate-x-full pr-3.5 text-right' : 'pl-3.5',
              dimmed && 'opacity-30',
            )}
            style={{
              left: `${left}%`,
              top: `${y(cluster.centre.latitude)}%`,
            }}
          >
            {cluster.label}
            {cluster.pointIds.length > 1 ? (
              <span className="tabular ml-1 text-text-faint">×{cluster.pointIds.length}</span>
            ) : null}
          </span>
        );
      })}

      {/* A scale, because an unlabelled grid invites people to read distance
          off it and be wrong. */}
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-xs bg-canvas-soft/85 px-2 py-1 text-2xs text-text-muted backdrop-blur-sm">
        <span className="block h-px w-8 bg-text-muted" />
        {formatDistance(approxWidthM(lngSpan, cLat) / 4)}
      </div>

      <p className="pointer-events-none absolute right-2 top-2 rounded-xs bg-canvas-soft/85 px-2 py-1 text-2xs text-text-faint backdrop-blur-sm">
        Relative positions — not a street map
      </p>
    </div>
  );
}

/** Rough metres across the plotted longitude span at this latitude. */
function approxWidthM(lngSpan: number, atLat: number): number {
  const metresPerDegree = 111_320 * Math.cos((atLat * Math.PI) / 180);
  return lngSpan * metresPerDegree;
}
