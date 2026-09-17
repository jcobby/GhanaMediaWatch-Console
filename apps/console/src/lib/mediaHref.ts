/**
 * Where a page points an `<img>` or a `<video>` for a report's footage.
 *
 * **Signed media URLs expire.** `GET /v1/media/{id}` is authorised by
 * `?exp=…&sig=…`, and a console screen is server-rendered once and then *worked*
 * — a verification queue for as long as the queue takes, an inbox for as long as
 * somebody is deciding. Every screen used to put that URL straight into the
 * markup, and once it lapsed every frame became "The file could not be opened",
 * about footage that was on the server the whole time.
 *
 * This path carries no signature, so it cannot go stale. `/api/media/[incidentId]`
 * mints one server-side at the moment the bytes are wanted and streams the
 * answer back.
 *
 * `variant` asks for one of the copies the service makes at upload: `thumb` for a
 * list, `view` for a large still. Omitted, it is the playable media itself.
 *
 * **Deliberately not in `lib/media.ts`.** That module is `server-only`, and
 * every screen that shows footage is a client component — importing this from
 * there would pull the API client and the session into the browser bundle and
 * 500 the page. The same split `Outage` and `OrganisationOutage` already keep.
 */
export function mediaHref(incidentId: string, variant?: 'thumb' | 'view'): string {
  const path = `/api/media/${encodeURIComponent(incidentId)}`;
  return variant ? `${path}?v=${variant}` : path;
}
