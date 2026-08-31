import {
  ASSURANCE_META,
  VERIFICATION_META,
  VERIFICATION_STATES,
  assuranceClass,
  canLicenseReport,
  canPublishReport,
  canTransition,
  failedChecks,
  nextStates,
  vettingStateFor,
  type CaptureFacts,
  type VerificationState,
} from '../types/assurance';

const perfect: CaptureFacts = {
  capturedInApp: true,
  integritySignatureValid: true,
  timeCheckPassed: true,
  locationCheckPassed: true,
  deviceCheckPassed: true,
  originalPreserved: true,
  institutionalCapture: false,
};

describe('assurance class', () => {
  it('is A when captured in-app with every check passing', () => {
    expect(assuranceClass(perfect)).toBe('A');
  });

  it('drops to B when any single check fails', () => {
    const checks: (keyof CaptureFacts)[] = [
      'integritySignatureValid',
      'timeCheckPassed',
      'locationCheckPassed',
      'deviceCheckPassed',
      'originalPreserved',
    ];
    for (const check of checks) {
      expect(assuranceClass({ ...perfect, [check]: false })).toBe('B');
    }
  });

  it('is C for anything not captured in the app', () => {
    expect(assuranceClass({ ...perfect, capturedInApp: false })).toBe('C');
  });

  it('never rescues an import into a trusted class', () => {
    // Everything else passing must not launder a gallery file. If this
    // regresses, an uploaded clip classifies as institutional evidence.
    const imported: CaptureFacts = {
      ...perfect,
      capturedInApp: false,
      institutionalCapture: true,
    };
    expect(assuranceClass(imported)).toBe('C');
  });

  it('is D for institutional capture in the app', () => {
    expect(assuranceClass({ ...perfect, institutionalCapture: true })).toBe('D');
  });

  it('names the specific failures for a reviewer', () => {
    const facts = {
      ...perfect,
      timeCheckPassed: false,
      deviceCheckPassed: false,
    };
    const failures = failedChecks(facts);
    expect(failures).toHaveLength(2);
    expect(failures.join(' ')).toMatch(/clock/i);
    expect(failures.join(' ')).toMatch(/device/i);
  });

  it('reports nothing failed on a clean capture', () => {
    expect(failedChecks(perfect)).toEqual([]);
  });

  it('lets only A and D skip the queue', () => {
    expect(ASSURANCE_META.A.expeditedReview).toBe(true);
    expect(ASSURANCE_META.D.expeditedReview).toBe(true);
    expect(ASSURANCE_META.B.expeditedReview).toBe(false);
    expect(ASSURANCE_META.C.expeditedReview).toBe(false);
  });

  it('marks external uploads as unusable on their own', () => {
    expect(ASSURANCE_META.C.usableAlone).toBe(false);
    expect(ASSURANCE_META.A.usableAlone).toBe(true);
  });
});

describe('verification states', () => {
  it('describes every state', () => {
    for (const state of VERIFICATION_STATES) {
      const meta = VERIFICATION_META[state];
      expect(meta.label).toBeTruthy();
      expect(meta.meaning.length).toBeGreaterThan(10);
      expect(meta.permittedRepresentation.length).toBeGreaterThan(10);
    }
    expect(Object.keys(VERIFICATION_META).sort()).toEqual([...VERIFICATION_STATES].sort());
  });

  it('allows the word "verified" only in genuinely verified states', () => {
    // The whole point of the model. Integrity passing is not verification.
    const allowed = VERIFICATION_STATES.filter((s) => VERIFICATION_META[s].mayUseWordVerified);
    expect(allowed.sort()).toEqual(['verified_high_confidence', 'verified_in_part']);
  });

  it('never lets an unreviewed submission be published or licensed', () => {
    expect(VERIFICATION_META.received_unreviewed.publishable).toBe(false);
    expect(VERIFICATION_META.received_unreviewed.licensable).toBe(false);
  });

  it('does not publish on integrity alone', () => {
    // A valid hash says the file is unchanged, not that the scene is real.
    expect(VERIFICATION_META.integrity_passed.publishable).toBe(false);
    expect(VERIFICATION_META.integrity_passed.licensable).toBe(true);
  });

  it('stops publication and licensing once disputed', () => {
    expect(VERIFICATION_META.disputed.publishable).toBe(false);
    expect(VERIFICATION_META.disputed.licensable).toBe(false);
  });

  it('permits nothing at all once rejected', () => {
    expect(VERIFICATION_META.rejected.publishable).toBe(false);
    expect(VERIFICATION_META.rejected.licensable).toBe(false);
    expect(VERIFICATION_META.rejected.mayUseWordVerified).toBe(false);
  });
});

