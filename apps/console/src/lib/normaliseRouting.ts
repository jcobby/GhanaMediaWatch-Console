import type {
  AssuranceClass,
  HandlingRequirement,
  Incident,
  RoutingItem,
  Severity,
  SubmissionDestination,
} from '@dawuro/core';

/**
 * Where the API lives, for resolving a signed media path.
 *
 * The server returns `media.url` as a **relative** path — `/v1/media/{id}?exp=…
 * &sig=…` — so a browser would resolve it against the console's own origin and
 * get a 404. It has to be made absolute here, on the server, where the base is
 * known.
 *
 * Read per call rather than at module load. A module-level read is frozen at
 * import, which makes it untestable and, under Next, fixes the value at build
 * time — so a deployment that changes the backend URL would keep pointing at
 * the old one until it was rebuilt.
 */
function apiOrigin(): string {
  return (process.env.DAWURO_API_URL ?? '').replace(/\/+$/, '');
}

/**
 * A routing queue row, whichever shape the server sends.
 *
 * `/platform/routing` publishes no response schema, and what it actually
 * returns is incident records — `description`, `createdAt`, `media`, `reporter`,
 * `location` — while the desk was written against `RoutingItem`, which calls
 * those `summary`, `submittedAtIso`, `thumbnailUrl`, `reporterHandle` and
 * `locationLabel`.
 *
 * Nothing errored. Every field resolved to `undefined`, so the queue rendered
 * four rows with no report id, no description, no category and no timestamp —
 * four blank boxes and a video frame with nothing behind it. An operator could
 * see there was work and not what any of it was.
 *
 * So the two vocabularies are reconciled here, once, at the boundary — the same
 * thing the phone's `normaliseIncident` does for the same reason. A field the
 * server sends under the expected name is taken as-is; otherwise the incident
 * equivalent is used. Nothing is invented: a value the server does not send in
 * either vocabulary stays absent, and the row renders without it rather than
 * with a plausible-looking substitute.
 */

/** Somebody the server names as having filed a report. */
interface ServerReporter {
  displayName?: string;
  handle?: string;
  name?: string;
}

/**
 * What the desk needs, and what an incident record can supply for it.
 *
 * `reporter`, `createdAt` and `updatedAt` are declared here rather than added to
 * `@dawuro/core`'s `Incident`: the server sends them, the shared type does not
 * claim them, and inventing fields on a type the phone also compiles against
 * would be asserting a contract neither client has verified.
 */
type ServerRoutingRow = Partial<RoutingItem> &
  Partial<Incident> & {
    reporter?: ServerReporter;
    createdAt?: string;
    submittedAt?: string;
    routedAtIso?: string;
    acknowledgedAtIso?: string | null;
    /** Set when the report's own record could not be read. */
    contentUnavailable?: boolean;
    /**
     * What the auto-matcher found for this report.
     *
     * The routing overview's own field, and the only one besides `incidentId`
     * it actually sends. Entries may be plain organisation ids or objects that
     * carry one, so both are read.
     */
    matches?: (string | { businessId?: string; organisationId?: string; id?: string })[];
  };

/**
 * A normalised row, plus what the server supplies that `RoutingItem` omits.
 *
 * `reportId` is the code an operator reads aloud and types into `/verify`;
 * `severity` is what the SLA clock is measured against. Both are on the wire
 * and neither is on the shared type, so they are carried alongside rather than
 * dropped — losing them would leave the SLA desk unable to compute a target.
 */
