import fs from 'fs';
import path from 'path';
import { mediaHref } from '../lib/mediaHref';

/**
 * Footage that is still there five minutes later.
 *
 * `GET /v1/media/{id}` is authorised by `?exp=…&sig=…`, and the signature lasts
 * about five minutes. Measured against the live service: a URL minted at
 * 09:55:15 answered `200 image/jpeg` five seconds later, and
 * `403 FORBIDDEN: Media URL signature is missing or expired` an hour and a half
 * after that.
 *
 * Every console screen put that URL straight into an `<img>` or a `<video>`.
 * Each of them is server-rendered once and then *worked* — a verification queue
 * for as long as the queue takes, an inbox for as long as somebody is deciding
 * whether to license something. Five minutes in, every frame on the page became
 * "The file could not be opened", about footage that was on the server the
 * whole time. Reloading bought another five minutes, which is exactly what made
 * this look like a flaky network instead of a bug.
 *
 * The page now points at this console. The signature is minted when the bytes
 * are wanted, so the markup holds nothing that can go stale.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note about it. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const ROUTE = 'app/api/media/[incidentId]/route.ts';

test('the path a page renders carries no signature and no origin', () => {
  /*
   * Two things it must not contain: an `exp`/`sig` pair, which is what expires,
   * and the API host, which `DAWURO_API_URL` is deliberately server-only to
   * keep out of the browser.
   */
  const href = mediaHref('inc_832d570b658f');
  expect(href).toBe('/api/media/inc_832d570b658f');
  expect(href).not.toMatch(/exp=|sig=|https?:/);
});

test('an id that could escape the path is encoded', () => {
  expect(mediaHref('../../secrets')).toBe('/api/media/..%2F..%2Fsecrets');
});

