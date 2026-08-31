'use client';

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { trend, type TimeBucket } from '@dawuro/core';
import { cn } from '@/lib/cn';

/**
 * Reports over time.
 *
 * Bars rather than a line, because the underlying data is counts per period
 * and a line implies values between the points that do not exist. Empty periods
 * are drawn as empty — a chart that closes the gaps makes a two-day silence
 * look like steady activity, which is exactly backwards for working out when
 * something started.
 */
export function Timeline({ buckets, label }: { buckets: TimeBucket[]; label: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const direction = trend(buckets);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          {label}
        </p>
        <div className="flex items-center gap-2 text-2xs">
          <span className="tabular text-text-muted">{total} reports</span>
          {direction ? (
            <span
              className={cn(
                'flex items-center gap-1 font-medium',
                direction.direction === 'up' && 'text-warning',
                direction.direction === 'down' && 'text-success',
                direction.direction === 'flat' && 'text-text-faint',
              )}
            >
              {direction.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" />
              ) : direction.direction === 'down' ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {direction.direction === 'flat'
                ? 'steady'
                : `${Math.abs(Math.round(direction.change * 100))}%`}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex h-20 items-end gap-[3px]">
        {buckets.map((bucket) => {
          const height = (bucket.count / max) * 100;
          const date = new Date(bucket.startIso);
          return (
            <div
              key={bucket.startIso}
              /*
               * Full height with the bar pushed to the bottom.
               *
               * `items-end` on the row shrinks each column to its content, so a
               * percentage height inside resolved against zero and every bar
               * collapsed — the chart drew nothing while the header cheerfully
               * reported six reports.
               */
              className="group relative flex h-full flex-1 flex-col justify-end"
              title={`${bucket.count} on ${date.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}`}
            >
              <div
                className={cn(
                  'w-full rounded-t-xs transition',
                  bucket.count === 0 ? 'bg-hairline/[0.06]' : 'bg-accent/70 group-hover:bg-accent',
                )}
                // Empty periods keep a hairline so the gap is visible as a gap
                // rather than as missing data.
                style={{
                  height: bucket.count === 0 ? 2 : `${Math.max(6, height)}%`,
                }}
              />
            </div>
          );
        })}
      </div>

      {buckets.length > 1 ? (
        <div className="mt-1.5 flex justify-between text-2xs text-text-faint">
          <span>{formatEdge(buckets[0]!.startIso)}</span>
          <span>{formatEdge(buckets[buckets.length - 1]!.startIso)}</span>
        </div>
      ) : null}
    </div>
  );
}

function formatEdge(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
