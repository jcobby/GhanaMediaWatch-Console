import fs from 'fs';
import path from 'path';

/**
 * Organisations send reports to the editor to publish, and editors decide.
 */

const SRC = path.resolve(__dirname, '..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('an organisation sends a licensed report to the editor, with a desk and a note', () => {
  const route = code('app/api/org/incidents/[incidentId]/publish/route.ts');
  expect(route).toMatch(/org\.publish</);
  expect(route).toMatch(/session\.accountType !== 'organisation'/);
  const panel = code('components/SendToEditor.tsx');
  expect(panel).toMatch(/fetch\(`\/api\/org\/incidents\/\$\{encodeURIComponent\(incidentId\)\}\/publish`/);
  expect(panel).toMatch(/Waiting for a/);
  const inbox = code('app/(organisation)/inbox/InboxWorkspace.tsx');
  expect(inbox).toMatch(/\{licensed \? \(\s*<div className="mt-4">\s*<SendToEditor/);
});

test('a report that cannot be published is not offered the form', () => {
  /*
   * Licensing and publishing are gated on different things. `integrity_passed`
   * is licensable and **not** publishable, so an organisation could buy a
   * report, choose a desk, write a note to the editor, press send — and be told
   * "Report cannot be published." by the service, after all of it, with nothing
   * beforehand that could have told them.
   *
   * The rule lives in `@dawuro/core` and was always readable here. The panel
   * simply never read it.
   */
  const panel = code('components/SendToEditor.tsx');
  expect(panel).toMatch(/verificationMeta\(verification as VerificationState\)/);
  expect(panel).toMatch(/if \(!meta\.publishable\)/);
  // It says which state it is in and what that means, rather than only refusing.
  expect(panel).toMatch(/Not ready to publish/);
  expect(panel).toMatch(/\{meta\.label\}/);

  // And the inbox hands it the state to judge on.
  const inbox = code('app/(organisation)/inbox/InboxWorkspace.tsx');
  expect(inbox).toMatch(/verification=\{incident\.verification\}/);
});

test('the word for buying a report is the same everywhere', () => {
  /*
   * The button said "Download", turned into "Licensing…" while it worked, and
   * settled on "Downloaded" — three words for two things, with the consequential
   * one ("you have just been charged and a reporter has just been paid") the
   * quietest of them.
   */
  const inbox = code('app/(organisation)/inbox/InboxWorkspace.tsx');
  expect(inbox).toMatch(/'License and download'/);
  expect(inbox).toMatch(/Pay \$\{formatCedis\(charge\)\} and license/);
  expect(inbox).toMatch(/<Badge tone="success">Licensed<\/Badge>/);
  expect(inbox).toMatch(/'Nothing licensed yet\.'/);
  // Downloading is what licensing entitles you to, so it survives only there.
  expect(inbox).toMatch(/'Download original'/);
  expect(inbox).not.toMatch(/>Downloaded</);
});

test('the Published page points to it', () => {
  expect(code('app/(organisation)/published/PublishedWorkspace.tsx')).toMatch(/href="\/inbox"/);
});

test('editors see the requests and approve or decline them', () => {
  expect(code('lib/consoleApi.ts')).toMatch(/collect<T>\('\/editorial\/publication-requests'\)/);
  expect(code('lib/consoleApi.ts')).toMatch(/`\/editorial\/publication-requests\/\$\{encodeURIComponent\(incidentId\)\}\/decide`/);
  expect(code('app/(editorial)/layout.tsx')).toMatch(/href: '\/editorial\/requests'/);

  const route = code('app/api/editorial/publication-requests/[incidentId]/route.ts');
  expect(route).toMatch(/session\.accountType !== 'editor' && session\.accountType !== 'platform_owner'/);
  // A decline carries a reason the organisation can act on.
  expect(route).toMatch(/reason: z\.string\(\)\.trim\(\)\.min\(4/);

  const list = code('app/(editorial)/editorial/requests/RequestsList.tsx');
  expect(list).toMatch(/fetch\(`\/api\/editorial\/publication-requests\/\$\{encodeURIComponent\(row\.id\)\}`/);
  expect(list).toMatch(/Also make it a top story/);
});