export type RoutingRow = RoutingItem & {
  reportId?: string;
  severity?: Severity;
  /**
   * The footage itself, and what kind of file it is.
   *
   * Separate from `thumbnailUrl` because they are answers to different
   * questions, and collapsing them put an MP4 into an `<img src>`. The list
   * tiles were empty grey boxes while the detail pane played the same clip
   * perfectly — the URL was right, the element could never render it. An `<img>`
   * fails silently, so this looked like missing data rather than a wrong tag.
   *
   * `thumbnailUrl` now means only a still image that can go in an `<img>`.
   * Anything that needs a player comes through here, and the caller picks the
   * element.
   */
  mediaUrl?: string;
  mediaKind?: 'video' | 'photo' | null;
  /**
   * What the stored file weighs, so the frame can tell footage from filler.
   *
   * The routing queue sits alongside integration probes holding two kilobytes
   * of random bytes, and those render as a black rectangle with a working play
   * button — indistinguishable from a clip that has not buffered.
   */
  mediaByteSize?: number | null;
  /**
   * How the file got here, and what has to happen before anyone sees it.
   *
   * Both are on the wire and neither is on `RoutingItem`. They are carried
   * because the desk now scores each report as it arrives, and these two decide
   * two different parts of that answer: `assurance` is how strong the material
   * is, `handling` is whether it may be routed to anybody at all. Dropping them
   * would leave the score computing visual strength from the media kind alone
   * and silently unable to notice unredacted footage of a child.
   */
  assurance?: AssuranceClass;
  handling?: HandlingRequirement[];
  /**
   * Where the reporter actually asked this to go — absent when the server did
   * not say.
   *
   * Distinct from `destination`, which is required by `RoutingItem` and is
   * therefore defaulted to `marketplace`. The routing queue sends no
   * destination at all, so that default is on every row: harmless as a label
   * beside `contentUnavailable`, and not harmless at all as an input to a
   * score, where it would hand every report the exclusivity point for a choice
   * nobody made.
   */
  destinationStated?: SubmissionDestination;
  /**
   * The report's own record could not be read, so everything but its id and
   * the matcher's answer is absent.
   *
   * Carried so the desk can say that, instead of rendering the fallbacks as
   * though the server had sent them. An operator routes on category, and
   * "OTHER" shown for a category that never arrived is a wrong answer
   * presented as a real one.
   */
  contentUnavailable?: boolean;
  /**
   * When this organisation first acknowledged it, if it has.
   *
   * What stops the SLA clock. Absent means unacknowledged, which is the honest
   * reading of a server that says nothing about it.
   */
  acknowledgedAtIso?: string | null;
};

