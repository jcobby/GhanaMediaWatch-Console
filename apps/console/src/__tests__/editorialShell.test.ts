import fs from 'fs';
import path from 'path';

/**
 * The verification desk's frame: navigation across the top, and a queue whose
 * rows show what was filmed.
 *
 * Asked for directly. The desk was three columns — a sidebar holding two links,
 * the queue, and the case — and choosing the next report meant opening each one
 * to see what it held.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note about it. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('the desk is navigated from a bar across the top', () => {
  test('the editorial layout uses the top bar, not the sidebar', () => {
    const layout = code('app/(editorial)/layout.tsx');
    expect(layout).toMatch(/<TopBar/);
    expect(layout).not.toMatch(/<Sidebar/);
    // Sign-out stays visible, which matters on shared workstations.
    expect(layout).toMatch(/right=\{<UserMenu user=\{user\} \/>\}/);
  });

  test('only one destination is current, the most specific', () => {
    // `/editorial/decided` starts with `/editorial/`; a prefix test alone lights both.
    const bar = code('components/shell/TopBar.tsx');
    expect(bar).toMatch(/\.sort\(\(a, b\) => b\.href\.length - a\.href\.length\)/);
    expect(bar).toMatch(/aria-current=\{active \? 'page' : undefined\}/);
  });
});

describe('a queue row shows what was filmed', () => {
  test('every row carries a preview', () => {
    expect(code('app/(editorial)/editorial/Workbench.tsx')).toMatch(
      /<QueueThumb incident=\{incident\} \/>/,
    );
  });

  test('previews load when they come into view, not all at once', () => {
    const thumb = code('app/(editorial)/editorial/QueueThumb.tsx');
    expect(thumb).toMatch(/new IntersectionObserver\(/);
    expect(thumb).toMatch(/!visible \? null/);
  });

  test("the service's small copy, with a clip's first frame only as a fallback", () => {
    const thumb = code('app/(editorial)/editorial/QueueThumb.tsx');
    expect(thumb).toMatch(/mediaHref\(incident\.id, 'thumb'\)/);
    expect(thumb).toMatch(/const frameFallback = kind === 'video' && thumbFailed/);
    // A first frame, not the clip.
    expect(thumb).toMatch(/preload="metadata"/);
  });

  test('through the console media route, never a signed URL', () => {
    const thumb = code('app/(editorial)/editorial/QueueThumb.tsx');
    expect(thumb).not.toMatch(/media\.url|posterUrl|thumbUrl/);
  });

  test('a file too small to be a capture is not fetched', () => {
    const thumb = code('app/(editorial)/editorial/QueueThumb.tsx');
    expect(thumb).toMatch(/size < MIN_PLAUSIBLE_MEDIA_BYTES/);
    expect(thumb).toMatch(/tooSmall \|\| failed \|\|/);
  });
});
