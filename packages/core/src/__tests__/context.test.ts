import {
  EMPTY_CONSENT,
  EMPTY_CONTEXT,
  SEVERITIES,
  SEVERITY_META,
  formatReportId,
  handlingRequirements,
  needsEditorialReview,
  needsRedaction,
  warnsAboutEmergencyServices,
  type ConsentFlags,
} from '../types/context';

describe('severity', () => {
  it('describes every level', () => {
    for (const s of SEVERITIES) {
      expect(SEVERITY_META[s].label).toBeTruthy();
      expect(SEVERITY_META[s].hint.length).toBeGreaterThan(10);
      expect(SEVERITY_META[s].hue).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(Object.keys(SEVERITY_META).sort()).toEqual([...SEVERITIES].sort());
  });

  it('orders levels strictly by weight', () => {
    const weights = SEVERITIES.map((s) => SEVERITY_META[s].weight);
    expect(weights).toEqual([...weights].sort((a, b) => a - b));
    expect(new Set(weights).size).toBe(weights.length);
  });

  it('warns about emergency services only at the top level', () => {
    // Dawuro is not an emergency service. Someone filming instead of calling
    // for help is the worst outcome this product can produce.
    expect(warnsAboutEmergencyServices('emergency')).toBe(true);
    for (const s of SEVERITIES.filter((x) => x !== 'emergency')) {
      expect(warnsAboutEmergencyServices(s)).toBe(false);
    }
  });

  it('defaults to something below urgent', () => {
    // A default of "urgent" would make the whole scale meaningless within a
    // week, because every report would arrive marked urgent.
    expect(SEVERITY_META[EMPTY_CONTEXT.severity].weight).toBeLessThan(SEVERITY_META.urgent.weight);
  });
});

describe('consent and handling', () => {
  const flags = (over: Partial<ConsentFlags> = {}): ConsentFlags => ({
    ...EMPTY_CONSENT,
    ...over,
  });

  it('requires nothing when nothing sensitive is present', () => {
    expect(handlingRequirements(flags())).toEqual([]);
    expect(needsRedaction(flags())).toBe(false);
    expect(needsEditorialReview(flags())).toBe(false);
  });

  it('always redacts footage containing minors', () => {
    const f = flags({ containsMinors: true });
    expect(needsRedaction(f)).toBe(true);
    expect(needsEditorialReview(f)).toBe(true);
  });

  it('redacts minors even when everyone consented in a public place', () => {
    // Consent given by adults nearby does not cover a child, and a public
    // place does not make a child publishable.
    const f = flags({
      containsMinors: true,
      subjectsConsented: true,
      publicPlace: true,
    });
    expect(needsRedaction(f)).toBe(true);
  });

  it('warns viewers about distressing footage and sends it to a human', () => {
    const f = flags({ distressing: true });
    expect(handlingRequirements(f)).toContain('viewer_warning');
    expect(needsEditorialReview(f)).toBe(true);
  });

  it('restricts location when a private home is shown', () => {
    expect(handlingRequirements(flags({ showsPrivateProperty: true }))).toContain(
      'restrict_location',
    );
  });

  it('redacts unconsented people at a private address', () => {
    // The case most likely to cause real harm to a real person.
    const f = flags({
      showsPrivateProperty: true,
      subjectsConsented: false,
      publicPlace: false,
    });
    expect(needsRedaction(f)).toBe(true);
  });

  it('does not force redaction at a private address when subjects consented', () => {
    const f = flags({ showsPrivateProperty: true, subjectsConsented: true });
    expect(needsRedaction(f)).toBe(false);
    // The location restriction still stands — the address is not theirs to give.
    expect(handlingRequirements(f)).toContain('restrict_location');
  });

  it('never repeats a requirement', () => {
    const f = flags({
      containsMinors: true,
      distressing: true,
      showsPrivateProperty: true,
    });
    const req = handlingRequirements(f);
    expect(new Set(req).size).toBe(req.length);
  });

  it('accumulates requirements across flags', () => {
    const f = flags({ containsMinors: true, distressing: true });
    expect(handlingRequirements(f)).toEqual(
      expect.arrayContaining([
        'redact_before_publication',
        'viewer_warning',
        'editorial_review_required',
      ]),
    );
  });
});

describe('report id', () => {
  it('is stable for the same seed', () => {
    expect(formatReportId('abc')).toBe(formatReportId('abc'));
  });

  it('differs across seeds', () => {
    const ids = new Set(Array.from({ length: 200 }, (_, i) => formatReportId(`report-${i}`)));
    // Not a uniqueness guarantee — the server assigns the real one — but a
    // generator that collides constantly would be useless on screen.
    expect(ids.size).toBeGreaterThan(190);
  });

  it('reads unambiguously down a phone line', () => {
    // Checked across many ids, not one, since a single sample proves nothing
    // about the alphabet.
    for (let i = 0; i < 300; i += 1) {
      const id = formatReportId(`seed-${i}`);
      expect(id).toMatch(/^DW-[0-9A-Z]{3}-[0-9A-Z]{3}$/);
      // No vowel, so an id can never spell a word.
      expect(id).not.toMatch(/[AEIOU]/);
      // None of the pairs people confuse reading a code off a video overlay.
      expect(id.slice(3)).not.toMatch(/[01I2Z5S8BL]/);
    }
  });
});
