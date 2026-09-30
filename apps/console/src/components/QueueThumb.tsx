'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Mic, Play } from 'lucide-react';
import { MIN_PLAUSIBLE_MEDIA_BYTES, type Incident } from '@dawuro/core';
import { mediaHref } from '@/lib/mediaHref';
import { cn } from '@/lib/cn';

/**
 * What a queue row holds, small enough to scan.
 *
 * The row said what a reporter wrote and nothing about what they filmed, so
 * choosing the next report meant opening them one at a time to see whether the
 * footage was a flood, a blank frame or a test file. A still is recognised
 * faster than a sentence is read.
 *
 * **The service's 320px thumb, not the file.** Every upload now gets a small
 * JPEG copy, photo or video. That is a few tens of kilobytes where the original
 * was megabytes, and it is the same request for a clip as for a photo.
 *
 * A clip the service has not finished processing has no thumb yet. Only then
 * does the row fall back to the clip's own first frame, from
 * `preload="metadata"` — a range request, not the clip.
 *
 * **Loaded only when it comes into view.** The queue is fifty rows, each behind
 * a media lookup through this console; fetching them all on load would put fifty
 * of them ahead of the report the editor actually opened.
 *
 * Nothing is fetched for a file too small to be a capture: the probes in the
 * queue hold a few kilobytes of random data.
 */
export function QueueThumb({
  incident,
  className = 'h-[54px] w-[72px]',
}: {
  incident: Incident;
  /**
   * The frame's size, because the two queues that use this are shaped
   * differently — the editorial row is landscape, the inbox row is portrait.
   * Only the box: everything inside fills it.
   */
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  /** The thumb would not load; for a clip, try its first frame instead. */
  const [thumbFailed, setThumbFailed] = useState(false);
  const [failed, setFailed] = useState(false);

  const kind = incident.media.kind;
  const size = incident.media.byteSize;
  const tooSmall = typeof size === 'number' && size < MIN_PLAUSIBLE_MEDIA_BYTES;
  const processing = incident.media.status === 'processing';

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // A little ahead of the fold, so a row scrolled to is already drawn.
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const frameFallback = kind === 'video' && thumbFailed;

  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xs bg-glass-media',
        className,
      )}
    >
      {kind === 'audio' ? (
        <Mic className="h-4 w-4 text-white/60" strokeWidth={2} />
      ) : tooSmall || failed || (thumbFailed && kind !== 'video') ? (
        <ImageOff className="h-4 w-4 text-white/35" strokeWidth={1.75} />
      ) : !visible ? null : frameFallback ? (
        <video
          src={`${mediaHref(incident.id)}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          onError={() => setFailed(true)}
          className="pointer-events-none h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaHref(incident.id, 'thumb')}
          alt=""
          decoding="async"
          onError={() => setThumbFailed(true)}
          className="h-full w-full object-cover"
        />
      )}

      {kind === 'video' && visible && !tooSmall && !failed ? (
        <span className="absolute flex h-5 w-5 items-center justify-center rounded-pill bg-black/55">
          {processing ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin text-white" strokeWidth={2.5} />
          ) : (
            <Play className="ml-px h-2.5 w-2.5 text-white" strokeWidth={2} fill="currentColor" />
          )}
        </span>
      ) : null}
    </span>
  );
}
