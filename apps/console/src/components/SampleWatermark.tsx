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
          className="whitespace-nowrap text-5xl font-bold uppercase tracking-[0.3em] text-white/25"
          style={{
            transform: 'rotate(-24deg)',
            // A soft dark edge keeps the mark readable over pale footage —
            // white-on-white would make it vanish exactly where it matters.
            textShadow: '0 2px 14px rgba(0,0,0,0.55)',
          }}
        >
          Sample
        </span>
      </div>
    </div>
  );
}
