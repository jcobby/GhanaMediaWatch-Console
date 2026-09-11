import { normaliseRoutingItem } from '../normaliseRouting';
import type { MediaKind } from '@dawuro/core';

/**
 * The routing queue speaks incidents; the desk speaks routing items.
 *
 * `/platform/routing` publishes no response schema, and what it returns is
 * incident records. The desk was written against `RoutingItem`, which names the
 * same things differently. Nothing errored — every field resolved to
 * `undefined` — so a queue of four real reports rendered as four blank boxes,
 * with a video frame and no report id, description, category or timestamp
 * behind any of them. The operator could see there was work and not what it
 * was.
 *
 * These pin the translation. The failure they prevent is silent by nature: a
 * renamed field does not throw, it just empties a row.
 */

/** An incident record shaped the way the server actually sends one. */
const serverIncident = {
  id: 'inc_f239f43fc3fc',
  reportId: 'DW-GHJ-VG3',
  category: 'flood' as const,
  description: 'Burst main flooding the market road',
  severity: 'urgent' as const,
  vettingState: 'pending_review' as const,
  capturedAtIso: '2026-09-04T14:02:00.000Z',
  createdAt: '2026-09-04T14:06:00.000Z',
  media: {
    kind: 'video' as MediaKind,
    url: 'https://cdn/clip.mp4',
    posterUrl: 'https://cdn/poster.jpg',
    width: 1080,
    height: 1920,
  },
  location: {
    latitude: 5.6,
    longitude: -0.18,
    label: 'Kaneshie, Accra',
    confidence: 'high' as const,
  },
  reporter: { displayName: 'Ama Mensah' },
};

test('the description becomes the summary the desk renders', () => {
  // The single most visible blank: a row with no text at all.
  expect(normaliseRoutingItem(serverIncident).summary).toBe('Burst main flooding the market road');
});

test('createdAt becomes the submitted time', () => {
  /*
   * The desk prints "submitted {relative time}". With this unmapped it printed
   * the word "submitted" followed by nothing, which is how the detail pane came
   * to read "· submitted" with no date after it.
   */
  expect(normaliseRoutingItem(serverIncident).submittedAtIso).toBe('2026-09-04T14:06:00.000Z');
});

test('the media poster becomes the thumbnail', () => {
  // Unmapped, the frame rendered as a black box behind the SAMPLE watermark.
  expect(normaliseRoutingItem(serverIncident).thumbnailUrl).toBe('https://cdn/poster.jpg');
});

test('the location label is lifted out of the location object', () => {
  expect(normaliseRoutingItem(serverIncident).locationLabel).toBe('Kaneshie, Accra');
});

test('the reporter is named from the nested object', () => {
  expect(normaliseRoutingItem(serverIncident).reporterHandle).toBe('Ama Mensah');
});

test('report id and severity survive, though RoutingItem omits both', () => {
  /*
   * `reportId` is the code an operator reads aloud; `severity` is what the SLA
   * clock is measured against. Dropping them would leave the SLA desk unable to
   * compute a target for any row.
   */
  const row = normaliseRoutingItem(serverIncident);
  expect(row.reportId).toBe('DW-GHJ-VG3');
  expect(row.severity).toBe('urgent');
});

test('a row already in the desk vocabulary is left alone', () => {
  /*
   * The server may start sending `RoutingItem` proper. The mapping must not
   * overwrite a field that arrived under the expected name.
   */
  // The incident fields are present too, so this proves the desk vocabulary
  // wins rather than merely that it is read when nothing else is there.
  const row = normaliseRoutingItem({
    ...serverIncident,
    summary: 'Already correct',
    submittedAtIso: '2026-09-01T00:00:00.000Z',
    thumbnailUrl: 'https://cdn/real.jpg',
    reporterHandle: 'Kofi',
    locationLabel: 'Osu',
    status: 'routed',
  });

  expect(row.summary).toBe('Already correct');
  expect(row.submittedAtIso).toBe('2026-09-01T00:00:00.000Z');
  expect(row.thumbnailUrl).toBe('https://cdn/real.jpg');
  expect(row.reporterHandle).toBe('Kofi');
  expect(row.locationLabel).toBe('Osu');
  expect(row.status).toBe('routed');
});

