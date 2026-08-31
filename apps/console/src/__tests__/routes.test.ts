import fs from 'fs';
import path from 'path';
import { PLATFORM_ROLES, ROLE_META, reachableHrefs } from '@dawuro/core';

/**
 * Every destination the role registry can produce is a page that exists.
 *
 * `@dawuro/core` knows nothing about Next, so its hrefs are plain strings and
 * typed routes cannot check them — the Sidebar casts once, deliberately. This
 * is the check that makes the cast safe: a role gaining a navigation entry
 * whose page was never written fails here rather than 404ing in a demo.
 */

const APP = path.resolve(__dirname, '../app');

/** Route groups are a filesystem convention and do not appear in the URL. */
function toUrl(dir: string): string {
  const rel = path.relative(APP, dir).split(path.sep);
  const segments = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')')));
  return '/' + segments.join('/');
}

function routes(dir: string, found: Set<string> = new Set()): Set<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'api' || entry.name === '__tests__') continue;

    const full = path.join(dir, entry.name);
    if (fs.existsSync(path.join(full, 'page.tsx'))) found.add(toUrl(full));
    routes(full, found);
  }
  if (fs.existsSync(path.join(dir, 'page.tsx'))) found.add(toUrl(dir) || '/');
  return found;
}

const existing = routes(APP);

test('the route sweep found the pages it should have', () => {
  // Without this, a broken walk makes every assertion below vacuous.
  expect(existing.size).toBeGreaterThan(15);
  expect(existing).toContain('/inbox');
  expect(existing).toContain('/editorial');
});

test('every role lands somewhere that exists', () => {
  const missing = PLATFORM_ROLES.filter((role) => {
    const meta = ROLE_META[role];
    return !meta.mobileOnly && !existing.has(meta.home);
  }).map((role) => `${role} → ${ROLE_META[role].home}`);

  expect(missing).toEqual([]);
});

test('every navigation entry points at a page that exists', () => {
  const missing: string[] = [];

  for (const role of PLATFORM_ROLES) {
    for (const href of reachableHrefs(role)) {
      if (!existing.has(href)) missing.push(`${role} → ${href}`);
    }
  }

  expect([...new Set(missing)]).toEqual([]);
});

test('the reporter is sent somewhere that explains itself', () => {
  // Not a dead end — a page that says why there is no console for them.
  expect(existing).toContain('/no-console');
  expect(ROLE_META.reporter.home).toBe('/no-console');
});
