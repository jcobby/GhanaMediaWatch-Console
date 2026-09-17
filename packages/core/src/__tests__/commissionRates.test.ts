import {
  DEFAULT_COMMISSION_RATES,
  bestOffer,
  estimateCommission,
  sanitiseCommissionRates,
  sanitiseOffer,
  type CommissionInput,
} from '../logic/commission';

const base: CommissionInput = {
  category: 'fire',
  destination: 'marketplace',
  mediaKind: 'photo',
  locationConfidence: 'high',
};

describe('rates set by the platform', () => {
  it('uses the defaults when none are passed', () => {
    expect(estimateCommission(base)).toEqual(estimateCommission(base, DEFAULT_COMMISSION_RATES));
    expect(estimateCommission(base).grossPesewas).toBe(2_500);
  });

  it('pays what the platform set', () => {
    const rates = sanitiseCommissionRates({ categoryPesewas: { fire: 4_000 }, platformFeeRate: 0.2 });
    const result = estimateCommission(base, rates);
    expect(result.grossPesewas).toBe(4_000);
    expect(result.platformFeePesewas).toBe(800);
    expect(result.reporterPesewas).toBe(3_200);
  });

  it('applies the multipliers the platform set', () => {
    const rates = sanitiseCommissionRates({ videoMultiplier: 2, directedMultiplier: 1 });
    expect(estimateCommission({ ...base, mediaKind: 'video' }, rates).grossPesewas).toBe(5_000);
    expect(estimateCommission({ ...base, destination: 'directed' }, rates).grossPesewas).toBe(2_500);
  });

  it('keeps a default for anything missing or malformed, rather than zero', () => {
    const rates = sanitiseCommissionRates({ categoryPesewas: { fire: 'lots', flood: null }, videoMultiplier: 'x' });
    expect(rates.categoryPesewas.fire).toBe(2_500);
    expect(rates.categoryPesewas.flood).toBe(2_000);
    expect(rates.videoMultiplier).toBe(1.5);
    expect(sanitiseCommissionRates(null)).toEqual(DEFAULT_COMMISSION_RATES);
  });

  it('clamps typos to sensible limits and whole pesewas', () => {
    const rates = sanitiseCommissionRates({
      categoryPesewas: { fire: 2_500_000, flood: -5, road: 1234.6 },
      platformFeeRate: 3,
      videoMultiplier: 0,
      lowConfidenceMultiplier: 4,
    });
    expect(rates.categoryPesewas.fire).toBe(100_000);
    expect(rates.categoryPesewas.flood).toBe(0);
    expect(rates.categoryPesewas.road).toBe(1_235);
    expect(rates.platformFeeRate).toBe(0.9);
    expect(rates.videoMultiplier).toBe(0.5);
    expect(rates.lowConfidenceMultiplier).toBe(1);
  });
});

describe('offers set by an organisation', () => {
  it('only keeps rates above the platform rate', () => {
    const offer = sanitiseOffer(
      { categoryPesewas: { fire: 5_000, flood: 1_000, road: '1500', crime: 'abc' } },
      DEFAULT_COMMISSION_RATES,
    );
    // Flood at ₵10 is below the platform's ₵20 — not an offer.
    expect(offer.categoryPesewas).toEqual({ fire: 5_000, road: 1_500 });
  });

  it('raises a directed report, and only a directed report', () => {
    const directed = estimateCommission({ ...base, destination: 'directed', offerPesewas: 5_000 });
    expect(directed.grossPesewas).toBe(Math.round(5_000 * 1.25));
    const marketplace = estimateCommission({ ...base, offerPesewas: 5_000 });
    expect(marketplace.grossPesewas).toBe(2_500);
  });

  it('can never pay less than the platform rate', () => {
    const low = estimateCommission({ ...base, destination: 'directed', offerPesewas: 100 });
    expect(low.grossPesewas).toBe(Math.round(2_500 * 1.25));
  });

  it('takes the best offer among the chosen organisations', () => {
    const offers = [
      { categoryPesewas: { fire: 3_000 } },
      null,
      { categoryPesewas: { fire: 4_500, flood: 9_000 } },
    ];
    expect(bestOffer('fire', offers)).toBe(4_500);
    expect(bestOffer('crime', offers)).toBeNull();
  });
});