describe('transitions', () => {
  it('cannot jump from unreviewed straight to verified', () => {
    // One click must never turn a submission into a published fact.
    expect(canTransition('received_unreviewed', 'verified_high_confidence')).toBe(false);
    expect(canTransition('integrity_passed', 'verified_high_confidence')).toBe(false);
  });

  it('reaches a verified state only through corroboration', () => {
    for (const state of VERIFICATION_STATES) {
      if (state === 'corroboration_in_progress') continue;
      if (canTransition(state, 'verified_high_confidence')) {
        // Only another verified state or a dispute may return there.
        expect(['verified_in_part', 'disputed']).toContain(state);
      }
    }
    expect(canTransition('corroboration_in_progress', 'verified_high_confidence')).toBe(true);
  });

  it('treats rejection as terminal', () => {
    expect(nextStates('rejected')).toEqual([]);
    for (const state of VERIFICATION_STATES) {
      expect(canTransition('rejected', state)).toBe(false);
    }
  });

  it('lets any live state be rejected', () => {
    for (const state of VERIFICATION_STATES) {
      if (state === 'rejected') continue;
      expect(canTransition(state, 'rejected')).toBe(true);
    }
  });

  it('lets a dispute reopen corroboration', () => {
    expect(canTransition('verified_high_confidence', 'disputed')).toBe(true);
    expect(canTransition('disputed', 'corroboration_in_progress')).toBe(true);
  });

  it('never offers a transition to itself', () => {
    for (const state of VERIFICATION_STATES) {
      expect(nextStates(state)).not.toContain(state);
    }
  });
});

describe('assurance gates publication', () => {
  it('publishes a verified Class A report', () => {
    expect(canPublishReport('verified_high_confidence', 'A')).toBe(true);
  });

  it('refuses to publish an external upload even when verified', () => {
    // Class C is usable only as a lead unless independently corroborated.
    expect(canPublishReport('verified_high_confidence', 'C')).toBe(false);
  });

  it('publishes an external upload once independently corroborated', () => {
    expect(canPublishReport('verified_high_confidence', 'C', true)).toBe(true);
  });

  it('refuses to publish an unverified report however good its capture', () => {
    expect(canPublishReport('integrity_passed', 'A')).toBe(false);
    expect(canPublishReport('received_unreviewed', 'D')).toBe(false);
  });

  it('licenses on state alone, independent of class', () => {
    // Licensing is a subscriber acting on a lead; publishing is a public claim.
    expect(canLicenseReport('corroboration_in_progress')).toBe(true);
    expect(canLicenseReport('rejected')).toBe(false);
  });
});

describe('legacy feed mapping', () => {
  it('collapses toward the safer value', () => {
    const safe: VerificationState[] = [
      'received_unreviewed',
      'integrity_passed',
      'corroboration_in_progress',
    ];
    for (const state of safe) {
      expect(vettingStateFor(state)).toBe('pending_review');
    }
  });

  it('maps verified states to published', () => {
    expect(vettingStateFor('verified_high_confidence')).toBe('published');
    expect(vettingStateFor('verified_in_part')).toBe('published');
  });

  it('restricts flagged and disputed rather than publishing them', () => {
    expect(vettingStateFor('integrity_flagged')).toBe('restricted');
    expect(vettingStateFor('disputed')).toBe('restricted');
  });

  it('maps rejection through', () => {
    expect(vettingStateFor('rejected')).toBe('rejected');
  });

  it('never maps a non-publishable state to published', () => {
    for (const state of VERIFICATION_STATES) {
      if (!VERIFICATION_META[state].publishable) {
        expect(vettingStateFor(state)).not.toBe('published');
      }
    }
  });
});
