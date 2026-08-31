import {
  assignToEmployee,
  bestAssignee,
  blockingReason,
  type AssignableIncident,
} from '../logic/assignment';
import type { Branch, Employee } from '../types/org';

const ACCRA = { latitude: 5.5563, longitude: -0.1969 };
const NEAR = { latitude: 5.56, longitude: -0.197 }; // ~400m
const FAR = { latitude: 5.7, longitude: -0.2 }; // ~16km

const branch: Branch = {
  id: 'br_central',
  businessId: 'biz_1',
  name: 'Central',
  location: ACCRA,
  jurisdictionRadiusM: 8_000,
  areaLabel: 'Accra Central',
};

const otherBranch: Branch = {
  ...branch,
  id: 'br_tema',
  name: 'Tema',
  location: { latitude: 5.6698, longitude: -0.0166 },
  areaLabel: 'Tema',
};

function employee(over: Partial<Employee> = {}): Employee {
  return {
    id: 'emp_1',
    businessId: 'biz_1',
    branchId: 'br_central',
    displayName: 'Ama Serwaa',
    email: 'ama@org.gh',
    phone: null,
    role: 'analyst',
    duties: ['field_response'],
    specialisations: [],
    languages: ['en'],
    shiftStatus: 'on_duty',
    openAssignments: 0,
    maxConcurrentAssignments: 5,
    lastKnownLocation: NEAR,
    lastSeenAtIso: new Date().toISOString(),
    acknowledgementRate: 0.9,
    joinedAtIso: new Date().toISOString(),
    active: true,
    ...over,
  };
}

const fire: AssignableIncident = { category: 'fire', location: ACCRA };

describe('gates — ineligibility beats every other quality', () => {
  it('never routes to someone off shift, however close they are', () => {
    const e = employee({ shiftStatus: 'off_duty', lastKnownLocation: ACCRA });
    expect(blockingReason(e, fire, branch)).toBe('off_duty');

    const { candidates, blocked } = assignToEmployee(fire, [e], [branch]);
    expect(candidates).toHaveLength(0);
    expect(blocked).toEqual([{ employeeId: 'emp_1', blockedBy: 'off_duty' }]);
  });

  it('never routes to someone on leave', () => {
    expect(blockingReason(employee({ shiftStatus: 'on_leave' }), fire, branch)).toBe('on_leave');
  });

  it('never routes to a deactivated account', () => {
    expect(blockingReason(employee({ active: false }), fire, branch)).toBe('inactive');
  });

  it('never routes to someone already at capacity', () => {
    const e = employee({ openAssignments: 5, maxConcurrentAssignments: 5 });
    expect(blockingReason(e, fire, branch)).toBe('at_capacity');
  });

  it('never routes across a jurisdiction boundary', () => {
    // On duty, free, and specialised — but the incident is not their area.
    const e = employee({ branchId: 'br_tema', specialisations: ['fire'] });
    expect(blockingReason(e, fire, otherBranch)).toBe('outside_jurisdiction');
  });

  it('does not gate org-wide staff on jurisdiction', () => {
    // No branch means no boundary — correct for a duty dispatcher.
    const e = employee({ branchId: null });
    expect(blockingReason(e, fire, null)).toBeNull();
  });

  it('blocks a specialist whose speciality does not cover the category', () => {
    const e = employee({ specialisations: ['corruption'] });
    expect(blockingReason(e, fire, branch)).toBe('not_qualified');
  });

  it('treats an empty specialisation list as generalist, not as unqualified', () => {
    // A blank field almost always means "not filled in", and excluding on it
    // would quietly empty an organisation's routing.
    expect(blockingReason(employee({ specialisations: [] }), fire, branch)).toBeNull();
  });

  it('reports every blocked employee rather than returning a bare empty list', () => {
    const { candidates, blocked } = assignToEmployee(
      fire,
      [
        employee({ id: 'a', shiftStatus: 'off_duty' }),
        employee({ id: 'b', openAssignments: 9, maxConcurrentAssignments: 9 }),
      ],
      [branch],
    );
    expect(candidates).toHaveLength(0);
    // A dispatcher facing an empty list must be able to see why.
    expect(blocked.map((b) => b.blockedBy).sort()).toEqual(['at_capacity', 'off_duty']);
  });
});

