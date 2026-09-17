import { NextResponse } from 'next/server';
import { isLiveBackend } from '@/lib/api';
import { ApiUnavailable } from '@/lib/apiError';
import { readSession } from '@/lib/session';
import { freshMediaUrl } from '@/lib/media';

/**
 * A report's footage, served from this console's own origin.
 *
 * **Signed media URLs expire, and a desk outlives them.** `GET /v1/media/{id}`
 * takes `?exp=…&sig=…`, and the signature is good for about five minutes —
 * measured against the live service, a URL minted at 09:55:15 answered 200 five
 * seconds later and `403 FORBIDDEN: Media URL signature is missing or expired`
 * an hour and a half after that.
 *
 * The verification desk is server-rendered once and then worked for as long as
 * the queue takes. Every report's URL was minted at that render and handed
 * straight to an `<img>` and a `<video>` in the browser, so an editor who spent
 * five minutes on the first report and clicked the second was shown *The file
 * could not be opened* — about footage that was on the server the whole time,
 * on the one screen whose entire job is looking at it. Reloading fixed it for
 * another five minutes, which is exactly the kind of intermittent that gets
 * written off as a flaky network.
 *
 * Proxying moves the signature to the moment the bytes are actually wanted. The
 * browser asks this console; this console asks the service for a fresh URL and
 * streams the answer back. The URL in the page never expires because it carries
 * no signature at all.
 *
 * **Two other things it fixes on the way.** The API origin stops leaking into
 * the page — `DAWURO_API_URL` is deliberately not a `NEXT_PUBLIC_` variable and
 * every media tag was publishing it anyway. And the dev tunnel's
 * anti-phishing header can be sent, which an `<img>` tag can never do.
 *
 * Access is checked here rather than assumed. Media is the most sensitive thing
 * this console serves: unpublished footage of identifiable people, filmed by
 * reporters who are frequently anonymous.
 */
