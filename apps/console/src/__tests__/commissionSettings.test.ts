import fs from 'fs';
import path from 'path';

/**
 * Commission rates are set in the console, and saving never pretends.
 */

const SRC = path.resolve(__dirname, '..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('the platform sets rates, and they are sent with the feed settings', () => {
  const lib = code('lib/commissionRates.ts');
  expect(lib).toMatch(/'\/platform\/settings', \{\s*method: 'PUT',\s*token,\s*body: \{ commissions: clean \}/);
  expect(lib).toMatch(/sanitiseCommissionRates\(rates\)/);
  const route = code('app/api/platform/commissions/route.ts');
  expect(route).toMatch(/session\.accountType !== 'platform_owner'/);
});

test('a save the service did not keep is reported as not kept', () => {
  expect(code('lib/commissionRates.ts')).toMatch(/stored = isRecord\(body\?\.commissions\)/);
  const route = code('app/api/platform/commissions/route.ts');
  expect(route).toMatch(/saved\.stored\s*\?\s*\{\}\s*:\s*\{\s*warning:/);
  expect(code('app/(platform)/platform/commissions/page.tsx')).toMatch(/result\.data\.stored \?/);
});

test('the example on the settings page is the calculation the phone runs', () => {
  expect(code('app/(platform)/platform/commissions/CommissionRatesForm.tsx')).toMatch(
    /estimateCommission\(\s*\{ category, destination: 'marketplace'/,
  );
});

test('an organisation can offer more, never less', () => {
  const route = code('app/api/org/commissions/route.ts');
  expect(route).toMatch(/session\.accountType !== 'organisation'/);
  expect(route).toMatch(/writeOrganisationOffer\(parsed\.data, rates\)/);
  expect(code('lib/commissionRates.ts')).toMatch(/sanitiseOffer\(offer, rates\)/);
  expect(route).toMatch(/cannot store organisation offers yet/);
});

test('both pages are reachable', () => {
  expect(code('app/(platform)/layout.tsx')).toMatch(/href: '\/platform\/commissions'/);
  expect(code('middleware.ts')).toMatch(/'\/commissions'/);
  const nav = fs.readFileSync(path.resolve(SRC, '../../../packages/core/src/logic/navigation.ts'), 'utf8');
  expect(nav).toMatch(/href: '\/commissions'/);
});
