'use client';

import { useState } from 'react';
import { MapPin, Clock, Play, ImageOff } from 'lucide-react';
import { MIN_PLAUSIBLE_MEDIA_BYTES } from '@dawuro/core';
import { SampleWatermark } from './SampleWatermark';
import { cn } from '@/lib/cn';

/**
 * What actually went wrong, in the reader's terms.
 *
 * `MediaError.code` is the browser's own answer and the console was throwing it
 * away. Each of these sends whoever reads it somewhere different, which is the
 * entire point: "the signature expired" is a reload, "this browser cannot
 * decode it" is a transcode, and "the file is not there" is a platform fault.
 * One sentence covering all three sent two investigations down the wrong path.
 */
const PLAYBACK_FAILURE: Record<number, string> = {
  // MEDIA_ERR_ABORTED — the reader navigated away mid-load. Not a fault.
  1: 'Loading was interrupted. Try again.',
  // MEDIA_ERR_NETWORK
  2: 'The connection dropped while loading this. The report itself is intact — try again.',
  // MEDIA_ERR_DECODE — the container opened and the codec is unplayable here.
  3: 'This browser cannot decode this footage. It is most likely HEVC, which iPhones record by default on the High Efficiency setting — the file is fine, this browser simply cannot play it. Open it directly, or view it on the phone.',
  // MEDIA_ERR_SRC_NOT_SUPPORTED — refused before a byte was fetched.
  4: 'This browser will not open this kind of file. The report is intact and the footage is on the server.',
  // No code: the <img> path, or an error the element did not classify.
  0: 'The file could not be opened. Everything else about this report is intact.',
};

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
 *    The frame is 4:3 rather than 16:9 for the same reason. Every capture
 *    this platform holds comes off a phone held upright, and a widescreen
 *    box spent more than half its width on blur — on the one screen whose
 *    whole job is looking at the footage. Capped against the viewport so a
 *    wide column cannot push the rest of the case below the fold.
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
  videoUrl,
  alt,
  when,
  where,
  watermark = false,
  isVideo = false,
  byteSize,
  className,
}: {
  /**
   * A still image. Frequently empty — the service generates no poster frame for
   * video — in which case `videoUrl` is the only thing there is to show.
   */
  posterUrl: string;
  /**
   * The footage itself, played in place.
   *
   * Absent for a photo report, and absent wherever a caller has not yet been
   * given the URL, in which case the frame behaves as it always did.
   */
  videoUrl?: string;
  alt: string;
  /** Formatted capture time, or null when the reporter hid it. */
  when: string | null;
  /** Place name, or null when the reporter hid it. */
  where: string | null;
  watermark?: boolean;
  isVideo?: boolean;
  /**
   * What the server says the stored file weighs.
   *
   * The one fact that separates footage from a placeholder before anything
   * tries to decode it. `media.byteSize` is on every incident record and was
   * not being read, so a report holding two kilobytes of filler rendered as a
   * black rectangle with a working play button — indistinguishable from a clip
   * that had not buffered yet.
   */
  byteSize?: number | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  /*
   * *Which* failure, from the element that had the answer all along.
   *
   * "The file could not be opened" covered an expired signature, a missing
   * file, a container the browser will not open and a codec it cannot decode —
   * four different problems, one sentence, and no way to tell them apart from
   * the outside. Two of them were diagnosed wrongly before this existed.
   *
   * `MediaError.code` separates them, and the browser has always set it.
   */
  const [mediaError, setMediaError] = useState<number | null>(null);

  /*
   * Too small to be footage, decided before the player is given it.
   *
   * Measured on the live service: the phone's own uploads are 3.5 MB of valid
   * MP4, while the integration probes that share the queue with them hold
   * 2 048, 4 096 or 8 192 bytes of random data with no container header at all.
   * The player cannot say anything useful about those — it shows 0:00 on a
   * black frame — and an editor is left deciding whether to wait, reload, or
   * conclude the platform is broken.
   *
   * The floor lives in `@dawuro/core` because the score uses it too: a file
   * below it is rated as having no footage at all. A second copy here would
   * drift, and the first sign would be a frame saying "unplayable" beside a
   * score of 5 out of 5 for visual strength.
   */
  const tooSmall = typeof byteSize === 'number' && byteSize < MIN_PLAUSIBLE_MEDIA_BYTES;
  const empty = byteSize === 0;

  /*
   * A real player, whenever there is something to play.
   *
   * `isVideo` used to draw a play button over the still and stop there —
   * decorative, wired to nothing, and sitting on a frame that was usually empty
   * anyway, because the service stores `posterUrl: null` for every clip. So the
   * `<img>` had no source, the frame was black, and the triangle did not
   * respond to a click. An operator deciding which newsroom receives footage
   * could not watch the footage.
   *
   * The stamp and the sample mark stay over the player; both are
   * `pointer-events-none`, so the controls underneath still take clicks. The
   * stamp matters more here than on a still, not less — this is the frame
   * somebody screenshots and forwards.
   */
  if (videoUrl && !failed && !tooSmall) {
    return (
      <div
        className={cn(
          'relative aspect-[4/3] max-h-[62vh] overflow-hidden rounded-lg bg-glass-media',
          className,
        )}
      >
        <video
          src={videoUrl}
          poster={posterUrl || undefined}
          controls
          preload="metadata"
          playsInline
          onError={(event) => {
            setMediaError(event.currentTarget.error?.code ?? null);
            setFailed(true);
          }}
          className="absolute inset-0 h-full w-full object-contain"
        />
        {watermark ? <SampleWatermark /> : null}
        <ProvenanceStamp when={when} where={where} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative aspect-[4/3] max-h-[62vh] overflow-hidden rounded-lg bg-glass-media',
        className,
      )}
    >
      {failed || tooSmall ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <ImageOff className="h-6 w-6 text-white/35" strokeWidth={1.5} />
          {/*
            Three different failures, told apart.

            They used to share one sentence — "the file is no longer on the
            server" — which is right for only one of them and sends a reviewer
            chasing the wrong thing for the other two. Retrying helps in none of
            these cases, so the message has to say which it is.
          */}
          <p className="text-xs text-white/45">
            {empty
              ? 'Nothing was uploaded for this report — the stored file is empty.'
              : tooSmall
                ? `This is not playable footage. The stored file is ${Math.round((byteSize ?? 0) / 1024)} KB, far too small to be a capture — usually a test submission rather than a real report.`
                : PLAYBACK_FAILURE[mediaError ?? 0]}
          </p>

          {/*
            A way to the file when this browser will not play it.

            A codec problem is not a missing report: the bytes are there and an
            editor ruling on footage has to be able to see it. Opening it
            outside the console hands it to whatever the machine does have —
            and on a decision this consequential, "we cannot show you this" is
            not an acceptable last word.
          */}
          {videoUrl && !empty && !tooSmall ? (
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-white/20 px-2.5 py-1 text-2xs text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Open the file directly
            </a>
          ) : null}
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterUrl}
        alt=""
        aria-hidden
        className={cn(
          'absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl',
          (failed || tooSmall) && 'hidden',
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterUrl}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn('relative mx-auto h-full object-contain', (failed || tooSmall) && 'hidden')}
      />

      {isVideo && !failed && !tooSmall ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-black/45 backdrop-blur-sm">
            <Play className="ml-0.5 h-5 w-5 text-white" strokeWidth={2} fill="currentColor" />
          </span>
        </div>
      ) : null}

      {watermark && !failed && !tooSmall ? <SampleWatermark /> : null}

      <ProvenanceStamp when={when} where={where} />
    </div>
  );
}

/**
 * Capture time and place, burned onto the frame.
 *
 * Extracted so the player and the still render an identical stamp. This is the
 * claim that has to survive a screenshot, and a version of it that appeared on
 * one branch and not the other would be worse than none — footage would travel
 * with no provenance precisely when somebody chose to watch it first.
 */
function ProvenanceStamp({ when, where }: { when: string | null; where: string | null }) {
  if (!when && !where) return null;

  return (
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
  );
}
