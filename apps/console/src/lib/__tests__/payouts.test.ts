import {
  maskMsisdn,
  needsAttention,
  networkOf,
  normalisePayoutRun,
  sentPesewas,
} from '../payouts';

/**
 * A payout batch in the published `PayoutBatch` schema, after a release in
 * which one payment failed and one was held for a missing number.
 */
const RELEASED = {
  id: 'pob_1',
  status: 'partially_failed',
  totalPesewas: 7_500,
  releasedAt: '2026-09-15T12:00:00.000Z',
  releasedBy: 'usr_owner',
  entries: [
    {
      id: 'poe_1',
      commissionId: 'com_1',
      userId: 'usr_a',
      msisdn: '+233241234567',
      amountPesewas: 2_500,
      status: 'sent',
      providerReference: 'MOMO-77',
      failureReason: null,
    },
    {
      id: 'poe_2',
      commissionId: 'com_2',
      userId: 'usr_a',
      msisdn: '+233241234567',
      amountPesewas: 2_500,
      status: 'failed',
      providerReference: null,
      failureReason: 'Wallet limit reached',
    },
    {
      id: 'poe_3',
      commissionId: 'com_3',
      userId: 'usr_b',
      msisdn: null,
      amountPesewas: 2_500,
      status: 'held',
      providerReference: null,
      failureReason: 'No payout number saved',
    },
  ],
};

test('a released batch keeps every payment and its status', () => {
  const run = normalisePayoutRun(RELEASED);
  expect(run.status).toBe('partially_failed');
  expect(run.totalPesewas).toBe(7_500);
  expect(run.releasedAtIso).toBe('2026-09-15T12:00:00.000Z');
  expect(run.payments.map((p) => p.status)).toEqual(['sent', 'failed', 'held']);
  expect(run.counts).toEqual({ pending: 0, sent: 1, paid: 0, failed: 1, held: 1 });
  expect(run.payments[2]!.failureReason).toBe('No payout number saved');
});

test('reporters are counted once however many commissions they have', () => {
  expect(normalisePayoutRun(RELEASED).reporterCount).toBe(2);
});

test('what needs attention and what has left are counted from the payments', () => {
  const run = normalisePayoutRun(RELEASED);
  expect(needsAttention(run)).toBe(2);
  expect(sentPesewas(run)).toBe(2_500);
});

test('a status the console does not know never offers a release', () => {
  // `draft` is the only status with a release button.
  expect(normalisePayoutRun({ id: 'x', status: 'mystery' }).status).toBe('releasing');
  expect(normalisePayoutRun({ id: 'x', status: 'settled' }).status).toBe('released');
});

test('money stays in integer pesewas', () => {
  const run = normalisePayoutRun({
    id: 'x',
    status: 'draft',
    entries: [
      { id: 'a', amountPesewas: 1_234, status: 'pending' },
      { id: 'b', amountPesewas: 12.5, status: 'pending' },
      { id: 'c', amountPesewas: '900', status: 'pending' },
    ],
  });
  expect(run.payments.map((p) => p.amountPesewas)).toEqual([1_234, 0, 0]);
  // No total from the service: the integer sum of what could be trusted.
  expect(run.totalPesewas).toBe(1_234);
  expect(Number.isInteger(run.totalPesewas)).toBe(true);
});

test('full phone numbers never reach the browser', () => {
  const run = normalisePayoutRun(RELEASED);
  expect(run.payments[0]!.msisdnMasked).toBe('+233 •• ••• 4567');
  expect(JSON.stringify(run)).not.toContain('241234567');
  expect(maskMsisdn(null)).toBeNull();
});

test('the network is read from the number prefix', () => {
  expect(networkOf('+233241234567')).toBe('MTN MoMo');
  expect(networkOf('0551234567')).toBe('MTN MoMo');
  expect(networkOf('+233201234567')).toBe('Telecel Cash');
  expect(networkOf('0501234567')).toBe('Telecel Cash');
  expect(networkOf('+233261234567')).toBe('AirtelTigo Money');
  expect(networkOf('0571234567')).toBe('AirtelTigo Money');
  expect(networkOf('+233311234567')).toBe('Unknown network');
  expect(networkOf(null)).toBe('Unknown network');
});

test('nothing usable is an empty run, not a crash', () => {
  const run = normalisePayoutRun(undefined);
  expect(run).toMatchObject({ id: '', status: 'releasing', totalPesewas: 0, payments: [] });
});
