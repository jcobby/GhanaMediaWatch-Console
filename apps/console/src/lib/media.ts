import 'server-only';
import { apiRequest } from './api';
import { absoluteMedia } from './normaliseRouting';

/**
 * Media the browser can ask for without holding a signature.
 *
 * **Signed media URLs expire.** `GET /v1/media/{id}` is authorised by
 * `?exp=…&sig=…`, good for roughly five minutes: measured against the live
 * service, a URL minted at 09:55:15 answered 200 five seconds later and
 * `403 FORBIDDEN: Media URL signature is missing or expired` an hour and a half
 * after that.
 *
 * Every console screen put that URL straight into an `<img>` or a `<video>`.
 * Each is server-rendered once and then worked — a verification queue for as
 * long as the queue takes, an inbox for as long as somebody is deciding. Five
 * minutes in, every frame on the page became *The file could not be opened*,
 * about footage that was on the server the whole time. A reload fixed it for
 * another five minutes, which is what makes this read as a flaky network rather
 * than as a bug.
 *
 * So a page now points at `/api/media/{incidentId}` on this console's own
 * origin, and the signature is minted when the bytes are actually wanted.
 */

/**
 * The path a page points at lives in `lib/mediaHref` — client-safe, because
 * every screen that shows footage is a client component and this module is
 * `server-only`.
 */

/** The shape any of the single-incident endpoints might come back in. */
interface IncidentEnvelope {
  incident?: { media?: { url?: string | null } };
  report?: { media?: { url?: string | null } };
  media?: { url?: string | null };
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

/**
 * A media URL minted now, or null if this caller cannot read the report.
 *
 * Throws only when the service itself failed. A 403 or 404 from every endpoint
 * is an answer — this account may not see this report — and is reported as
 * null so the route can turn it into one status rather than leaking which.
 */
export async function freshMediaUrl(incidentId: string, token: string): Promise<string | null> {
  let lastFailure: unknown = null;

  for (const path of DETAIL_PATHS(incidentId)) {
    try {
      const detail = await apiRequest<IncidentEnvelope>(path, { token, timeoutMs: 10_000 });
      // The editorial workspace wraps the report; the public endpoint is it.
      const media = detail?.incident?.media ?? detail?.report?.media ?? detail?.media;
      const url = media?.url;
      if (url) return absoluteMedia(url);
    } catch (cause) {
      lastFailure = cause;
    }
  }

  /*
   * An organisation reads its own inbox and nothing else: there is no
   * `GET /org/incidents/{id}`, so for an organisation account this list is the only
   * place a licensed report's media URL exists. Last, and only on failure,
   * because it is a page fetch to serve one image.
   */
  try {
    const inbox = await apiRequest<{ items?: { id?: string; media?: { url?: string | null } }[] }>(
      '/org/inbox',
      { token, timeoutMs: 10_000 },
    );
    const match = inbox?.items?.find((row) => row?.id === incidentId);
    if (match?.media?.url) return absoluteMedia(match.media.url);
  } catch (cause) {
    lastFailure ??= cause;
  }

  if (lastFailure) throw lastFailure;
  return null;
}
