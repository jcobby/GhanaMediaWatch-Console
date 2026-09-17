import fs from 'fs';
import path from 'path';

/**
 * Three screens whose buttons used to change nothing.
 *
 *   - **Published:** "Withhold" flipped a badge and left the report on the
 *     public feed.
 *   - **Administrators:** nine invented people in React state; every change
 *     vanished on reload.
 *   - **Checkout:** a form that took card numbers, waited two seconds and said
 *     "Payment received". Nothing was sent or paid.
 *
 * Round four gave each a real endpoint. These pin that they use it.
 */

const SRC = path.resolve(__dirname, '..');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (rel: string) =>
  fs
    .readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// ─── withdrawing a published report ───────────────────────────────────────

describe('withdrawing a report', () => {
  const ROUTE = 'app/api/org/incidents/[incidentId]/unpublish/route.ts';
  const WORKSPACE = 'app/(organisation)/published/PublishedWorkspace.tsx';

  test('calls unpublish with a reason', () => {
    expect(code('lib/consoleApi.ts')).toMatch(
      /`\/org\/incidents\/\$\{encodeURIComponent\(incidentId\)\}\/unpublish`,\s*'POST',\s*\{ reason \}/,
    );
    const route = code(ROUTE);
    expect(route).toMatch(/\.min\(4, 'Say why it is being withdrawn\.'\)/);
    expect(route).toMatch(/session\.accountType !== 'organisation'/);
  });

  test('a row is marked withdrawn only once the service agrees', () => {
    const workspace = code(WORKSPACE);
    expect(workspace).toMatch(/fetch\(`\/api\/org\/incidents\/\$\{encodeURIComponent\(incidentId\)\}\/unpublish`/);
    const fn = workspace.slice(workspace.indexOf('const withdraw = async'), workspace.indexOf('return ('));
    expect(fn.indexOf('if (!res.ok)')).toBeLessThan(fn.indexOf('setWithdrawn('));
  });

  test('no button pretends to publish or withhold', () => {
    const workspace = code(WORKSPACE);
    expect(workspace).not.toMatch(/Release publicly|setReleased/);
    expect(code('app/(organisation)/published/page.tsx')).not.toMatch(/<NotWired/);
  });
});

// ─── administrators ───────────────────────────────────────────────────────

describe('administrators', () => {
  const ROUTE = 'app/api/platform/admins/route.ts';
  const MANAGER = 'app/(admin)/admin/administrators/AdminManager.tsx';
  const PAGE = 'app/(admin)/admin/administrators/page.tsx';

  test('create, change and remove go to /platform/admins', () => {
    const api = code('lib/consoleApi.ts');
    expect(api).toMatch(/get<T>\('\/platform\/admins'\)/);
    expect(api).toMatch(/send<T>\('\/platform\/admins', 'POST'/);
    expect(api).toMatch(/`\/platform\/admins\/\$\{encodeURIComponent\(id\)\}`, 'PATCH'/);
    expect(api).toMatch(/`\/platform\/admins\/\$\{encodeURIComponent\(id\)\}`, 'DELETE'/);
  });

  test('only a platform owner can change who runs the platform', () => {
    const route = code(ROUTE);
    expect(route).toMatch(/roleCan\(session\.role, 'manage_admins'\)/);
    expect(route).toMatch(/status: 403/);
    // Only the roles the service grants can be sent.
    expect(route).toMatch(/z\.enum\(LIVE_ADMIN_ROLES\)/);
  });

  test('nobody on the screen is invented', () => {
    const manager = code(MANAGER);
    expect(manager).not.toMatch(/SEED|Ama Serwaa|super\.admin@dawuro\.gh/);
    expect(manager).toMatch(/fetch\('\/api\/platform\/admins'/);

    const page = code(PAGE);
    expect(page).not.toMatch(/<NotWired/);
    expect(page).not.toMatch(/value="9"|value="1"/);
    expect(page).toMatch(/normaliseAdmins\(result\.data\)/);
  });

  test('the controls respect the rules the service enforces', () => {
    expect(code(MANAGER)).toMatch(/lockedReason\(admin, admins, selfEmail\)/);
  });
});

// ─── paying an invoice ────────────────────────────────────────────────────

describe('paying an invoice', () => {
  const ROUTE = 'app/api/org/invoices/[invoiceId]/checkout/route.ts';
  const PANEL = 'app/(organisation)/checkout/CheckoutPanel.tsx';
  const PAGE = 'app/(organisation)/checkout/page.tsx';

  test('checkout is started for one invoice, with a return address', () => {
    expect(code('lib/consoleApi.ts')).toMatch(
      /`\/org\/invoices\/\$\{encodeURIComponent\(id\)\}\/checkout`, 'POST', \{ returnUrl \}/,
    );
    const route = code(ROUTE);
    expect(route).toMatch(/\/checkout\?invoice=\$\{encodeURIComponent\(invoiceId\)\}&returned=1/);
    // The payer is only ever sent to a web address.
    expect(route).toMatch(/protocol === 'https:'/);
  });

  test('no card or wallet details are collected here', () => {
    const panel = code(PANEL);
    expect(panel).not.toMatch(/cc-number|cc-csc|setTimeout|PD-SIM/);
    expect(panel).not.toMatch(/<Field/);
    expect(panel).toMatch(/window\.location\.assign\(answer\.checkoutUrl\)/);
  });

  test('the amount is the invoice, read from the service', () => {
    const page = code(PAGE);
    expect(page).toMatch(/org\.invoice<unknown>\(invoiceId\)/);
    expect(page).toMatch(/amountPesewas=\{invoice\.totalPesewas\}/);
    expect(page).not.toMatch(/<NotWired|simulated|periodCost/);
  });

  test('the invoices page lists real invoices and pays each one', () => {
    const page = code('app/(organisation)/invoices/page.tsx');
    expect(page).toMatch(/org\.invoices<unknown>\(\)/);
    expect(page).toMatch(/\/checkout\?invoice=\$\{encodeURIComponent\(invoice\.id\)\}/);
    expect(page).toMatch(/invoice\.payable \?/);
  });
});
