import fs from 'fs';
import path from 'path';

/**
 * Paying reporters reaches the service.
 *
 * "Release batch" used to move the batch into "Past runs" in React state and
 * send nothing, and there was no way to see which payments went through or to
 * try a failed one again. The service now releases batches, reports each
 * payment's status and retries failures; these pin that the console uses them
 * without losing the guards that stop money going out twice.
 */

const SRC = path.resolve(__dirname, '..');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (rel: string) =>
  fs
    .readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const ROUTE = 'app/api/platform/payouts/route.ts';
const WORKSPACE = 'components/payouts/PayoutsWorkspace.tsx';

test('release and retry call the documented endpoints', () => {
  const api = code('lib/consoleApi.ts');
  expect(api).toMatch(/`\/platform\/payouts\/batches\/\$\{encodeURIComponent\(id\)\}\/release`/);
  expect(api).toMatch(/`\/platform\/payouts\/entries\/\$\{encodeURIComponent\(entryId\)\}\/retry`/);
});

test('a release is one release however many times it is pressed', () => {
  // Keyed on the batch, so a double-click or a retried request pays once.
  expect(code('lib/consoleApi.ts')).toMatch(/`payout-release:\$\{id\}`/);
  // A retry is keyed on the failure seen, so a later failure can be retried again.
  expect(code('lib/consoleApi.ts')).toMatch(/`payout-retry:\$\{entryId\}:\$\{attempt\}`/);
});

test('only somebody allowed to run payouts can send money', () => {
  const route = code(ROUTE);
  expect(route).toMatch(/session\.accountType === 'platform_owner'/);
  expect(route).toMatch(/roleCan\(session\.role, 'run_payouts'\)/);
  expect(route).toMatch(/status: 403/);
});

test('releasing needs the confirmation step', () => {
  const workspace = code(WORKSPACE);
  const confirm = workspace.slice(workspace.indexOf('{confirming ? ('));
  const yes = confirm.indexOf('Yes, release now');
  expect(yes).toBeGreaterThan(-1);
  expect(confirm.slice(0, yes)).toMatch(/onClick=\{onRelease\}/);
  expect(workspace).toMatch(/action: 'release', batchId: run\.id/);
});

test('only a failed payment offers a retry', () => {
  const workspace = code(WORKSPACE);
  const retryButton = workspace.indexOf('<RotateCw');
  const guard = workspace.lastIndexOf("payment.status === 'failed'", retryButton);
  expect(guard).toBeGreaterThan(-1);
});

test('the screen shows what the service returned, not what it assumed', () => {
  const workspace = code(WORKSPACE);
  expect(workspace).toMatch(/fetch\('\/api\/platform\/payouts'/);
  // The run is replaced only from the answer, after the response was checked.
  const act = workspace.slice(workspace.indexOf('const act = async'), workspace.indexOf('const toggle'));
  expect(act.indexOf('if (!res.ok')).toBeLessThan(act.indexOf('setRuns('));
});

test('both payouts pages are wired and neither warns that they are not', () => {
  for (const page of ['app/(platform)/platform/payouts/page.tsx', 'app/(admin)/admin/payouts/page.tsx']) {
    const src = code(page);
    expect([page, src.includes('<NotWired')]).toEqual([page, false]);
    expect(src).toMatch(/<PayoutsWorkspace/);
    expect(src).toMatch(/normalisePayoutRun\(batch\)/);
  }
});

test('the admin page shows no invented figures', () => {
  // "68% MTN" was typed into the page and described no payment anyone made.
  const admin = code('app/(admin)/admin/payouts/page.tsx');
  expect(admin).not.toMatch(/share: 0\./);
  expect(admin).not.toMatch(/RowAction/);
});

test('money is never turned into a float for display', () => {
  expect(code('lib/payouts.ts')).not.toMatch(/parseFloat|toFixed/);
  expect(code(WORKSPACE)).not.toMatch(/parseFloat|toFixed/);
});
