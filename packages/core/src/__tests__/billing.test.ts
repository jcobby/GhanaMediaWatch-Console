import {
  annualCost,
  breakEvenDownloads,
  downloadCharge,
  isUnlimited,
  periodCost,
  planFor,
} from '../logic/billing';
import { SUBSCRIPTION_PLANS } from '../types/dawuro';

/*
 * `planFor` is nullable, because against the live service the tier is often
 * absent and the lookup genuinely fails — it took the inbox down. Asserted once
 * here so the rest of the file reads as arithmetic rather than as null checks,
 * and so a tier disappearing from the table fails loudly at the top.
 */
const basic = planFor('basic')!;
const standard = planFor('standard')!;
const enterprise = planFor('enterprise')!;

it('has a plan for every tier it claims to price', () => {
  expect([basic, standard, enterprise].every(Boolean)).toBe(true);
});

it('answers null for a tier it does not know', () => {
  /*
   * The case that crashed the inbox: `SUBSCRIPTION_PLANS[undefined]` is
   * `undefined`, and the first thing to read a price off it threw. A null says
   * so, and the type makes every caller decide what to show instead — which on
   * a page quoting a charge is a decision worth forcing.
   */
  expect(planFor(undefined)).toBeNull();
  expect(planFor(null)).toBeNull();
  expect(planFor('platinum')).toBeNull();
  expect(planFor(3)).toBeNull();
});

describe('plan shapes', () => {
  it('meters the two subscription tiers and not the annual one', () => {
    expect(isUnlimited(basic)).toBe(false);
    expect(isUnlimited(standard)).toBe(false);
    expect(isUnlimited(enterprise)).toBe(true);
  });

  it('bills the annual tier annually and the others monthly', () => {
    expect(basic.billingPeriod).toBe('monthly');
    expect(standard.billingPeriod).toBe('monthly');
    expect(enterprise.billingPeriod).toBe('annual');
  });

  it('keeps every amount an integer number of pesewas', () => {
    for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
      expect(Number.isInteger(plan.feePesewas)).toBe(true);
      if (plan.perDownloadPesewas !== null) {
        expect(Number.isInteger(plan.perDownloadPesewas)).toBe(true);
      }
    }
  });

  it('prices a bigger plan below a smaller one per download', () => {
    // Otherwise upgrading would cost more per report, which no buyer accepts.
    expect(standard.perDownloadPesewas!).toBeLessThan(basic.perDownloadPesewas!);
  });
});

describe('downloadCharge', () => {
  it('is the per-download price on a metered plan', () => {
    expect(downloadCharge(basic)).toBe(2_000);
    expect(downloadCharge(standard)).toBe(1_200);
  });

  it('is zero on an unlimited plan', () => {
    expect(downloadCharge(enterprise)).toBe(0);
  });
});

describe('periodCost', () => {
  it('is the fee alone when nothing was downloaded', () => {
    expect(periodCost(basic, 0)).toBe(basic.feePesewas);
    expect(periodCost(enterprise, 0)).toBe(enterprise.feePesewas);
  });

  it('adds the per-download charge on metered plans', () => {
    expect(periodCost(basic, 10)).toBe(basic.feePesewas + 20_000);
    expect(periodCost(standard, 10)).toBe(standard.feePesewas + 12_000);
  });

  it('never charges an unlimited plan for volume', () => {
    expect(periodCost(enterprise, 0)).toBe(enterprise.feePesewas);
    expect(periodCost(enterprise, 10_000)).toBe(enterprise.feePesewas);
  });

  it('clamps nonsense download counts rather than producing a credit', () => {
    expect(periodCost(basic, -5)).toBe(basic.feePesewas);
    // A fractional download is not a thing; round down rather than bill for it.
    expect(periodCost(basic, 2.9)).toBe(basic.feePesewas + 4_000);
  });

  it('stays exact across a long period', () => {
    // The reason money is integer pesewas: this must not drift.
    const total = periodCost(standard, 365);
    expect(total).toBe(180_000 + 1_200 * 365);
    expect(Number.isInteger(total)).toBe(true);
  });
});

describe('annualCost', () => {
  it('multiplies a monthly fee by twelve', () => {
    expect(annualCost(basic, 0)).toBe(basic.feePesewas * 12);
  });

  it('charges an annual fee once', () => {
    expect(annualCost(enterprise, 0)).toBe(enterprise.feePesewas);
    expect(annualCost(enterprise, 5_000)).toBe(enterprise.feePesewas);
  });

  it('adds metered downloads across the year', () => {
    expect(annualCost(standard, 100)).toBe(standard.feePesewas * 12 + 1_200 * 100);
  });
});

describe('breakEvenDownloads', () => {
  it('says how many downloads make unlimited the cheaper choice', () => {
    const point = breakEvenDownloads(standard, enterprise);
    expect(point).not.toBeNull();

    // At the break-even point unlimited must not cost more.
    expect(annualCost(enterprise, point!)).toBeLessThanOrEqual(annualCost(standard, point!));
    // Just below it, metering must still win — otherwise the number is wrong.
    expect(annualCost(standard, point! - 1)).toBeLessThan(annualCost(enterprise, point! - 1));
  });

  it('is null when the plan compared is itself unlimited', () => {
    expect(breakEvenDownloads(enterprise, enterprise)).toBeNull();
  });

  it('is zero when unlimited costs no more in fees', () => {
    const cheapUnlimited = { ...enterprise, feePesewas: 0 };
    expect(breakEvenDownloads(basic, cheapUnlimited)).toBe(0);
  });

  it('reaches break-even sooner from the tier whose fee is already closest', () => {
    /*
     * Standard costs more per year in subscription than basic, which leaves a
     * much smaller gap for enterprise to close — so a standard subscriber
     * reaches the upgrade point on far fewer downloads, even though each of
     * their downloads is cheaper. The cheap plan is the one that has to buy a
     * lot before unlimited pays.
     */
    const fromBasic = breakEvenDownloads(basic, enterprise)!;
    const fromStandard = breakEvenDownloads(standard, enterprise)!;
    expect(fromBasic).toBeGreaterThan(0);
    expect(fromStandard).toBeGreaterThan(0);
    expect(fromStandard).toBeLessThan(fromBasic);
  });
});
