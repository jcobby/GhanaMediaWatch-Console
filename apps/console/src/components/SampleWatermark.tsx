import { cn } from '@/lib/cn';

/**
 * The unpaid-preview watermark.
 *
 * An organisation can see enough of a report to judge whether it is worth
 * buying, and cannot walk away with a usable copy without paying. So the mark
 * sits across the middle of the frame rather than in a corner — a corner mark
 * is cropped out in seconds.
 *
 * This is the *preview* mark, drawn over the player. The downloadable file is
 * watermarked server-side when it is encoded; a client-side overlay protects
 * nothing on its own, because the underlying image is still one request away.
 * Both exist for different reasons and neither replaces the other.
 */
export function SampleWatermark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden select-none', className)}
    >
      <div className="flex h-full w-full items-center justify-center">
        <span
          className="whitespace-nowrap text-6xl font-bold uppercase tracking-[0.3em] text-white/35"
          style={{
            transform: 'rotate(-24deg)',
            /*
             * An outline rather than a drop shadow. Footage brightness is
             * unpredictable — a shadow alone vanishes on dark frames and the
             * fill alone vanishes on bright ones, so the mark carries both a
             * stroke and a glow and survives either.
             */
            WebkitTextStroke: '1px rgba(255,255,255,0.22)',
            textShadow: '0 2px 18px rgba(0,0,0,0.65), 0 0 3px rgba(0,0,0,0.45)',
          }}
        >
          Sample
        </span>
      </div>
    </div>
  );
}
