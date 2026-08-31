/**
 * The test vectors printed in BACKEND_SPEC.md §15.
 *
 * The spec tells a backend engineer to check their implementation against
 * these numbers, so a wrong number here is worse than no number at all — it
 * would send someone hunting a bug in correct code. This suite is what keeps
 * the document honest.
 */
import { formatReportId } from '../types/context';
import { assuranceClass, type CaptureFacts } from '../types/assurance';
import { estimateCommission } from '../logic/commission';
import { annualCost, breakEvenDownloads } from '../logic/billing';
import { slaState } from '../logic/response';
import { handlingRequirements, EMPTY_CONSENT } from '../types/context';
import { SUBSCRIPTION_PLANS } from '../types/dawuro';

describe('§15 report id', () => {
  test.each([
    ['inc_01JBX7Q2K9', 'DW-WQD-JW4'],
    ['inc_01JBX7R4M2', 'DW-YNG-6JR'],
    ['inc_01JBX7S6P7', 'DW-VPR-WCH'],
    ['inc_01JBX7T8Q1', 'DW-DC9-VKM'],
  ])('%s -> %s', (seed, expected) => {
    expect(formatReportId(seed)).toBe(expected);
  });
});

describe('§15 assurance classification', () => {
  const facts = (o: Partial<CaptureFacts>): CaptureFacts => ({
    capturedInApp: true,
    integritySignatureValid: true,
    timeCheckPassed: true,
    locationCheckPassed: true,
    deviceCheckPassed: true,
    originalPreserved: true,
    institutionalCapture: false,
    ...o,
  });

  test('an import can never be rescued into a trusted class', () => {
    expect(assuranceClass(facts({ capturedInApp: false, institutionalCapture: true }))).toBe('C');
  });
  test('import with everything failing is still C', () => {
    expect(
      assuranceClass(
        facts({
          capturedInApp: false,
          integritySignatureValid: false,
          originalPreserved: false,
        }),
      ),
    ).toBe('C');
  });
  test('institutional beats a failed check', () => {
    expect(assuranceClass(facts({ institutionalCapture: true, timeCheckPassed: false }))).toBe('D');
  });
  test('all checks passed is A', () => {
    expect(assuranceClass(facts({}))).toBe('A');
  });
  test('any check failed is B', () => {
    expect(assuranceClass(facts({ timeCheckPassed: false }))).toBe('B');
  });
});

describe('§15 commission', () => {
  const cases = [
    ['flood', 'marketplace', 'photo', 'high', 1, 2_000, 600, 1_400],
    ['flood', 'marketplace', 'video', 'high', 1, 3_000, 900, 2_100],
    ['flood', 'marketplace', 'audio', 'high', 1, 2_500, 750, 1_750],
    ['flood', 'directed', 'video', 'high', 1, 3_750, 1_125, 2_625],
    ['flood', 'marketplace', 'video', 'low', 1, 2_100, 630, 1_470],
    ['galamsey', 'directed', 'video', 'high', 1, 5_625, 1_688, 3_937],
    ['flood', 'public', 'video', 'high', 1, 0, 0, 0],
    ['flood', 'both', 'video', 'high', 1, 3_000, 900, 2_100],
    ['flood', 'marketplace', 'video', 'high', 2, 4_500, 1_350, 3_150],
  ] as const;

  test.each(cases)(
    '%s %s %s %s x%i',
    (category, destination, mediaKind, confidence, licensedBy, gross, fee, reporter) => {
      const out = estimateCommission({
        category,
        destination,
        mediaKind,
        locationConfidence: confidence,
        licensedBy,
      });
      expect(out.grossPesewas).toBe(gross);
      expect(out.platformFeePesewas).toBe(fee);
      expect(out.reporterPesewas).toBe(reporter);
      // The invariant the spec states: the three always reconcile exactly.
      expect(out.grossPesewas - out.platformFeePesewas).toBe(out.reporterPesewas);
    },
  );
});

describe('§15 billing', () => {
  const { basic, standard, enterprise } = SUBSCRIPTION_PLANS;

  test('annual cost at zero downloads', () => {
    expect(annualCost(basic, 0)).toBe(540_000);
    expect(annualCost(standard, 0)).toBe(2_160_000);
    expect(annualCost(enterprise, 0)).toBe(2_400_000);
  });
  test('enterprise is unaffected by volume', () => {
    expect(annualCost(enterprise, 10_000)).toBe(2_400_000);
  });
  test('break-even', () => {
    expect(breakEvenDownloads(basic, enterprise)).toBe(930);
    expect(breakEvenDownloads(standard, enterprise)).toBe(200);
    expect(breakEvenDownloads(enterprise, enterprise)).toBeNull();
  });
});

describe('§15 sla', () => {
  const T = Date.parse('2026-08-27T00:00:00.000Z');
  const at = (hours: number) => new Date(T + hours * 3_600_000).toISOString();

  test.each([
    ['emergency', 0.8, null, 'at_risk'],
    ['emergency', 0.5, null, 'due'],
    ['emergency', 2, null, 'breached'],
    ['concern', 1, null, 'due'],
  ] as const)('%s unacknowledged at +%sh -> %s', (severity, now, ack, expected) => {
    expect(slaState(severity, at(0), ack, at(now)).status).toBe(expected);
  });

  test('the clock stops at acknowledgement', () => {
    expect(slaState('emergency', at(0), at(3), at(99)).status).toBe('breached');
    expect(slaState('observation', at(0), at(70), at(99)).status).toBe('met');
  });
});

describe('§15 handling requirements', () => {
  const c = (o: Partial<typeof EMPTY_CONSENT>) => ({ ...EMPTY_CONSENT, ...o });

  test('minors', () => {
    expect(handlingRequirements(c({ containsMinors: true }))).toEqual([
      'redact_before_publication',
      'editorial_review_required',
    ]);
  });
  test('distressing', () => {
    expect(handlingRequirements(c({ distressing: true }))).toEqual([
      'viewer_warning',
      'editorial_review_required',
    ]);
  });
  test('private property alone also forces redaction', () => {
    expect(handlingRequirements(c({ showsPrivateProperty: true }))).toEqual([
      'restrict_location',
      'redact_before_publication',
    ]);
  });
  test('a public place removes the redaction', () => {
    expect(handlingRequirements(c({ showsPrivateProperty: true, publicPlace: true }))).toEqual([
      'restrict_location',
    ]);
  });
  test('consent removes the redaction', () => {
    expect(
      handlingRequirements(c({ showsPrivateProperty: true, subjectsConsented: true })),
    ).toEqual(['restrict_location']);
  });
  test('nothing flagged needs nothing', () => {
    expect(handlingRequirements(EMPTY_CONSENT)).toEqual([]);
  });
});
