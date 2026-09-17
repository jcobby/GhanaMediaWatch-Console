import fs from 'fs';
import path from 'path';
import { summariseUnpaid } from '../payouts';

/**
 * Seeing what a payout batch would contain, before opening one.
 *
 * Creating a batch takes "all unpaid", and until `GET /platform/commissions`
 * landed the operator pressed that blind — the one screen in this console that
 * moves money, asking for a decision about an amount it could not name.
 */

const SRC = path.resolve(__dirname, '..', '..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const row = (over: Record<string, unknown> = {}) => ({
  id: 'com_1',
  reporterId: 'usr_1',
  amountPesewas: 2500,
  hasPayoutNumber: true,
  ...over,
});

test('it totals the money and counts the people, not the rows', () => {
  // One reporter with three commissions is one person to pay.
  const summary = summariseUnpaid([
    row({ id: 'a', reporterId: 'usr_1', amountPesewas: 2500 }),
    row({ id: 'b', reporterId: 'usr_1', amountPesewas: 1500 }),
    row({ id: 'c', reporterId: 'usr_2', amountPesewas: 1000 }),
  ]);

  expect(summary).toEqual({
    count: 3,
    reporterCount: 2,
    totalPesewas: 5000,
    withoutNumber: 0,
  });
});

test('a reporter with nowhere to be paid is counted once, however many rows', () => {
  /*
   * Those payments are held rather than sent, and the operator is told before
   * releasing. Counting rows would overstate how many people are affected.
   */
  const summary = summariseUnpaid([
    row({ id: 'a', reporterId: 'usr_9', hasPayoutNumber: false }),
    row({ id: 'b', reporterId: 'usr_9', hasPayoutNumber: false }),
    row({ id: 'c', reporterId: 'usr_2', hasPayoutNumber: true }),
  ]);

  expect(summary.withoutNumber).toBe(1);
  expect(summary.reporterCount).toBe(2);
});

test('the number itself answers when the service sends no flag', () => {
  expect(summariseUnpaid([row({ hasPayoutNumber: undefined, payoutMsisdn: '+233241234567' })]).withoutNumber).toBe(0);
  expect(summariseUnpaid([row({ hasPayoutNumber: undefined, payoutMsisdn: null })]).withoutNumber).toBe(1);
});

test('an amount that is not an integer is read as zero, never as a float', () => {
  /*
   * All money is integer pesewas. A value this console cannot trust is not one
   * it will put beside a release button.
   */
  const summary = summariseUnpaid([
    row({ amountPesewas: 12.5 }),
    row({ id: 'b', reporterId: 'usr_2', amountPesewas: -400 }),
    row({ id: 'c', reporterId: 'usr_3', amountPesewas: 1000 }),
  ]);
  expect(summary.totalPesewas).toBe(1000);
});

test('rubbish in does not throw', () => {
  // The endpoint publishes a schema, but this is money and the page must render.
  expect(summariseUnpaid(null)).toEqual({
    count: 0,
    reporterCount: 0,
    totalPesewas: 0,
    withoutNumber: 0,
  });
  expect(summariseUnpaid([null, 'x', 7]).count).toBe(0);
});

describe('the screen says it before the button', () => {
  test('the page reads the unpaid list and lets it fail on its own', () => {
    /*
     * Context for the release button, not the subject of the page: if this read
     * is down an operator must still be able to see and release the batches that
     * already exist.
     */
    const page = code('app/(platform)/platform/payouts/page.tsx');
    expect(page).toMatch(/platform\s*\.commissions<unknown>\(\)/);
    expect(page).toMatch(/\.then\(summariseUnpaid\)/);
    expect(page).toMatch(/\.catch\(\(\) => null\)/);
    expect(page).toMatch(/unpaid=\{result\.data\.unpaid\}/);
  });

  test('"could not be read" and "nothing owed" are different sentences', () => {
    // Null is not zero, and on a money screen they must not look alike.
    const workspace = code('components/payouts/PayoutsWorkspace.tsx');
    expect(workspace).toMatch(/unpaid === null \?/);
    expect(workspace).toMatch(/could not be read just now/);
    expect(workspace).toMatch(/unpaid\.count === 0 \?/);
    expect(workspace).toMatch(/a new batch would be empty/);
    expect(workspace).toMatch(/formatCedis\(unpaid\.totalPesewas\)/);
    expect(workspace).toMatch(/will be held rather than sent/);
  });

  test('no reporter name, email or number reaches the summary', () => {
    /*
     * The rows carry all three. The question this panel answers is "how much, to
     * how many", and a shared office does not need a list of reporters'
     * mobile-money numbers on screen to answer it.
     */
    const lib = code('lib/payouts.ts');
    const fn = lib.slice(lib.indexOf('export function summariseUnpaid'));
    expect(fn).not.toMatch(/reporterDisplayName|reporterEmail/);
    const workspace = code('components/payouts/PayoutsWorkspace.tsx');
    expect(workspace).not.toMatch(/unpaid\.(reporterEmail|payoutMsisdn)/);
  });
});