export async function GET(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const session = await readSession();
  /*
   * Signed in, or nothing. No distinction between "not signed in" and "not
   * allowed": an unpublished queue should not be enumerable by anybody who can
   * send a request, and a 403 confirms the report exists.
   */
  if (!session?.accessToken || !isLiveBackend) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const { incidentId } = await context.params;

  /*
   * Which copy: `?v=thumb` for a list, `?v=view` for a large still, nothing for
   * the playable media. Anything else is the default rather than an error — a
   * mistyped variant should still show the report.
   */
  const requested = new URL(request.url).searchParams.get('v');
  const variant = requested === 'thumb' || requested === 'view' ? requested : 'default';

  let url: string | null;
  try {
    url = await freshMediaUrl(incidentId, session.accessToken, {
      variant,
      // An organisation's own reports are read under its scope header.
      orgId: session.businessId ?? null,
    });
  } catch (cause) {
    /*
     * The service refused the caller, not the console. A 403 from `/editorial`
     * or `/incidents` is this account being told it may not read this report,
     * and it is answered as a 404 for the reason above.
     */
    const status = cause instanceof ApiUnavailable ? cause.status : 502;
    // The client is told 404 for a refusal; whoever runs the console sees the truth.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`  MEDIA lookup failed ${incidentId} ${status}`);
    }
    return NextResponse.json(
      { error: status === 403 || status === 404 ? 'Not found.' : 'The service did not answer.' },
      { status: status === 403 ? 404 : status },
    );
  }

  if (!url) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`  MEDIA lookup found no media url ${incidentId}`);
    }
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const range = request.headers.get('range');

  let upstream: Response;
  try {
    /*
     * The player's own range request, passed through.
     *
     * `GET /v1/media/{id}` now answers `Accept-Ranges: bytes` and a 206 with
     * `Content-Range` — so a clip starts on the first frames instead of the
     * whole file, and the scrubber works. Swallowing the header here would
     * throw that away and leave a proxy that is strictly worse than the direct
     * URL it replaced.
     */
    upstream = await fetch(url, {
      headers: {
        // An <img> cannot send this; a dev tunnel answers an unrecognised
        // client with an HTML interstitial without it.
        'X-Tunnel-Skip-AntiPhishing-Page': 'true',
        Authorization: `Bearer ${session.accessToken}`,
        ...(range ? { Range: range } : {}),
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'The media service could not be reached.' }, { status: 502 });
  }

  const upstreamType = upstream.headers.get('Content-Type') ?? 'application/octet-stream';

  /*
   * Printed once per media request, because this is the fact that was missing.
   *
   * "The file could not be opened" covered an expired signature, a 404, a codec
   * the browser cannot decode and a container it will not even try — four
   * different problems with one sentence, and diagnosing them from the outside
   * cost two wrong answers. The content type and the status are now on the
   * terminal of whoever is looking.
   *
   * Before the failure exit, not after it. It used to print only for answers
   * that succeeded, so the requests anybody needed to see were the ones that
   * never appeared.
   */
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `  MEDIA ${upstream.status} ${incidentId} ${upstreamType}` +
        `${range ? ` range=${range}` : ''}`,
    );
  }

  /*
   * 206 is a success. `Response.ok` is 200-299 so it is already included, and
   * this is only spelled out because treating a partial answer as a failure is
   * the obvious way to break seeking while every other test still passes.
   */
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: 'That file could not be read.' },
      { status: upstream.status },
    );
  }

  /*
   * Streamed, not buffered. A sixty-second clip is several megabytes and
   * reading it into memory to hand it on would hold all of it per viewer, per
   * request, on a server rendering a queue of them.
   */
  const passThrough = (name: string) => {
    const value = upstream.headers.get(name);
    return value ? { [name]: value } : {};
  };

  /*
   * A photograph is sent as a photograph, whatever the service labelled it.
   *
   * Found on the live service: a photo report — stored as `image/jpeg`, filed
   * from the phone as `image/jpeg`, integrity passed — streamed from
   * `GET /v1/media/{id}` labelled as video. This route passed the label on, and
   * a browser will not draw an `<img>` whose response says it is a video, so
   * the desk showed "The file could not be opened" about a photograph that had
   * arrived intact.
   *
   * The first bytes settle it. A JPEG, PNG, GIF or WebP signature is an image
   * however it was labelled, and naming it correctly is what lets the browser
   * draw it. Only at the start of the file — a range from the middle of a clip
   * has no signature to read — and only when the label is not already an image.
   * The chunk read is handed straight back into the stream, so nothing is
   * buffered beyond it.
   */
  const imageTypeOf = (head: Uint8Array): string | null => {
    const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
    if (head.length >= 4 && ascii(1, 4) === 'PNG') return 'image/png';
    if (head.length >= 4 && ascii(0, 4) === 'GIF8') return 'image/gif';
    if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
    return null;
  };

  let body: ReadableStream<Uint8Array> = upstream.body;
  let contentType = browserPlayable(upstreamType);
  const fromStart = !range || /^bytes=0-/.test(range);

  if (fromStart && !upstreamType.toLowerCase().startsWith('image/')) {
    const reader = upstream.body.getReader();
    const first = await reader.read();
    const head = first.value ?? new Uint8Array(0);
    const image = imageTypeOf(head);
    if (image) {
      contentType = image;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`  MEDIA relabelled ${incidentId} ${upstreamType} -> ${image}`);
      }
    }
    body = new ReadableStream<Uint8Array>({
      start(controller) {
        if (first.done) controller.close();
        else if (head.length) controller.enqueue(head);
      },
      async pull(controller) {
        const next = await reader.read();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
  }

  return new NextResponse(body, {
    // The upstream's own status: 200 for the whole file, 206 for a range. A
    // hard 200 on a partial body is how a player ends up reading the middle of
    // a clip as its beginning.
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
      ...passThrough('Content-Length'),
      // Without these two a browser will not offer a scrubber at all: the first
      // tells it ranges are available, the second says which one this is.
      ...passThrough('Accept-Ranges'),
      ...passThrough('Content-Range'),
      /*
       * Private, and long enough to be worth having.
       *
       * `private` is not negotiable: the bytes are unpublished evidence and no
       * shared cache may hold them. The lifetime was sixty seconds, which is
       * roughly the worst of both — long enough to be a cache, too short to
       * stop the desk re-downloading every photograph in the queue each time an
       * editor scrolled back to it. An hour matches the signed URL's own
       * deadline upstream, so nothing is held past the window the service
       * itself considers current, and `immutable` says what is true of an
       * incident's media: these bytes do not change.
       *
       * `stale-while-revalidate` is what removes the visible wait after that:
       * the browser draws the copy it has and refreshes it behind the scenes,
       * rather than blanking the frame while it asks again.
       */
      'Cache-Control': 'private, max-age=3600, immutable, stale-while-revalidate=86400',
      // Never guessed as HTML, whatever the upstream said.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * The content type to hand a browser, which is not always the one stored.
 *
 * **`video/quicktime` is unplayable in Chrome and Edge.** `canPlayType` answers
 * the empty string for it, so a `<video>` element fails with
 * `MEDIA_ERR_SRC_NOT_SUPPORTED` before it fetches a single frame — no request,
 * no decode, nothing to debug from the network tab.
 *
 * And every clip this platform holds is one. `expo-camera` on iOS writes `.mov`,
 * the app declares `video/quicktime` from the extension, and the service stores
 * and serves exactly that. So the verification desk could not play any footage
 * a reporter had filmed on an iPhone, while the phone played all of it — iOS
 * `AVPlayer` handles QuickTime natively, which is why this never surfaced on the
 * side that records it.
 *
 * A QuickTime container holding H.264 and AAC is what an iPhone produces, and it
 * is structurally an ISO base media file: relabelled `video/mp4`, browsers
 * decode it. This is the standard remedy and it is a relabel, not a transcode —
 * the bytes are untouched.
 *
 * **It does not help if the codec itself is unsupported.** An iPhone set to
 * "High Efficiency" records HEVC, which Chrome cannot decode however it is
 * labelled. That case now fails as a decode error rather than an unsupported
 * source, and `MediaFrame` says which — a distinction worth having, because one
 * is fixable here and the other needs the file transcoding.
 */
function browserPlayable(contentType: string): string {
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const quicktime = base === 'video/quicktime' || base === 'video/x-quicktime';
  if (!quicktime) return contentType;

  /*
   * The codec parameter, where the phone sent one, decides whether relabelling
   * is honest.
   *
   * An iPhone's `.mov` holding H.264 is an ISO base media file wearing the
   * wrong label, and calling it `video/mp4` is a correction. The same `.mov`
   * holding HEVC is not: no desktop browser can decode it, and relabelling only
   * moves the failure from "unsupported source" — which a browser reports
   * immediately and precisely — to a decode error several seconds later. Worse
   * for the editor, and worse for anybody trying to work out why.
   *
   * So HEVC keeps its own label and the frame says what is wrong. New captures
   * no longer produce it: the app now asks iOS for `avc1` explicitly. This is
   * for the clips already stored, which need transcoding on the server — item 5
   * in BACKEND-REQUESTS.
   */
  const codec = /codecs\s*=\s*"?([a-z0-9.]+)"?/i.exec(contentType)?.[1]?.toLowerCase();
  if (codec?.startsWith('hvc1') || codec?.startsWith('hev1')) return contentType;

  return 'video/mp4';
}

/*
 * Never prerendered or cached by the framework. The signature is minted per
 * request and the bytes are unpublished evidence; a cached response would
 * outlive both the signature and the reader's right to see it.
 */
export const dynamic = 'force-dynamic';
