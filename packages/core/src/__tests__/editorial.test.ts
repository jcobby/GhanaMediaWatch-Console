import {
  CORROBORATION_CHECKS,
  EMPTY_CORROBORATION,
  canRecordDecision,
  corroborationStrength,
  decisionProblem,
  hasIndependentCorroboration,
  hoursWaiting,
  sourceWasReached,
  triageScore,
  type CorroborationCheckId,
  type CorroborationRecord,
  type EditorialCase,
} from '../logic/editorial';

const REASON = 'Two independent witnesses and the police log agree.';

const record = (...completed: CorroborationCheckId[]): CorroborationRecord => ({
  completed,
  notes: null,
});

describe('corroboration checks', () => {
  it('has a unique id, label and positive weight for each', () => {
    const ids = CORROBORATION_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of CORROBORATION_CHECKS) {
      expect(check.label).toBeTruthy();
      expect(check.description.length).toBeGreaterThan(10);
      expect(check.weight).toBeGreaterThan(0);
    }
  });

  it('values independent checks above talking to the source', () => {
    // A reporter confirming their own footage corroborates nothing on its own.
    const source = CORROBORATION_CHECKS.find((c) => c.id === 'source_contacted')!;
    const witness = CORROBORATION_CHECKS.find((c) => c.id === 'independent_witness')!;
    const followup = CORROBORATION_CHECKS.find((c) => c.id === 'field_followup')!;
    expect(source.independent).toBe(false);
    expect(witness.weight).toBeGreaterThan(source.weight);
    expect(followup.weight).toBeGreaterThan(source.weight);
  });

  it('values a landmark match below a witness', () => {
    // A landmark only confirms where it was filmed, which GPS already implied.
    const landmark = CORROBORATION_CHECKS.find((c) => c.id === 'landmark_match')!;
    const witness = CORROBORATION_CHECKS.find((c) => c.id === 'independent_witness')!;
    expect(landmark.weight).toBeLessThan(witness.weight);
  });
});

describe('corroboration strength', () => {
  it('is zero when nothing has been done', () => {
    expect(corroborationStrength(EMPTY_CORROBORATION)).toBe(0);
  });

  it('rises as checks are completed', () => {
    const a = corroborationStrength(record('landmark_match'));
    const b = corroborationStrength(record('landmark_match', 'independent_witness'));
    expect(b).toBeGreaterThan(a);
  });

  it('never exceeds one', () => {
    const all = CORROBORATION_CHECKS.map((c) => c.id);
    expect(corroborationStrength(record(...all))).toBe(1);
  });

  it('ignores an unknown check id', () => {
    // Ids can arrive from an API that is ahead of this build.
    const bogus = record('not_a_check' as CorroborationCheckId);
    expect(corroborationStrength(bogus)).toBe(0);
  });

  it('detects independent corroboration', () => {
    expect(hasIndependentCorroboration(record('source_contacted'))).toBe(false);
    expect(hasIndependentCorroboration(record('official_record'))).toBe(true);
  });
});