test('a row in the queue with no status is treated as work', () => {
  /*
   * The desk exists to show what needs a decision. A row the server placed in
   * the routing queue without saying why is still in the routing queue.
   */
  expect(normaliseRoutingItem(serverIncident).status).toBe('awaiting_routing');
});

test('vettingState is never mistaken for a routing status', () => {
  /*
   * Different questions. `pending_review` is about whether a report may be
   * published; it says nothing about whether it has been routed, and reading
   * one as the other would hide rows from the desk.
   */
  const row = normaliseRoutingItem({ ...serverIncident, vettingState: 'rejected' as const });
  expect(row.status).toBe('awaiting_routing');
});

test('an unnamed reporter is anonymous, never a placeholder', () => {
  /*
   * This console can show unmasked reporter identities. A stand-in name here
   * would be read as the person who filmed it, and a wrong name is worse than
   * no name.
   */
  const withoutReporter = { ...serverIncident, reporter: undefined };
  expect(normaliseRoutingItem(withoutReporter).reporterHandle).toBe('Anonymous');
});

test('nothing is invented when the server sends almost nothing', () => {
  // A sparse row renders sparse rather than plausible.
  const row = normaliseRoutingItem({ id: 'inc_1' });
  expect(row.summary).toBe('');
  expect(row.thumbnailUrl).toBe('');
  expect(row.locationLabel).toBeNull();
  expect(row.submittedAtIso).toBe('');
  expect(row.reportId).toBeUndefined();
  expect(row.severity).toBeUndefined();
});

// ─── the media block the server actually sends ─────────────────────────────

/**
 * Captured from a real upload, verbatim.
 *
 * `posterUrl` is **null** — the service generates no still frame — and the
 * footage sits at a relative, pre-signed `url`. Reading `posterUrl` therefore
 * got nothing, which is why every frame on the routing desk rendered black.
 */
const serverMedia = {
  kind: 'photo' as MediaKind,
  url: '/v1/media/inc_ac0102ca012b?exp=1788783579&sig=7bf8f7f2ce45fbbd',
  posterUrl: null,
  width: 1080,
  height: 1920,
  durationMs: null,
  byteSize: 4096,
  mimeType: 'image/jpeg',
};

test('a relative path is left alone when no backend is configured', () => {
  /*
   * Half a URL is worse than none: it renders a broken image, which reads as a
   * fault rather than as a console nobody has pointed at a server.
   */
  const previous = process.env.DAWURO_API_URL;
  delete process.env.DAWURO_API_URL;
  const row = normaliseRoutingItem({ id: 'inc_1', media: serverMedia as never });
  expect(row.thumbnailUrl).toBe(serverMedia.url);
  if (previous) process.env.DAWURO_API_URL = previous;
});

test('a null poster falls through to the signed url', () => {
  // The exact failure: `posterUrl ?? ''` produced an empty src on every row.
  const row = normaliseRoutingItem({ id: 'inc_1', media: serverMedia as never });
  expect(row.thumbnailUrl).toContain('/v1/media/inc_ac0102ca012b');
  expect(row.thumbnailUrl).toContain('sig=');
});