describe('scoring — fit outranks proximity', () => {
  it('prefers a qualified responder further away over a nearer generalist', () => {
    const specialistFar = employee({
      id: 'specialist',
      specialisations: ['fire'],
      lastKnownLocation: { latitude: 5.58, longitude: -0.198 }, // ~2.6km
    });
    const generalistNear = employee({
      id: 'generalist',
      specialisations: [],
      duties: ['admin'],
      lastKnownLocation: ACCRA, // on top of it
    });

    const result = assignToEmployee(fire, [specialistFar, generalistNear], [branch]);
    expect(bestAssignee(result)?.employeeId).toBe('specialist');
  });

  it('still uses distance to separate otherwise identical people', () => {
    const near = employee({ id: 'near', lastKnownLocation: NEAR });
    const far = employee({ id: 'far', lastKnownLocation: FAR });
    const result = assignToEmployee(fire, [near, far], [branch]);
    expect(result.candidates[0]!.employeeId).toBe('near');
  });

  it('prefers a free person over a loaded one', () => {
    const free = employee({ id: 'free', openAssignments: 0 });
    const loaded = employee({
      id: 'loaded',
      openAssignments: 4,
      maxConcurrentAssignments: 5,
    });
    const result = assignToEmployee(fire, [free, loaded], [branch]);
    expect(result.candidates[0]!.employeeId).toBe('free');
  });

  it('weighs reliability harder when the incident is urgent', () => {
    const flaky = employee({ id: 'flaky', acknowledgementRate: 0.2 });
    const solid = employee({ id: 'solid', acknowledgementRate: 1 });

    const routine = assignToEmployee(fire, [flaky, solid], [branch]);
    const urgent = assignToEmployee({ ...fire, urgent: true }, [flaky, solid], [branch]);

    const gap = (r: ReturnType<typeof assignToEmployee>) =>
      r.candidates.find((c) => c.employeeId === 'solid')!.score -
      r.candidates.find((c) => c.employeeId === 'flaky')!.score;

    expect(gap(urgent)).toBeGreaterThan(gap(routine));
  });

  it('credits a shared language with the reporter', () => {
    const twi = employee({ id: 'twi', languages: ['en', 'twi'] });
    const enOnly = employee({ id: 'en', languages: ['en'] });
    const result = assignToEmployee({ ...fire, reporterLanguage: 'twi' }, [enOnly, twi], [branch]);
    expect(result.candidates[0]!.employeeId).toBe('twi');
    expect(result.candidates[0]!.reasons).toContain('language_match');
  });

  it('prefers seniority for urgent work only', () => {
    const senior = employee({ id: 'senior', role: 'dispatcher' });
    const junior = employee({ id: 'junior', role: 'viewer' });

    const routine = assignToEmployee(fire, [senior, junior], [branch]);
    const urgent = assignToEmployee({ ...fire, urgent: true }, [senior, junior], [branch]);

    const routineGap =
      routine.candidates.find((c) => c.employeeId === 'senior')!.score -
      routine.candidates.find((c) => c.employeeId === 'junior')!.score;
    expect(routineGap).toBe(0);

    expect(urgent.candidates[0]!.employeeId).toBe('senior');
    expect(urgent.candidates[0]!.reasons).toContain('senior_for_urgent');
  });

  it('never scores on proximity alone', () => {
    // Someone with no known position, off-speciality but on duty, must still
    // be reachable — otherwise an organisation whose staff do not share
    // location can never be routed to at all.
    const e = employee({ lastKnownLocation: null });
    const result = assignToEmployee(fire, [e], [branch]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.score).toBeGreaterThan(0);
    expect(result.candidates[0]!.distanceM).toBeNull();
  });
});

describe('locations the reporter hid', () => {
  it('still ranks staff when the incident has no coordinates', () => {
    const hidden: AssignableIncident = { category: 'fire', location: null };
    const specialist = employee({ id: 'spec', specialisations: ['fire'] });
    const other = employee({ id: 'other', duties: ['admin'] });

    const result = assignToEmployee(hidden, [specialist, other], [branch]);
    expect(result.candidates[0]!.employeeId).toBe('spec');
    expect(result.candidates[0]!.distanceM).toBeNull();
  });

  it('does not gate on jurisdiction when the position is unknown', () => {
    // Nothing is outside a boundary you cannot measure against.
    const e = employee({ branchId: 'br_tema' });
    expect(blockingReason(e, { category: 'fire', location: null }, otherBranch)).toBeNull();
  });
});

describe('ordering is deterministic', () => {
  it('breaks exact ties by id so the ranking never reshuffles', () => {
    const a = employee({ id: 'aaa', lastKnownLocation: null });
    const b = employee({ id: 'bbb', lastKnownLocation: null });
    const first = assignToEmployee(fire, [a, b], [branch]).candidates.map((c) => c.employeeId);
    const second = assignToEmployee(fire, [b, a], [branch]).candidates.map((c) => c.employeeId);
    expect(first).toEqual(second);
  });

  it('sorts someone with no known position below an equal-scoring nearby peer', () => {
    const known = employee({ id: 'known', lastKnownLocation: NEAR });
    const unknown = employee({ id: 'unknown', lastKnownLocation: null });
    const result = assignToEmployee(
      { category: 'fire', location: null },
      [unknown, known],
      [branch],
    );
    // Neither scores on proximity here, so the tiebreak decides.
    expect(result.candidates[0]!.employeeId).toBe('known');
  });
});

describe('bestAssignee', () => {
  it('is null when everyone is gated', () => {
    const result = assignToEmployee(fire, [employee({ shiftStatus: 'off_duty' })], [branch]);
    expect(bestAssignee(result)).toBeNull();
  });
});
