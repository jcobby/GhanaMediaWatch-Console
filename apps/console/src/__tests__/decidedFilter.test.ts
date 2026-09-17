import fs from 'fs';
import path from 'path';

/**
 * The editor can see what is on the feed, what is not, and what leads it.
 */

const PAGE = path.resolve(__dirname, '../app/(editorial)/editorial/decided/page.tsx');
const code = () =>
  fs
    .readFileSync(PAGE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('the four filters exist and live in the URL', () => {
  const src = code();
  for (const label of ['All', 'On the feed', 'Not on the feed', 'Top stories']) {
    expect(src).toContain(`label: '${label}'`);
  }
  expect(src).toMatch(/`\/editorial\/decided\?show=\$\{filter\.id\}`/);
  // An unknown value falls back to everything rather than an empty list.
  expect(src).toMatch(/: 'all';/);
});

test('a top story is published, marked lead and not past its end time', () => {
  const src = code();
  const fn = src.slice(src.indexOf('function isTopStory'), src.indexOf('export default'));
  expect(fn).toMatch(/!onFeed\(incident\) \|\| !incident\.lead/);
  expect(fn).toMatch(/until > now/);
});

test('each filter shows how many it holds', () => {
  expect(code()).toMatch(/\{counts\[filter\.id\]\}/);
});