test('every screen that shows footage goes through it', () => {
  /*
   * All five, because the bug is in the shape of the URL rather than in any one
   * page — the next screen to render `media.posterUrl` directly would have it
   * again, and it would take another five minutes to notice.
   */
  const screens = [
    'app/(editorial)/editorial/Workbench.tsx',
    'app/(organisation)/inbox/InboxWorkspace.tsx',
    'app/(organisation)/published/PublishedWorkspace.tsx',
    'app/(platform)/platform/routing/RoutingDesk.tsx',
    'app/verify/[reportId]/page.tsx',
  ];

  const direct = screens.filter((s) => /posterUrl=\{(?!mediaHref)/.test(code(s)));
  expect(direct).toEqual([]);

  const missing = screens.filter((s) => !code(s).includes('mediaHref('));
  expect(missing).toEqual([]);

  /*
   * **And in any attribute, not only in a prop spelled `posterUrl`.**
   *
   * The rule above checks for `posterUrl={…}`, which is how the large stages
   * take their source — so it never looked at the inbox's list row, which
   * wrote `src={incident.media.posterUrl}` on a hand-rolled `<img>`. That
   * field is null for every video the service stores, so the row rendered the
   * browser's broken-image glyph beside a report whose footage was on the
   * server the whole time, and when it was not null it was a signed URL that
   * went stale while somebody worked the queue.
   *
   * Matching the field itself rather than one spelling of a prop is what
   * closes that: any screen reading `media.posterUrl` into markup fails here,
   * whatever attribute it is handed to.
   */
  const raw = screens.filter((s) => /\bmedia\.posterUrl\b/.test(code(s)));
  expect(raw).toEqual([]);
});

test('a list row shows footage through the shared thumbnail, not its own img tag', () => {
  /*
   * The inbox row and the editorial row are the same problem — a small still
   * for a clip the service may not have finished processing — and it was
   * solved once, well, and then hand-rolled again a screen away.
   *
   * `QueueThumb` handles: the service's 320px JPEG through `/api/media`, a
   * clip's own first frame when there is no thumb yet, a drawn placeholder
   * when there is genuinely nothing, a skip for files too small to be a
   * capture, and lazy loading so a fifty-row queue is not fifty media lookups.
   * None of that was in the inbox's `<img>`.
   *
   * It lives in `components/` now because two route groups use it; importing
   * across route groups is what made the copy look easier than the move.
   */
  const inbox = code('app/(organisation)/inbox/InboxWorkspace.tsx');
  expect(inbox).toMatch(/<QueueThumb incident=\{incident\}/);
  expect(inbox).not.toMatch(/<img/);
  expect(read('components/QueueThumb.tsx')).toMatch(/mediaHref\(incident\.id, 'thumb'\)/);
});

test('the helper the pages import is client-safe', () => {
  /*
   * Every screen that shows footage is a client component. `lib/media.ts` is
   * `server-only` and holds the API client, so importing the path helper from
   * there would pull the session into the browser bundle and 500 the page —
   * the same split `Outage` and `OrganisationOutage` already keep.
   */
  // Stripped of comments: the note explaining the split names `server-only`,
  // and what matters is that nothing is imported from it.
  expect(code('lib/mediaHref.ts')).not.toMatch(/server-only|apiRequest|readSession|import /);
  expect(read('lib/media.ts')).toMatch(/^import 'server-only';/m);
});

test('the route refuses anybody without a session, and says nothing about why', () => {
  /*
   * Media is the most sensitive thing this console serves: unpublished footage
   * of identifiable people, filmed by reporters who are frequently anonymous.
   * A 403 would confirm the report exists, so a refusal is a 404 either way and
   * an unreadable report is indistinguishable from an absent one.
   */
  const route = code(ROUTE);
  expect(route).toMatch(/readSession\(\)/);
  expect(route).toMatch(/!session\?\.accessToken/);
  expect(route).toMatch(/status: 404/);
  expect(route).toMatch(/status === 403 \? 404 : status/);
});

test('the signature is minted per request, not reused from the page', () => {
  // The whole point. A URL taken from the render is the bug.
  const route = code(ROUTE);
  expect(route).toMatch(/freshMediaUrl\(incidentId, session\.accessToken, \{/);
  expect(route).toMatch(/export const dynamic = 'force-dynamic'/);
});

describe('the copies the service makes are used', () => {
  test('a list asks for the thumb, and the route serves it', () => {
    // A 3 MB original drawn into a 72px square is what made the desk slow.
    expect(mediaHref('inc_1', 'thumb')).toBe('/api/media/inc_1?v=thumb');
    expect(code(ROUTE)).toMatch(/requested === 'thumb' \|\| requested === 'view'/);
    expect(read('lib/media.ts')).toMatch(/media\.thumbUrl \?\? media\.posterUrl \?\? photo/);
  });

  test('an organisation reads its report under its own scope', () => {
    /*
     * The lookup scanned `/org/inbox` without `X-Dawuro-Org`, which every
     * `/org/*` route refuses — so no video ever resolved for an organisation.
     */
    const media = code('lib/media.ts');
    expect(media).toMatch(/\/org\/incidents\/\$\{encodeURIComponent\(incidentId\)\}/);
    expect(media).toMatch(/'X-Dawuro-Org': options\.orgId/);
    expect(media).not.toMatch(/'\/org\/inbox'/);
    expect(code(ROUTE)).toMatch(/orgId: session\.businessId \?\? null/);
  });
});

test('the bytes are streamed rather than buffered', () => {
  /*
   * A sixty-second clip is several megabytes. Reading it into memory to hand it
   * on would hold all of it per viewer, per request, on a server rendering a
   * queue of them.
   */
  const route = code(ROUTE);
  expect(route).toMatch(/let body: ReadableStream<Uint8Array> = upstream\.body;/);
  expect(route).toMatch(/new NextResponse\(body,/);
  expect(route).not.toMatch(/arrayBuffer\(\)|\.blob\(\)/);
});

test('nothing shared may cache unpublished evidence', () => {
  const route = code(ROUTE);
  expect(route).toMatch(/'Cache-Control': 'private, max-age=\d+/);
  expect(route).not.toMatch(/public, max-age/);
  expect(route).not.toMatch(/s-maxage/);
  // And a hostile content type is never sniffed into something executable.
  expect(route).toMatch(/'X-Content-Type-Options': 'nosniff'/);
});

test('the private cache is long enough to be worth having', () => {
  /*
   * It was sixty seconds, which is the worst of both: long enough to count as a
   * cache, too short to stop the desk re-downloading every photograph in the
   * queue each time an editor scrolled back to one. Reported as the pictures
   * loading slowly on the web as well as the phone.
   *
   * An hour matches the signed URL's own deadline upstream, so nothing is held
   * past the window the service itself treats as current.
   */
  const maxAge = Number(/'Cache-Control': 'private, max-age=(\d+)/.exec(code(ROUTE))?.[1]);
  expect(maxAge).toBeGreaterThanOrEqual(600);
  expect(maxAge).toBeLessThanOrEqual(3600);
});

test('the tunnel header goes on the fetch an img could never send', () => {
  // A dev tunnel answers an unrecognised client with an HTML interstitial.
  expect(code(ROUTE)).toMatch(/'X-Tunnel-Skip-AntiPhishing-Page': 'true'/);
});

describe('what a browser will actually play', () => {
  test('QuickTime is relabelled, because Chrome refuses it outright', () => {
    /*
     * The second cause of "The file could not be opened", found after the first
     * one was fixed and it kept happening.
     *
     * `canPlayType('video/quicktime')` is the empty string in Chrome and Edge,
     * so a `<video>` fails with MEDIA_ERR_SRC_NOT_SUPPORTED before fetching a
     * frame — no request, nothing in the network tab, no decode to inspect.
     *
     * And every clip the platform holds is one: `expo-camera` on iOS writes
     * `.mov`, the app declares `video/quicktime` from the extension, and the
     * service stores and serves exactly that. The desk could not play any
     * footage filmed on an iPhone while the phone played all of it, because iOS
     * `AVPlayer` handles QuickTime natively.
     *
     * A relabel, not a transcode: an iPhone's QuickTime file is H.264 in an ISO
     * base media container, which browsers decode once it is called mp4.
     */
    const route = code(ROUTE);
    expect(route).toMatch(/function browserPlayable/);
    expect(route).toMatch(/base === 'video\/quicktime' \|\| base === 'video\/x-quicktime'/);
    expect(route).toMatch(/return 'video\/mp4';/);
    expect(route).toMatch(/let contentType = browserPlayable\(upstreamType\);/);
    expect(route).toMatch(/'Content-Type': contentType/);
  });

  test('nothing else is relabelled', () => {
    // A blanket rewrite would tell the browser a JPEG is a video, and the
    // failure would be indistinguishable from the one being fixed.
    const route = code(ROUTE);
    expect(route).toMatch(/if \(!quicktime\) return contentType;/);
    expect(route).not.toMatch(/always|every type/i);
  });

  test('HEVC keeps its own label, because relabelling it helps nobody', () => {
    /*
     * The relabel is a correction for H.264 in a QuickTime container — an ISO
     * base media file wearing the wrong name. It is not a correction for HEVC:
     * no desktop browser can decode that however it is labelled, and calling it
     * mp4 only moves the failure from "unsupported source", which a browser
     * reports immediately and precisely, to a decode error several seconds
     * later. Worse for the editor and worse for anybody diagnosing it.
     *
     * New captures no longer produce HEVC — the app asks iOS for `avc1`
     * explicitly. This is for the clips already stored, which need transcoding
     * on the server.
     */
    const route = code(ROUTE);
    // The codec parameter is read out of the content type, and HEVC is
    // returned untouched rather than renamed.
    expect(route).toContain('codecs');
    expect(route).toMatch(/startsWith\('hvc1'\)/);
    expect(route).toMatch(/startsWith\('hev1'\)/);
  });

  test('the upstream content type is printed where somebody is looking', () => {
    /*
     * The fact that was missing. Four different problems shared one sentence
     * and diagnosing them from outside the browser cost two wrong answers.
     */
    expect(code(ROUTE)).toMatch(/console\.log\(\s*`  MEDIA \$\{upstream\.status\}/);
  });
});

describe('telling the four failures apart', () => {
  const frame = 'components/MediaFrame.tsx';

  test("the element's own error code is kept, not discarded", () => {
    const src = code(frame);
    expect(src).toMatch(/const code = event\.currentTarget\.error\?\.code \?\? null;\s*setMediaError\(code\)/);
    expect(src).toMatch(/PLAYBACK_FAILURE\[mediaError \?\? 0\]/);
  });

  test('each code sends the reader somewhere different', () => {
    /*
     * The whole value of the distinction: an expired signature is a reload, a
     * codec this browser cannot decode is a transcode, and a missing file is a
     * platform fault. One sentence for all three is what sent two
     * investigations down the wrong path.
     */
    const src = read(frame);
    expect(src).toMatch(/2: 'The connection dropped/);
    expect(src).toMatch(/3: 'This browser cannot decode/);
    expect(src).toMatch(/HEVC/);
    expect(src).toMatch(/4: 'This browser will not open/);
  });

  test('an editor can still get at footage the browser will not play', () => {
    /*
     * A codec problem is not a missing report. Somebody ruling on whether
     * footage can be called verified has to be able to see it, and "we cannot
     * show you this" is not an acceptable last word on that decision.
     */
    const src = code(frame);
    expect(src).toMatch(/Open the file directly/);
    expect(src).toMatch(/href=\{playable\}/);
  });

  test('a photo that will not load says why, in the route own words', () => {
    /*
     * Reported as a photo showing "The file could not be opened" on a report
     * the service had marked integrity passed. An `<img>` error carries no
     * status and no code, so the frame had nothing to go on — and neither did
     * anybody reading it. The frame now asks the route for one byte and shows
     * the answer.
     */
    const src = code(frame);
    expect(src).toMatch(/fetch\(src, \{ headers: \{ Range: 'bytes=0-15' \}/);
    expect(src).toMatch(/onError=\{\(\) => \{\s*setFailed\(true\);\s*diagnose\(posterUrl\);/);
    // Not under a size verdict, which already says what is wrong in words.
    expect(src).toMatch(/\{serverSaid && !tooSmall \? \(/);
    // And what the file actually is, since the label is what can be wrong.
    expect(src).toMatch(/formatOf\(head\)/);
  });

  test('a photograph labelled as video is sent as a photograph', () => {
    /*
     * A photo report, stored and filed as `image/jpeg`, streamed from the
     * service labelled as video — and a browser will not draw an `<img>` whose
     * response says it is a video. The route reads the signature at the start of
     * the file and names it correctly.
     */
    const route = code(ROUTE);
    expect(route).toMatch(/head\[0\] === 0xff && head\[1\] === 0xd8 && head\[2\] === 0xff\) return 'image\/jpeg'/);
    // Only from the start of the file, and only when the label is not already an image.
    expect(route).toMatch(/const fromStart = !range \|\| \/\^bytes=0-\/\.test\(range\)/);
    expect(route).toMatch(/!upstreamType\.toLowerCase\(\)\.startsWith\('image\/'\)/);
    // The chunk read is handed back, not held.
    expect(route).toMatch(/controller\.enqueue\(head\)/);
    expect(route).toMatch(/'Content-Type': contentType/);
  });

  test('a failed answer is printed too, not only a successful one', () => {
    // It printed after the failure exit, so the requests that mattered never appeared.
    const route = code(ROUTE);
    expect(route.indexOf('`  MEDIA ${upstream.status}')).toBeLessThan(
      route.indexOf('if (!upstream.ok'),
    );
    expect(route).toMatch(/MEDIA lookup/);
  });
});

describe('the preview opens on what the list is showing', () => {
  /*
   * Reported as a mismatch anybody would read as a bug: the queue headed TODAY,
   * with **Date / Newest first** selected, and the pane beside it showing a
   * report filed on the 4th.
   *
   * The default selection was `queue[0]` — the highest triage score — and
   * triage counts waiting time, so the oldest report is by definition the most
   * urgent. Arithmetically right, and the opposite of what somebody clicking
   * "newest first" asked for.
   */
  const workbench = 'app/(editorial)/editorial/Workbench.tsx';

  test('nothing is pre-selected by urgency', () => {
    expect(code(workbench)).toMatch(/useState<string \| null>\(null\)/);
  });

  test('the default is the top of the list as displayed', () => {
    // Whatever ordering is in force — urgency, newest, oldest, by subject.
    const src = code(workbench);
    expect(src).toMatch(/const firstShown = groups\[0\]\?\.items\[0\]\?\.incident \?\? null/);
    expect(src).toMatch(/\?\? firstShown \?\? null/);
  });

  test('an editor who picked a report is not moved off it', () => {
    /*
     * Changing the grouping must rearrange the list around them, not take away
     * what they were reading. An explicit choice wins over the default.
     */
    expect(code(workbench)).toMatch(
      /selectedId \? reports\.find\(\(r\) => r\.id === selectedId\) : null/,
    );
  });

  test('the stored assessment follows the report actually on screen', () => {
    // Keyed off `selectedId` it would load nothing at all until somebody
    // clicked, on the very first report an editor sees.
    expect(code(workbench)).toMatch(/useStoredNewsValue\(selected\?\.id \?\? null\)/);
  });
});

describe('a corroboration tick that does not take says so', () => {
  /*
   * Reported as "when I select under the corroboration, it unchecks".
   *
   * The tick is optimistic on purpose — the box moves at once and the request
   * follows, because waiting for a round trip before showing the box ticked
   * makes working through seven checks feel broken. If the request fails the
   * box moves back, which is the honest version of optimism.
   *
   * What was missing is the other half. The explanation rendered in the
   * decision panel, several hundred pixels below and off the screen on a full
   * checklist — so an editor ticked a box, watched it silently untick itself,
   * and had no way at all to find out why. A failure has to appear where the
   * failure happened.
   */
  const workbench = 'app/(editorial)/editorial/Workbench.tsx';

  test('the checklist has its own failure, not the decision panel one', () => {
    const src = code(workbench);
    expect(src).toMatch(/const \[checkError, setCheckError\]/);
    expect(src).toMatch(/failure=\{checkError\}/);
  });

  test('it names the check that failed', () => {
    // An editor working through seven of them needs to know which one.
    expect(code(workbench)).toMatch(/CORROBORATION_CHECKS\.find\(\(c\) => c\.id === failure\.id\)/);
  });

  test('the service own words survive, with its status', () => {
    /*
     * "That check could not be recorded" alone tells an editor nothing they can
     * act on, and the status is what separates a permission problem from a
     * report that moved on underneath them.
     */
    const src = code(workbench);
    expect(src).toMatch(/answer\.upstreamStatus \? ` \(\$\{answer\.upstreamStatus\}\)` : ''/);
  });

  test('a network failure lands in the same place', () => {
    // Unreachable and refused are both "the tick did not take", and both belong
    // beside the box rather than in two different parts of the screen.
    const toggle = code(workbench);
    const fn = toggle.slice(
      toggle.indexOf('const toggleCheck'),
      toggle.indexOf('return (', toggle.indexOf('const toggleCheck')),
    );
    expect(fn).toMatch(/could not reach its own server/);
    expect(fn).not.toMatch(/setDecisionError\('The console could not reach/);
  });

  test('a fresh attempt clears the last failure', () => {
    // A stale message beside a box that has since worked is its own bug.
    const toggle = code(workbench);
    expect(toggle).toMatch(/setCheckError\(null\);\s*\n\s*setDecisionError\(null\)/);
  });
});
