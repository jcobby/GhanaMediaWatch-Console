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
  expect(route).toMatch(/freshMediaUrl\(incidentId, session\.accessToken\)/);
  expect(route).toMatch(/export const dynamic = 'force-dynamic'/);
});

test('the bytes are streamed rather than buffered', () => {
  /*
   * A sixty-second clip is several megabytes. Reading it into memory to hand it
   * on would hold all of it per viewer, per request, on a server rendering a
   * queue of them.
   */
  const route = code(ROUTE);
  expect(route).toMatch(/new NextResponse\(upstream\.body/);
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
    expect(route).toMatch(/'video\/quicktime' \|\| base === 'video\/x-quicktime' \? 'video\/mp4'/);
    expect(route).toMatch(/'Content-Type': browserPlayable\(upstreamType\)/);
  });

  test('nothing else is relabelled', () => {
    // A blanket rewrite would tell the browser a JPEG is a video, and the
    // failure would be indistinguishable from the one being fixed.
    const route = code(ROUTE);
    expect(route).toMatch(/: contentType;/);
    expect(route).not.toMatch(/always|every type/i);
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
    expect(src).toMatch(/setMediaError\(event\.currentTarget\.error\?\.code \?\? null\)/);
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
    expect(src).toMatch(/href=\{videoUrl\}/);
  });
});
