import 'server-only';
import { apiRequest } from './api';
import { absoluteMedia } from './normaliseRouting';

/**
 * Media the browser can ask for without holding a signature.
 *
 * **Signed media URLs expire.** `GET /v1/media/{id}` is authorised by
 * `?v=…&exp=…&sig=…`. The deadline is now the end of the next UTC hour, but a
 * console page is server-rendered once and then worked for as long as the queue
 * takes, so a URL taken from the render still goes stale on a long shift. When
 * it did, every frame on the page became *The file could not be opened*, about
 * footage that was on the server the whole time.
 *
 * So a page points at `/api/media/{incidentId}` on this console's own origin, and
 * the signature is minted when the bytes are actually wanted.
 */

/**
 * The path a page points at lives in `lib/mediaHref` — client-safe, because
 * every screen that shows footage is a client component and this module is
 * `server-only`.
 */

/**
 * Which copy of a report's media is wanted.
 *
 * The service now makes copies when an upload completes: an H.264 MP4 web copy
 * of every video, a JPEG poster, a `thumb` at about 320px and a `view` at about
 * 1280px. A queue row needs the thumb and nothing more — pulling a 3 MB original
 * to draw a 72px square was what made the desk slow to scroll.
 *
 * - `default` — `media.url`: the web copy for a video once it is ready, the
 *   original until then, the photo itself for a photo. What a player or a full
 *   frame should show.
 * - `thumb` — the small still, for lists.
 * - `view` — the screen-sized still, for a photo shown large.
 */
export type MediaVariant = 'default' | 'thumb' | 'view';

/** The media object as the service publishes it (`PublicMedia`). */
interface MediaRecord {
  kind?: string | null;
  url?: string | null;
  posterUrl?: string | null;
  thumbUrl?: string | null;
  viewUrl?: string | null;
  playbackUrl?: string | null;
  originalUrl?: string | null;
  status?: string | null;
}

/** The shape any of the single-incident endpoints might come back in. */
interface IncidentEnvelope {
  incident?: { media?: MediaRecord };
  report?: { media?: MediaRecord };
  media?: MediaRecord;
}

/**
 * The URL for a variant, falling back to the nearest thing that exists.
 *
 * A copy is null while the service is still making it (`media.status:
 * "processing"`), and reports stored before the pipeline existed may never have
 * one. A photo is its own still, so a missing thumb or view on a photo falls
 * back to the photo; a video with no still yet has nothing an `<img>` can draw,
 * and says so with null rather than handing a clip to an image tag.
 */
function urlFor(media: MediaRecord, variant: MediaVariant): string | null {
  const photo = media.kind === 'photo' ? (media.url ?? null) : null;
  if (variant === 'thumb') return media.thumbUrl ?? media.posterUrl ?? photo;
  if (variant === 'view') return media.viewUrl ?? media.posterUrl ?? photo;
  /*
   * The playable media, and `url` is not the only place it lives.
   *
   * `PublicMedia.url` is the service's own preference — "the H.264 faststart
   * web copy once ready" — and it is nullable. It is null while the derivative
   * pipeline is still running, and it stays null when that pipeline failed.
   * This read `media.url` alone, so either case answered 404 about footage that
   * is sitting on the server: the frame said "the report is intact and the
   * footage is on the server" and the route underneath it said Not found.
   *
   * `playbackUrl` is the same web copy under its own key, and `originalUrl` is
   * the untouched bytes the reporter filed. The original is the last resort
   * rather than the first because it may be QuickTime or HEVC — but an editor
   * being handed the original and told by the player which codec it is beats
   * being told the file does not exist.
   */
  return media.url ?? media.playbackUrl ?? media.originalUrl ?? null;
}

/**
 * The endpoints that can answer "where is this report's media, right now?".
 *
 * Tried in order and by role: an editor reads `/editorial/{id}`, and anybody
 * may read a published report at `/incidents/{id}`. A refusal moves on to the
 * next rather than failing, because which one answers depends on who is asking
 * and this module deliberately does not re-implement that rule.
 */
const DETAIL_PATHS = (id: string) => [
  `/editorial/${encodeURIComponent(id)}`,
  `/incidents/${encodeURIComponent(id)}`,
];

