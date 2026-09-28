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
 * What a file is, from its first bytes rather than its label.
 *
 * The label is what failed: a photograph on the live service arrived tagged as
 * video, and the only way to tell a mislabelled JPEG from footage filed under
 * the wrong kind is to look at the bytes themselves.
 */
function formatOf(head: Uint8Array): string {
  if (head.length < 4) return 'too few bytes to tell';
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'the bytes are a JPEG';
  if (ascii(1, 4) === 'PNG') return 'the bytes are a PNG';
  if (ascii(4, 8) === 'ftyp') return `the bytes are ISO media, brand ${ascii(8, 12).trim()}`;
  const hex = Array.from(head.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join(' ');
  return `the bytes start ${hex}`;
}

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
   * A still image, where one exists.
   *
   * **Optional, because for video on this service one never does.** Every
   * `posterUrl`, `thumbUrl` and `viewUrl` comes back null for a clip, so a
   * caller asking the media route for a still of a video gets a 404 every
   * time — a failing request per report, in the network tab of the screen
   * whose footage is under suspicion, pointing at the wrong thing. Omitted,
   * the player shows its own first frame, which is what it was going to show
   * anyway.
   */
  posterUrl?: string;
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
   * What the console's media route said, when the browser would not say.
   *
   * An `<img>` that fails carries no reason at all — no status, no code — so a
   * photo that would not load showed the one sentence that fits every cause, and
   * the only way to find out which was to go digging in a terminal. The route
   * already answers with a status and a sentence; this asks it for one byte and
   * puts that answer on the frame.
   *
   * One byte, because the question is "will you give me this file", not the
   * file. A route that answers with bytes has done its job, and then the fault
   * is what the browser made of them — so the type it was sent is what to show.
   */
  const [serverSaid, setServerSaid] = useState<string | null>(null);
  /*
   * Footage that arrived where a still was expected.
   *
   * Seen on the live service: a report filed as a photo whose media is served
   * as an MP4 (brand `isom`, the service's own web copy). An `<img>` cannot draw
   * that, and "the file could not be opened" was the wrong answer about a file
   * that is perfectly watchable. When the bytes say video, play it.
   */
  const [videoFallback, setVideoFallback] = useState<string | null>(null);
  const playable = videoUrl ?? videoFallback ?? undefined;
  const diagnose = (src: string) => {
    void fetch(src, { headers: { Range: 'bytes=0-15' }, cache: 'no-store' })
      .then(async (response) => {
        if (response.ok) {
          const type = response.headers.get('Content-Type') ?? 'no content type';
          // The first bytes say what the file is, whatever it was labelled.
          const head = new Uint8Array(await response.arrayBuffer().catch(() => new ArrayBuffer(0)));
          const isoMedia = head.length >= 8 && String.fromCharCode(...head.subarray(4, 8)) === 'ftyp';
          // Once only: a fallback that also fails must end in a message, not a loop.
          if (isoMedia && !videoUrl && !videoFallback) {
            // The playable media itself, not the still variant that was asked for.
            setVideoFallback(src.split('?')[0] ?? src);
            setFailed(false);
            return;
          }
          setServerSaid(
            `The file arrived (${response.status}, ${type}, ${formatOf(head)}) but could not be shown here.`,
          );
          return;
        }
        const body: unknown = await response.json().catch(() => null);
        const said =
          body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
            ? (body as { error: string }).error
            : null;
        setServerSaid(`The media route answered ${response.status}${said ? `: ${said}` : '.'}`);
      })
      .catch(() => setServerSaid('The console could not reach its own media route.'));
  };

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
  if (playable && !failed && !tooSmall) {
    return (
      <div
        className={cn(
          'relative aspect-[4/3] max-h-[62vh] overflow-hidden rounded-lg bg-glass-media',
          className,
        )}
      >
        <video
          src={playable}
          // A still that turned out to be footage has no poster worth showing.
          poster={videoUrl && posterUrl ? posterUrl : undefined}
          controls
          preload="metadata"
          playsInline
          onError={(event) => {
            const code = event.currentTarget.error?.code ?? null;
            setMediaError(code);
            setFailed(true);
            // A decode failure is the browser's own verdict on bytes it received.
            // Anything else may be the route refusing, which only the route can say.
            if (code !== 3) diagnose(playable);
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
            The route's own answer, once it has given one — the status and the
            sentence that say which of the causes above this actually is.
          */}
          {/*
            Not under a size verdict. A file too small to be footage is already
            explained in plain words above, and a line of hex beneath that adds
            noise to a message that was complete.
          */}
          {serverSaid && !tooSmall ? (
            <p className="max-w-md font-mono text-2xs text-white/35">{serverSaid}</p>
          ) : null}

          {/*
            A way to the file when this browser will not play it.

            A codec problem is not a missing report: the bytes are there and an
            editor ruling on footage has to be able to see it. Opening it
            outside the console hands it to whatever the machine does have —
            and on a decision this consequential, "we cannot show you this" is
            not an acceptable last word.
          */}
          {playable && !empty && !tooSmall ? (
            <a
              href={playable}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-white/20 px-2.5 py-1 text-2xs text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Open the file directly
            </a>
          ) : null}
        </div>
      ) : null}
      {/*
        Nothing at all when there is no still to draw. An <img> with no src is
        not an empty frame — browsers resolve it against the current document
        and fetch the page itself.
      */}
      {posterUrl ? (
        <>
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
            onError={() => {
              setFailed(true);
              diagnose(posterUrl);
            }}
            className={cn(
              'relative mx-auto h-full object-contain',
              (failed || tooSmall) && 'hidden',
            )}
          />
        </>
      ) : null}

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