test('the signed path is made absolute', () => {
  // The base is a deployment setting, so the test supplies one rather than
  // depending on whatever `.env.local` happens to hold.
  process.env.DAWURO_API_URL = 'https://api.example.test';
  /*
   * It arrives relative, so a browser resolves it against the console's own
   * origin and gets a 404. The signature is carried through untouched —
   * stripping the query would produce 403 "Media URL signature is missing".
   */
  const row = normaliseRoutingItem({ id: 'inc_1', media: serverMedia as never });
  expect(row.thumbnailUrl).toMatch(/^https?:\/\//);
  expect(row.thumbnailUrl).toMatch(/exp=\d+&sig=[0-9a-f]+$/);
});

test('a poster is still preferred when one exists', () => {
  // A still frame is the right thing for a video; the clip itself is a
  // fallback that an <img> cannot render.
  const row = normaliseRoutingItem({
    id: 'inc_1',
    media: { ...serverMedia, posterUrl: 'https://cdn/poster.jpg' } as never,
  });
  expect(row.thumbnailUrl).toBe('https://cdn/poster.jpg');
});

test('an absolute url is left alone', () => {
  const row = normaliseRoutingItem({
    id: 'inc_1',
    media: { ...serverMedia, url: 'https://cdn/already-absolute.jpg' } as never,
  });
  expect(row.thumbnailUrl).toBe('https://cdn/already-absolute.jpg');
});

test('no media means no src, not a broken one', () => {
  // An <img> with a half-built src renders a broken-image icon, which reads as
  // a fault rather than as an absence.
  expect(normaliseRoutingItem({ id: 'inc_1' }).thumbnailUrl).toBe('');
});

// ─── video is never handed to an <img> ─────────────────────────────────────

/**
 * The bug these pin.
 *
 * `thumbnailUrl` fell through to `media.url` whenever no poster existed, and
 * the service stores `posterUrl: null` for every video it holds. So each queue
 * tile received the URL of an MP4 and rendered it in an `<img>`, which cannot
 * decode video and fails with no error and no broken-image icon — an empty grey
 * box that reads as missing footage.
 *
 * Nothing caught it: the type was `string`, the URL was correct, and the only
 * fixture in this file is a photo, for which the same fallback is right.
 */
const videoMedia = {
  kind: 'video' as MediaKind,
  url: '/v1/media/inc_video01?exp=1788783579&sig=7bf8f7f2ce45fbbd',
  posterUrl: null,
  width: 1080,
  height: 1920,
  durationMs: 12_000,
  byteSize: 2_400_000,
  mimeType: 'video/mp4',
};

test('a video never reaches thumbnailUrl', () => {
  const row = normaliseRoutingItem({ id: 'inc_1', media: videoMedia as never });
  expect(row.thumbnailUrl).toBe('');
});

test('the footage is carried where a player can reach it', () => {
  process.env.DAWURO_API_URL = 'https://api.example.test';
  const row = normaliseRoutingItem({ id: 'inc_1', media: videoMedia as never });
  expect(row.mediaKind).toBe('video');
  expect(row.mediaUrl).toBe(`https://api.example.test${videoMedia.url}`);
  // The signature is the authorisation. Stripping the query gives 403.
  expect(row.mediaUrl).toMatch(/exp=\d+&sig=[0-9a-f]+$/);
});

test("a video's poster is still used when the service supplies one", () => {
  const row = normaliseRoutingItem({
    id: 'inc_1',
    media: { ...videoMedia, posterUrl: 'https://cdn/poster.jpg' } as never,
  });
  expect(row.thumbnailUrl).toBe('https://cdn/poster.jpg');
  // And the clip is still reachable, so the frame can play rather than sit
  // under a play button wired to nothing.
  expect(row.mediaUrl).toContain('/v1/media/inc_video01');
});

test('a photo still uses its own url as the thumbnail', () => {
  // The opposite failure. Excluding every `media.url` would blank the tile for
  // photo reports, where that URL is exactly the right image.
  process.env.DAWURO_API_URL = 'https://api.example.test';
  const row = normaliseRoutingItem({ id: 'inc_1', media: serverMedia as never });
  expect(row.thumbnailUrl).toContain('/v1/media/inc_ac0102ca012b');
  expect(row.mediaKind).toBe('photo');
});

// ─── the shape /platform/routing actually sends ────────────────────────────

/**
 * Captured from the live endpoint, in full:
 *
 *     {"items":[{"incidentId":"inc_2401a8b95171","matches":[]}],
 *      "nextCursor":null,"hasMore":false}
 *
 * Two fields per row. It is a list of routing *decisions* — which reports need
 * one, and what the matcher found — not a list of reports. The desk read it as
 * reports, so every field resolved to `undefined` and fell to a default: eight
 * identical rows reading OTHER / "No description filed" / "No reference", each
 * with an empty tile. Nothing on that screen was real data.
 *
 * Typecheck could not catch it. `ServerRoutingRow` is `Partial<Incident>`, so a
 * row with none of those fields is a valid argument.
 */
const overviewRow = { incidentId: 'inc_2401a8b95171', matches: [] };

test('the incident id becomes the row id', () => {
  /*
   * The duplicate-key error, and the worst of the bugs here. `raw.id ?? ''`
   * gave all eight rows the same empty key, so React could not tell them apart
   * — selecting one could open another — and `queue.find(q => q.id === id)`
   * matched the first row every time.
   */
  const row = normaliseRoutingItem(overviewRow);
  expect(row.id).toBe('inc_2401a8b95171');
  expect(row.incidentId).toBe('inc_2401a8b95171');
});

test('two overview rows are never the same row', () => {
  const rows = [
    normaliseRoutingItem({ incidentId: 'inc_aaa', matches: [] }),
    normaliseRoutingItem({ incidentId: 'inc_bbb', matches: [] }),
  ];
  expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  // An empty key is the specific value that broke it.
  expect(rows.every((r) => r.id !== '')).toBe(true);
});

test("the matcher's own answer is used, not a guess", () => {
  /*
   * `matches` is the only field besides `incidentId` the overview sends, and it
   * is what the platform actually routed by. Read as `suggestedBusinessIds`
   * alone it was always empty, so the desk showed a client-side re-run of the
   * matcher as though it were the platform's decision.
   */
  expect(
    normaliseRoutingItem({ incidentId: 'i', matches: ['biz_1'] }).suggestedBusinessIds,
  ).toEqual(['biz_1']);
  expect(
    normaliseRoutingItem({ incidentId: 'i', matches: [{ businessId: 'biz_2' }] })
      .suggestedBusinessIds,
  ).toEqual(['biz_2']);
  expect(normaliseRoutingItem(overviewRow).suggestedBusinessIds).toEqual([]);
});

test('report content is merged over the routing row', () => {
  // What the second request is for. The overview carries no content at all.
  const row = normaliseRoutingItem({
    ...{ description: 'Burst main on Spintex Road', category: 'water', media: videoMedia },
    ...overviewRow,
  } as never);
  expect(row.summary).toBe('Burst main on Spintex Road');
  expect(row.category).toBe('water');
  expect(row.mediaKind).toBe('video');
  // And the routing row still wins on identity.
  expect(row.incidentId).toBe('inc_2401a8b95171');
});

test('a row whose report could not be read says so, rather than guessing', () => {
  /*
   * `category ?? 'other'` and `destination ?? 'marketplace'` printed OTHER and
   * marketplace for eight reports whose records had never been read. An
   * operator routes on category, and cannot tell a report genuinely filed under
   * "other" from one whose category never arrived — so a default rendered as a
   * fact is a wrong answer presented as a real one.
   */
  const row = normaliseRoutingItem({ ...overviewRow, contentUnavailable: true });
  expect(row.contentUnavailable).toBe(true);
  // Still identifiable, and still routable.
  expect(row.incidentId).toBe('inc_2401a8b95171');
});

test('a row that was read carries no such mark', () => {
  // The opposite failure: marking every row would hide real categories.
  const row = normaliseRoutingItem({ ...overviewRow, category: 'water' } as never);
  expect(row.contentUnavailable).toBeUndefined();
  expect(row.category).toBe('water');
});