function mediaOf(detail: IncidentEnvelope | null | undefined): MediaRecord | null {
  // The editorial workspace wraps the report; the public endpoint is it.
  return detail?.incident?.media ?? detail?.report?.media ?? detail?.media ?? null;
}

/**
 * A media URL minted now, or null if this caller cannot read the report.
 *
 * Throws only when the service itself failed. A 403 or 404 from every endpoint
 * is an answer — this account may not see this report — and is reported as
 * null so the route can turn it into one status rather than leaking which.
 *
 * **`note` is for whoever is running the console, never for the browser.** A
 * miss has three quite different causes — nobody would serve this report, the
 * report was readable but holds no media at all, or it holds media with no URL
 * for the copy that was asked for — and all three answered the same flat
 * `404: Not found`. That is the same sin the rest of this route was written to
 * undo: one sentence for four problems, and no way to tell them apart from the
 * outside. The route keeps answering 404 to the client and prints this.
 */
export interface MediaLookup {
  url: string | null;
  note: string | null;
}

export async function freshMediaUrl(
  incidentId: string,
  token: string,
  options: { variant?: MediaVariant; orgId?: string | null } = {},
): Promise<MediaLookup> {
  const variant = options.variant ?? 'default';
  let lastFailure: unknown = null;
  /** What each endpoint had to say, in order, for the note below. */
  const tried: string[] = [];

  for (const path of DETAIL_PATHS(incidentId)) {
    try {
      const media = mediaOf(await apiRequest<IncidentEnvelope>(path, { token, timeoutMs: 10_000 }));
      const url = media ? urlFor(media, variant) : null;
      if (url) return { url: absoluteMedia(url), note: null };
      tried.push(media ? `${path} → no ${variant} url (${describe(media)})` : `${path} → no media`);
    } catch (cause) {
      lastFailure = cause;
      tried.push(`${path} → ${statusOf(cause)}`);
    }
  }

  /*
   * An organisation reads its own reports through `GET /org/incidents/{id}`.
   *
   * **This used to scan `/org/inbox` without the `X-Dawuro-Org` header** — and
   * every `/org/*` route refuses a request that does not name the organisation.
   * So for an organisation account the lookup was a 403 on every video, which
   * is one of the reasons footage never played at the organisation end. It also
   * missed any report past the inbox's first page.
   *
   * Last, and only with an organisation to name, because editors and the
   * platform are answered above.
   */
  if (options.orgId) {
    const path = `/org/incidents/${encodeURIComponent(incidentId)}`;
    try {
      const media = mediaOf(
        await apiRequest<IncidentEnvelope>(path, {
          token,
          timeoutMs: 10_000,
          headers: { 'X-Dawuro-Org': options.orgId },
        }),
      );
      const url = media ? urlFor(media, variant) : null;
      if (url) return { url: absoluteMedia(url), note: null };
      tried.push(media ? `${path} → no ${variant} url (${describe(media)})` : `${path} → no media`);
    } catch (cause) {
      lastFailure ??= cause;
      tried.push(`${path} → ${statusOf(cause)}`);
    }
  }

  const note = tried.join('; ');

  /*
   * Thrown only when nothing was readable. A report that *was* read and simply
   * has no URL for this copy is not a service failure — it is an answer, and
   * turning it into a 502 would send whoever is debugging it to the wrong
   * system entirely.
   */
  if (lastFailure && tried.every((line) => !line.includes('no '))) throw lastFailure;
  return { url: null, note };
}

/** An error's HTTP status, for the note. */
function statusOf(cause: unknown): string {
  const status = (cause as { status?: unknown })?.status;
  return typeof status === 'number' && status > 0 ? String(status) : 'unreachable';
}

/** Why a media record had nothing to offer — the fields that decide it. */
function describe(media: MediaRecord): string {
  const present = (['url', 'playbackUrl', 'originalUrl', 'posterUrl', 'thumbUrl', 'viewUrl'] as const)
    .filter((key) => media[key])
    .join(', ');
  return `kind=${media.kind ?? '?'} status=${media.status ?? '?'} has=${present || 'nothing'}`;
}
