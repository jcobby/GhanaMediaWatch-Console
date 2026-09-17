import { lockedReason, normaliseAdmins } from '../admins';
import { normaliseInvoice } from '../invoices';

// ─── administrators ───────────────────────────────────────────────────────

const ADMINS = {
  items: [
    { id: 'adm_1', email: 'owner@dawuro.gh', displayName: 'Owner', role: 'platform_owner', suspended: false },
    { id: 'adm_2', email: 'desk@dawuro.gh', displayName: null, role: 'editor', suspended: false },
    { id: 'adm_3', email: 'old@dawuro.gh', role: 'super_admin', suspended: true },
    { email: 'no-id@dawuro.gh', role: 'editor' },
  ],
  roles: ['platform_owner', 'editor', 'finance', 'compliance', 'operations', 'support'],
};

test('administrators are read from the service shape', () => {
  const { admins, roles } = normaliseAdmins(ADMINS);
  expect(admins.map((a) => a.id)).toEqual(['adm_1', 'adm_2', 'adm_3']);
  expect(roles).toHaveLength(6);
  // A role the service does not grant is shown as written, never offered.
  expect(admins[2]).toMatchObject({ role: null, roleRaw: 'super_admin', suspended: true });
});

test('the six documented roles are offered when the service sends none', () => {
  expect(normaliseAdmins({ items: [] }).roles).toEqual([
    'platform_owner',
    'editor',
    'finance',
    'compliance',
    'operations',
    'support',
  ]);
});

test('nobody changes their own access, and the last owner is kept', () => {
  const { admins } = normaliseAdmins(ADMINS);
  expect(lockedReason(admins[0]!, admins, 'OWNER@dawuro.gh')).toMatch(/your own access/);
  expect(lockedReason(admins[0]!, admins, 'someone@dawuro.gh')).toMatch(/last platform owner/);
  expect(lockedReason(admins[1]!, admins, 'owner@dawuro.gh')).toBeNull();

  const twoOwners = [...admins, { ...admins[0]!, id: 'adm_9', email: 'second@dawuro.gh' }];
  expect(lockedReason(twoOwners[0]!, twoOwners, 'second@dawuro.gh')).toBeNull();
});

// ─── invoices ─────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-09-15T12:00:00.000Z');

test('an open invoice past its due date is payable and overdue', () => {
  const invoice = normaliseInvoice(
    {
      id: 'inv_1',
      status: 'open',
      totalPesewas: 150_000,
      dueAt: '2026-09-01T00:00:00.000Z',
      paidAt: null,
      receiptUrl: null,
      lineItems: [
        { description: 'Standard subscription', quantity: 1, unitPesewas: 100_000, amountPesewas: 100_000 },
        { label: 'Report downloads', quantity: 10, unitAmountPesewas: 5_000, totalPesewas: 50_000 },
      ],
    },
    NOW,
  );
  expect(invoice).toMatchObject({ status: 'open', payable: true, overdue: true, totalPesewas: 150_000 });
  expect(invoice.lines).toEqual([
    { label: 'Standard subscription', quantity: 1, unitPesewas: 100_000, amountPesewas: 100_000 },
    { label: 'Report downloads', quantity: 10, unitPesewas: 5_000, amountPesewas: 50_000 },
  ]);
});

test('only an open invoice offers payment', () => {
  for (const status of ['draft', 'paid', 'void', 'uncollectible', 'mystery']) {
    expect([status, normaliseInvoice({ id: 'x', status, totalPesewas: 100 }, NOW).payable]).toEqual([
      status,
      false,
    ]);
  }
  // Nothing to pay is nothing to pay.
  expect(normaliseInvoice({ id: 'x', status: 'open', totalPesewas: 0 }, NOW).payable).toBe(false);
});

test('money that is not an integer is not shown as a figure', () => {
  const invoice = normaliseInvoice(
    { id: 'x', status: 'open', totalPesewas: 99.5, lineItems: [{ description: 'x', amountPesewas: '10' }] },
    NOW,
  );
  expect(invoice.totalPesewas).toBe(0);
  expect(invoice.lines[0]!.amountPesewas).toBeNull();
});

test('a receipt is linked only over https', () => {
  expect(normaliseInvoice({ id: 'x', status: 'paid', receiptUrl: 'https://pay.example/r/1' }).receiptUrl).toBe(
    'https://pay.example/r/1',
  );
  expect(normaliseInvoice({ id: 'x', status: 'paid', receiptUrl: 'javascript:alert(1)' }).receiptUrl).toBeNull();
  expect(normaliseInvoice({ id: 'x', status: 'paid', receiptUrl: 'http://pay.example/r/1' }).receiptUrl).toBeNull();
});
