import fs from 'fs';
import path from 'path';
import { PLATFORM_ROLES, organisationHrefs, reachableHrefs, ROLE_META } from '@dawuro/core';

/**
 * Every page that exists can be clicked to.
 *
 * Seven pages in the organisation shell were built, styled, capability-gated,
 * permitted by middleware — and linked from nowhere. `/assignments`,
 * `/affiliations`, `/agent`, `/earnings` and `/support` had no inbound href at
 * all, and `/checkout` and `/invoices` linked only to each other, a closed loop
 * with no entrance. An organisation could not reach its own invoices except by
 * typing the URL.
 *
 * Nothing failed. The build passed, the tests passed, the pages rendered
 * perfectly to anyone who knew they were there. The sidebar was a hand-written
 * list of seven items next to a folder of fourteen, and no two people ever
 * compared them.
 *
 * So the check is structural: enumerate the route folders, enumerate what the
 * navigation offers to somebody, and require every route to be in reach — from
 * the menu, or as a step in a flow that is itself reachable.
 */

const APP = path.resolve(__dirname, '../app');

/** Top-level routes in a group, as URLs. */
function routesIn(group: string, prefix = '/'): string[] {
  const dir = path.join(APP, group);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('('))
    .filter((e) => fs.existsSync(path.join(dir, e.name, 'page.tsx')))
    .map((e) => prefix + e.name);
}

/** Every href written anywhere in the app, from any file. */
function allHrefs(): Set<string> {
  const found = new Set<string>();
  (function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.tsx?$/.test(e.name) && !f.includes('__tests__')) {
        const src = fs.readFileSync(f, 'utf8');
        // A query string still reaches the page: `/checkout?invoice=…` opens `/checkout`.
        for (const m of src.matchAll(
          /(?:href|push\()\s*=?\s*\{?\s*["'`](\/[a-z0-9/[\]-]*)(?:\?[^"'`]*)?["'`]/g,
        )) {
          found.add(m[1]!);
        }
      }
    }
  })(path.resolve(__dirname, '..'));
  return found;
}

test('the scan finds the real route tree', () => {
  // Without this the checks below pass by finding nothing.
  expect(routesIn('(organisation)').length).toBeGreaterThan(10);
});

test('every organisation page is reachable by somebody', () => {
  /*
   * "By somebody" is the right bar, not "by everybody" — `/support` should be
   * invisible to an analyst. What must not exist is a page no role can click
   * to, which is the state all seven were in.
   */
  const reachable = new Set<string>();
  for (const role of PLATFORM_ROLES) {
    if (ROLE_META[role].module !== 'service') continue;
    for (const href of organisationHrefs(role)) reachable.add(href);
  }

  // Flow steps: reachable because a page that is itself in the menu links to
  // them. `/checkout` is opened from `/invoices`, and never from a sidebar.
  const linked = allHrefs();

  const orphans = routesIn('(organisation)').filter(
    (href) => !reachable.has(href) && !linked.has(href),
  );
  expect(orphans).toEqual([]);
});

test('a flow step is reached from a page that is itself reachable', () => {
  /*
   * The trap the original bug fell into. `/checkout` linked to `/invoices` and
   * `/invoices` linked back to `/checkout`, so a naive "is it linked?" check
   * said yes about both while neither had an entrance.
   */
  const menu = new Set<string>();
  for (const role of PLATFORM_ROLES) {
    if (ROLE_META[role].module !== 'service') continue;
    for (const href of organisationHrefs(role)) menu.add(href);
  }
  expect(menu.has('/invoices')).toBe(true);
});

test('every admin page is reachable by some admin role', () => {
  const reachable = new Set<string>();
  for (const role of PLATFORM_ROLES) {
    if (ROLE_META[role].module !== 'admin') continue;
    for (const href of reachableHrefs(role)) reachable.add(href);
  }

  const orphans = routesIn('(admin)/admin', '/admin/').filter((href) => !reachable.has(href));
  expect(orphans).toEqual([]);
});

test('the navigation offers nothing that does not exist', () => {
  // The other direction: a link to a deleted page is a dead end, and the only
  // symptom is a 404 that nobody clicks in testing.
  const built = new Set([...routesIn('(organisation)'), '/inbox']);
  const offered = new Set<string>();
  for (const role of PLATFORM_ROLES) {
    if (ROLE_META[role].module !== 'service') continue;
    for (const href of organisationHrefs(role)) offered.add(href);
  }

  const missing = [...offered].filter((href) => !built.has(href));
  expect(missing).toEqual([]);
});
