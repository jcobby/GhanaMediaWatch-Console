'use client';

import { useState } from 'react';
import { MapPin, Clock, Play, ImageOff } from 'lucide-react';
import { SampleWatermark } from './SampleWatermark';
import { cn } from '@/lib/cn';

/**
 * How footage is shown anywhere in the console.
 *
 * Three things happen here that must happen identically on every screen:
 *
 * 1. Capture time and place are stamped *on the frame*. This is provenance,
 *    not a caption. The moment a file is downloaded, forwarded to a newsroom
 *    or screenshotted into a WhatsApp group, a caption beside it is gone —
 *    and this footage exists to travel. The claim has to travel with it.
 *
 * 2. Portrait footage keeps its shape. Phone video is portrait and the frame
 *    is landscape, so a blurred, dimmed copy of the same image fills the gap.
 *    The eye reads that as depth; flat black reads as something broken.
 *
 * 3. Unpaid previews carry the sample mark, across the middle where it cannot
 *    be cropped out.
 *
 * Hidden fields are absent rather than shown as a placeholder. A reporter who
 * withheld their location did so for a reason, and "Location hidden" stamped on
 * a frame advertises that there was something to hide.
 *
 * A failed image is handled explicitly. The browser's default — alt text
 * sprawled across the frame beside a broken-file icon — makes the whole console
 * look broken when the fault is one unreachable file. Media served from a CDN
 * will sometimes 404 or expire, so this is a state the console has to own.
 */
export function MediaFrame({
  posterUrl,
  alt,
  when,
  where,
  watermark = false,
  isVideo = false,
  className,
}: {
  posterUrl: string;
  alt: string;
  /** Formatted capture time, or null when the reporter hid it. */
  when: string | null;
  /** Place name, or null when the reporter hid it. */
  where: string | null;
  watermark?: boolean;
  isVideo?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn('relative aspect-[16/9] overflow-hidden rounded-lg bg-glass-media', className)}
    >
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <ImageOff className="h-6 w-6 text-white/35" strokeWidth={1.5} />
          <p className="text-xs text-white/45">Preview unavailable</p>
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterUrl}
        alt=""
        aria-hidden
        className={cn(
          'absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl',
          failed && 'hidden',
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterUrl}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn('relative mx-auto h-full object-contain', failed && 'hidden')}
      />

      {isVideo && !failed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-black/45 backdrop-blur-sm">
            <Play className="ml-0.5 h-5 w-5 text-white" strokeWidth={2} fill="currentColor" />
          </span>
        </div>
      ) : null}

      {watermark && !failed ? <SampleWatermark /> : null}

      {when || where ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none">
          {/* A gradient, not a bar: the stamp has to stay legible over any
              footage without blocking the bottom of the frame. */}
          <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-10">
            <div className="flex flex-col gap-1">
              {where ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  {where}
                </span>
              ) : null}
              {when ? (
                <span className="tabular flex items-center gap-1.5 text-xs font-medium text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">
                  <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  {when}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
