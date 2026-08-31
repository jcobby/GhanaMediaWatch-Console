import { haversineMetres, type LatLng } from '../lib/geo';
import type { IncidentCategory } from '../types/api';

/**
 * Finding where things are happening, and when.
 *
 * A queue answers "what came in". A dashboard has to answer "where is this
 * concentrated" and "is it getting worse" — questions no list of reports can
 * be read for. Both are pure functions over the reports themselves, which
 * means the same numbers appear on every screen and in every export.
 */

// ─── spatial clustering ────────────────────────────────────────────────────

export interface ClusterPoint {
  id: string;
  location: LatLng;
  category: IncidentCategory;
  label: string | null;
  atIso: string;
}

export interface Cluster {
  id: string;
  centre: LatLng;
  pointIds: string[];
  /** Distance from the centre to the furthest member. */
  radiusM: number;
  /** The category most of these belong to. */
  dominantCategory: IncidentCategory;
  /** How mixed the cluster is, 0..1. High means several kinds of problem. */
  mixed: number;
  /** The commonest place name among members. */
  label: string | null;
  newestAtIso: string;
}

/**
 * Group nearby reports.
 *
 * Single-link agglomeration against a running centroid, which is simple enough
 * to reason about and stable enough to demo: the same input always produces the
 * same clusters, because points are visited in a fixed order.
 *
 * A proper spatial index would matter at tens of thousands of points. At the
 * scale a regional dashboard actually shows — hundreds — it would be effort
 * spent to make an already instant operation faster.
 */
export function clusterPoints(points: ClusterPoint[], radiusM = 1_500): Cluster[] {
  const ordered = [...points].sort((a, b) => a.id.localeCompare(b.id));
  const groups: ClusterPoint[][] = [];

  for (const point of ordered) {
    const home = groups.find((group) => {
      const centre = centroid(group);
      return haversineMetres(centre, point.location) <= radiusM;
    });
    if (home) home.push(point);
    else groups.push([point]);
  }

  return groups
    .map((group, index) => {
      const centre = centroid(group);
      const counts = new Map<IncidentCategory, number>();
      const labels = new Map<string, number>();

      for (const p of group) {
        counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
        if (p.label) labels.set(p.label, (labels.get(p.label) ?? 0) + 1);
      }

      const dominantCount = Math.max(...counts.values());
      const dominantCategory = [...counts.entries()]
        .filter(([, n]) => n === dominantCount)
        .map(([c]) => c)
        .sort()[0]!;

      return {
        id: `cl_${index}`,
        centre,
        pointIds: group.map((p) => p.id),
        radiusM: Math.round(
          group.reduce((max, p) => Math.max(max, haversineMetres(centre, p.location)), 0),
        ),
        dominantCategory,
        // 0 when everything is the same problem, approaching 1 when nothing is.
        mixed: group.length <= 1 ? 0 : 1 - dominantCount / group.length,
        label: topKey(labels),
        newestAtIso: group.reduce(
          (newest, p) => (Date.parse(p.atIso) > Date.parse(newest) ? p.atIso : newest),
          group[0]!.atIso,
        ),
      };
    })
    .sort((a, b) => b.pointIds.length - a.pointIds.length || a.id.localeCompare(b.id));
}

function centroid(points: ClusterPoint[]): LatLng {
  const lat = points.reduce((sum, p) => sum + p.location.latitude, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.location.longitude, 0) / points.length;
  return { latitude: lat, longitude: lng };
}

function topKey(counts: Map<string, number>): string | null {
  if (counts.size === 0) return null;
  const max = Math.max(...counts.values());
  return (
    [...counts.entries()]
      .filter(([, n]) => n === max)
      .map(([k]) => k)
      .sort()[0] ?? null
  );
}

/**
 * Clusters worth someone's attention.
 *
 * More than one report is the bar, because a single incident is a report — it
 * only becomes a pattern when it repeats. Ranked by size and then recency, so a
 * large stale cluster does not outrank a growing fresh one indefinitely.
 */
export function hotspots(clusters: Cluster[], minSize = 2): Cluster[] {
  return clusters
    .filter((c) => c.pointIds.length >= minSize)
    .sort(
      (a, b) =>
        b.pointIds.length - a.pointIds.length ||
        Date.parse(b.newestAtIso) - Date.parse(a.newestAtIso),
    );
}

// ─── timeline ──────────────────────────────────────────────────────────────

export interface TimeBucket {
  /** Start of the bucket. */
  startIso: string;
  count: number;
}

export type BucketSize = 'hour' | 'day';

const BUCKET_MS: Record<BucketSize, number> = {
  hour: 3_600_000,
  day: 86_400_000,
};

/**
 * Counts over time, with empty periods included.
 *
 * The gaps are the point. A series that silently omits quiet days draws a
 * continuous line through them and makes a two-day lull look like steady
 * activity, which is exactly backwards for spotting when something started.
 */
export function bucketByTime(
  timestamps: string[],
  size: BucketSize,
  fromIso: string,
  toIso: string,
): TimeBucket[] {
  const step = BUCKET_MS[size];
  const from = Math.floor(Date.parse(fromIso) / step) * step;
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];

  const counts = new Map<number, number>();
  for (const iso of timestamps) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t) || t < from || t > to) continue;
    const bucket = Math.floor(t / step) * step;
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const out: TimeBucket[] = [];
  for (let t = from; t <= to; t += step) {
    out.push({
      startIso: new Date(t).toISOString(),
      count: counts.get(t) ?? 0,
    });
  }
  return out;
}

/**
 * Whether activity is rising, and by how much.
 *
 * Compares the most recent half of the series against the earlier half.
 * Returns null when there is too little to say — reporting a trend from two
 * data points is how a dashboard starts lying.
 */
export function trend(
  buckets: TimeBucket[],
): { direction: 'up' | 'down' | 'flat'; change: number } | null {
  if (buckets.length < 4) return null;

  const mid = Math.floor(buckets.length / 2);
  const earlier = buckets.slice(0, mid).reduce((sum, b) => sum + b.count, 0);
  const later = buckets.slice(mid).reduce((sum, b) => sum + b.count, 0);

  if (earlier === 0 && later === 0) return { direction: 'flat', change: 0 };
  if (earlier === 0) return { direction: 'up', change: 1 };

  const change = (later - earlier) / earlier;
  if (Math.abs(change) < 0.1) return { direction: 'flat', change };
  return { direction: change > 0 ? 'up' : 'down', change };
}