describe('recording a decision', () => {
  it('refuses a transition the state machine disallows', () => {
    expect(
      decisionProblem('received_unreviewed', 'verified_high_confidence', record(), 'A', REASON),
    ).toBe('transition_not_allowed');
  });

  it('refuses any decision without a reason', () => {
    // An audit entry with no reason records that somebody clicked something.
    expect(decisionProblem('received_unreviewed', 'integrity_passed', record(), 'A', '')).toBe(
      'reason_required',
    );
    expect(decisionProblem('received_unreviewed', 'integrity_passed', record(), 'A', '  ok')).toBe(
      'reason_required',
    );
  });

  it('allows a technical transition without corroboration', () => {
    // Integrity checks are machine facts; they need no witnesses.
    expect(
      canRecordDecision('received_unreviewed', 'integrity_passed', record(), 'A', REASON),
    ).toBe(true);
  });

  it('refuses to verify without enough corroboration', () => {
    expect(
      decisionProblem(
        'corroboration_in_progress',
        'verified_high_confidence',
        record('landmark_match'),
        'A',
        REASON,
      ),
    ).toBe('insufficient_corroboration');
  });

  it('verifies once enough corroboration exists', () => {
    expect(
      canRecordDecision(
        'corroboration_in_progress',
        'verified_high_confidence',
        record('source_contacted', 'independent_witness', 'official_record'),
        'A',
        REASON,
      ),
    ).toBe(true);
  });

  it('asks less of a partial verification than a full one', () => {
    // Partial verification claims less, so it must be reachable — otherwise
    // editors over-claim rather than under-claim.
    const modest = record('source_contacted', 'landmark_match');
    expect(
      canRecordDecision('corroboration_in_progress', 'verified_in_part', modest, 'A', REASON),
    ).toBe(true);
    expect(
      canRecordDecision(
        'corroboration_in_progress',
        'verified_high_confidence',
        modest,
        'A',
        REASON,
      ),
    ).toBe(false);
  });

  it('demands something independent before verifying an external upload', () => {
    // Class C cannot stand alone. Talking to the source is not enough, however
    // many other boxes get ticked.
    const sourceOnly = record('source_contacted');
    expect(
      decisionProblem('corroboration_in_progress', 'verified_in_part', sourceOnly, 'C', REASON),
    ).toBe('needs_independent_corroboration');
  });

  it('verifies an external upload once something independent exists', () => {
    expect(
      canRecordDecision(
        'corroboration_in_progress',
        'verified_in_part',
        record('source_contacted', 'official_record'),
        'C',
        REASON,
      ),
    ).toBe(true);
  });

  it('does not demand independence of a trusted capture', () => {
    // Class A already carries technical assurance of its own origin.
    expect(
      canRecordDecision(
        'corroboration_in_progress',
        'verified_in_part',
        record('source_contacted'),
        'A',
        REASON,
      ),
    ).toBe(true);
  });

  it('allows rejection at any strength', () => {
    // Nothing should ever be hard to reject.
    expect(
      canRecordDecision('corroboration_in_progress', 'rejected', record(), 'C', 'Staged.'),
    ).toBe(true);
  });

  it('reports the transition problem ahead of the corroboration problem', () => {
    // An editor needs to know the move is impossible before being told to go
    // and find witnesses for it.
    expect(decisionProblem('rejected', 'verified_high_confidence', record(), 'A', REASON)).toBe(
      'transition_not_allowed',
    );
  });
});

describe('case helpers', () => {
  const base: EditorialCase = {
    incidentId: 'inc_1',
    assignedToEditorName: null,
    corroboration: EMPTY_CORROBORATION,
    contacts: [],
    notes: [],
    decisions: [],
    redactionApplied: false,
  };

  it('distinguishes calling a source from reaching them', () => {
    const tried: EditorialCase = {
      ...base,
      contacts: [
        {
          id: 'c1',
          attemptedAtIso: '2026-06-01T10:00:00Z',
          method: 'call',
          outcome: 'no_answer',
          note: null,
          byEditorName: 'Ed',
        },
      ],
    };
    expect(sourceWasReached(tried)).toBe(false);

    const reached: EditorialCase = {
      ...tried,
      contacts: [...tried.contacts, { ...tried.contacts[0]!, id: 'c2', outcome: 'reached' }],
    };
    expect(sourceWasReached(reached)).toBe(true);
  });
});

describe('waiting time', () => {
  it('measures from submission, not assignment', () => {
    const submitted = '2026-06-01T10:00:00.000Z';
    const now = '2026-06-01T13:30:00.000Z';
    expect(hoursWaiting(submitted, now)).toBeCloseTo(3.5, 5);
  });

  it('never reports negative waiting', () => {
    expect(hoursWaiting('2026-06-01T13:00:00Z', '2026-06-01T10:00:00Z')).toBe(0);
  });

  it('returns zero for unparseable dates rather than NaN', () => {
    expect(hoursWaiting('nonsense', '2026-06-01T10:00:00Z')).toBe(0);
  });
});

describe('triage ordering', () => {
  it('puts an expedited class above a flagged one, all else equal', () => {
    expect(triageScore('A', 2, 1)).toBeGreaterThan(triageScore('B', 2, 1));
  });

  it('puts severity above age', () => {
    // A fresh emergency must outrank a week-old observation.
    const freshEmergency = triageScore('A', 4, 0);
    const staleObservation = triageScore('A', 1, 500);
    expect(freshEmergency).toBeGreaterThan(staleObservation);
  });

  it('saturates age so nothing wins on waiting alone', () => {
    expect(triageScore('A', 1, 20)).toBe(triageScore('A', 1, 10_000));
  });

  it('still lets age separate two otherwise identical reports', () => {
    expect(triageScore('A', 2, 5)).toBeGreaterThan(triageScore('A', 2, 1));
  });
});