export function normaliseRoutingItem(raw: ServerRoutingRow): RoutingRow {
  const media = raw.media;
  const location = raw.location;

  return {
    /*
     * The routing overview names this `incidentId` and sends no `id` at all.
     *
     * Reading only `raw.id` gave every row the same empty string, which React
     * uses as the list key — so all eight rows shared one key. That is a
     * duplicate-key error, and it means React cannot tell the rows apart:
     * selecting one could show another, and re-renders could drop or duplicate
     * them. It also made every row equal for `queue.find(q => q.id === id)`,
     * so the detail pane always opened the first.
     */
    id: raw.id ?? raw.incidentId ?? '',
    incidentId: raw.incidentId ?? raw.id ?? '',

    // `reportId` is the human-readable code (DW-XXX-XXX). The desk shows the
    // summary, but an id-less row is unidentifiable, so it is preserved.
    summary: raw.summary ?? raw.description ?? '',
    category: (raw.category ?? 'other') as RoutingItem['category'],
    /*
     * Where the reporter asked this to go.
     *
     * Defaulted to `marketplace` — "offered to subscribing organisations" — for
     * any report whose record had not been read, which is a claim about what
     * somebody chose. It is the same fault as defaulting the category: an
     * operator routes on this field, and `public` and `marketplace` are
     * opposite instructions. The default is kept because `RoutingItem` requires
     * the field, and `contentUnavailable` says when it means nothing.
     */
    destination: raw.destination ?? 'marketplace',
    /*
     * The same field, unfilled. See `destinationStated` on `RoutingRow`: the
     * default above is a claim about what somebody chose, and a score built on
     * it would be scoring a choice nobody made.
     */
    ...(raw.destination ? { destinationStated: raw.destination } : {}),
    ...(raw.assurance ? { assurance: raw.assurance } : {}),
    ...(raw.handling ? { handling: raw.handling } : {}),

    requestedBusinessIds: raw.requestedBusinessIds ?? [],
    /*
     * The matcher's own answer, under the name the overview sends it by.
     *
     * Read as `suggestedBusinessIds` alone this was always empty, so the desk
     * re-ran the matcher client-side and showed its own guess as though it were
     * what the platform had decided. Where the server has an opinion, it is the
     * one that matters — it is the one the report was actually routed by.
     */
    suggestedBusinessIds: raw.suggestedBusinessIds ?? matchedIds(raw.matches),

    /*
     * Anonymous unless the server names a reporter.
     *
     * Never a placeholder handle: an operator reading a name here would take it
     * for the person who filmed it, and this console can show unmasked reporter
     * identities. A wrong name is worse than none.
     */
    reporterHandle: raw.reporterHandle ?? reporterNameOf(raw.reporter) ?? 'Anonymous',

    capturedAtIso: raw.capturedAtIso ?? '',
    // The server records submission as `createdAt` on an incident.
    submittedAtIso: raw.submittedAtIso ?? raw.createdAt ?? raw.submittedAt ?? raw.routedAtIso ?? '',

    /*
     * Awaiting routing unless the server says otherwise.
     *
     * An incident record carries `vettingState`, which is a different question
     * — whether it may be published — so it is not read as a routing status.
     * A row that arrived in the routing queue and does not declare a status is
     * work, and the desk exists to show work.
     */
    status: raw.status ?? 'awaiting_routing',

    locationLabel: raw.locationLabel ?? location?.label ?? null,
    location:
      raw.location && typeof raw.location === 'object' && 'latitude' in raw.location
        ? (raw.location as RoutingItem['location'])
        : null,

    /*
     * The signed URL the server issues, made absolute.
     *
     * Every frame on this desk was black, and the cause was not a missing field
     * in the queue payload. `media.posterUrl` is **null** — the service
     * generates no still frame — so reading that got nothing, while the actual
     * footage sits at `media.url` behind a short-lived signature:
     *
     *   /v1/media/inc_ac0102ca012b?exp=1788783579&sig=7bf8f7f2…
     *
     * The signature is the authorisation, which is why this needs no token and
     * must not be proxied through a route handler attaching one — that returns
     * 403 "Media URL signature is missing or expired".
     *
     * It is relative, so a browser would resolve it against the console's own
     * origin. Making it absolute is the whole fix.
     *
     * **Never a video.** For a photo report `media.url` is an image and is
     * exactly the right thumbnail, which is why it is still used. For a video it
     * is an MP4, and `media.posterUrl` is null on every clip the service
     * stores — so this fell through to the footage and handed an `<img>` a file
     * it cannot decode. An `<img>` fails at that silently: no broken-image icon,
     * no error, just an empty box. Every tile in the queue was blank while the
     * detail pane showed the same file, so it read as missing footage rather
     * than as the wrong element.
     *
     * Video is carried on `mediaUrl` instead, and the caller picks something
     * that can play it.
     */
    thumbnailUrl: absoluteMedia(
      raw.thumbnailUrl ?? media?.posterUrl ?? (media?.kind === 'video' ? null : media?.url) ?? null,
    ),

    ...(raw.contentUnavailable ? { contentUnavailable: true } : {}),
    ...(media?.url ? { mediaUrl: absoluteMedia(media.url) } : {}),
    ...(media?.kind ? { mediaKind: media.kind as 'video' | 'photo' } : {}),
    ...(typeof media?.byteSize === 'number' ? { mediaByteSize: media.byteSize } : {}),
    ...(raw.reportId ? { reportId: raw.reportId } : {}),
    ...(raw.severity ? { severity: raw.severity } : {}),
    ...(raw.acknowledgedAtIso !== undefined ? { acknowledgedAtIso: raw.acknowledgedAtIso } : {}),
  } as RoutingRow;
}

/** Organisation ids out of the overview's `matches`, in either shape. */
function matchedIds(matches: ServerRoutingRow['matches']): string[] {
  if (!Array.isArray(matches)) return [];
  return matches
    .map((match) =>
      typeof match === 'string' ? match : (match?.businessId ?? match?.organisationId ?? match?.id),
    )
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** A reporter's display name, however the server nests it. */
function reporterNameOf(reporter: ServerReporter | undefined): string | null {
  if (!reporter || typeof reporter !== 'object') return null;
  return reporter.displayName ?? reporter.handle ?? reporter.name ?? null;
}

/**
 * A relative signed media path made absolute; anything else passed through.
 *
 * Exported because every screen that shows footage needs it and the value can
 * only be built on the server: `DAWURO_API_URL` is not a `NEXT_PUBLIC_` variable,
 * so a client component has no way to know the origin. A page that forgets this
 * renders a URL the browser resolves against the console's own host and gets a
 * 404 — silently, because an `<img>` and a `<video>` both fail without saying so.
 */
export function absoluteMedia(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  const origin = apiOrigin();
  return origin ? `${origin}${url.startsWith('/') ? '' : '/'}${url}` : url;
}
