/**
 * Where a page points an `<img>` or a `<video>` for a report's footage.
 *
 * **Signed media URLs expire.** `GET /v1/media/{id}` is authorised by
 * `?exp=…&sig=…` and the signature lasts about five minutes — measured against
 * the live service, a URL minted at 09:55:15 answered 200 five seconds later
 * and `403 FORBIDDEN: Media URL signature is missing or expired` an hour and a
 * half after that.
 *
 * Every console screen used to put that URL straight into the markup. Each is
 * server-rendered once and then *worked* — a verification queue for as long as
 * the queue takes, an inbox for as long as somebody is deciding. Five minutes
 * in, every frame became "The file could not be opened", about footage that was
 * on the server the whole time. Reloading bought another five minutes, which is
 * what made it read as a flaky network rather than as a bug.
 *
 * This path carries no signature, so it cannot go stale. `/api/media/[incidentId]`
 * mints one server-side at the moment the bytes are wanted and streams the
 * answer back.
 *
 * **Deliberately not in `lib/media.ts`.** That module is `server-only`, and
 * every screen that shows footage is a client component — importing this from
 * there would pull the API client and the session into the browser bundle and
 * 500 the page. The same split `Outage` and `OrganisationOutage` already keep.
 */
export function mediaHref(incidentId: string): string {
  return `/api/media/${encodeURIComponent(incidentId)}`;
}
