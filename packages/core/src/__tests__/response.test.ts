import {
  ACK_TARGET_HOURS,
  RESPONSE_META,
  canRecordResponse,
  isClosed,
  latestResponse,
  needsEscalation,
  slaState,
  type ResponseAction,
  type ResponseEntry,
} from '../logic/response';
import { SEVERITIES, SEVERITY_META } from '../types/context';

const ACTIONS = Object.keys(RESPONSE_META) as ResponseAction[];

function entry(action: ResponseAction, atIso: string, id = action): ResponseEntry {
  return {
    id,
    incidentId: 'inc_1',
    businessId: 'biz_1',
    action,
    byEmployeeName: 'Ama',
    note: null,
    evidenceUrl: null,
    atIso,
  };
}

describe('response actions', () => {
  it('describes every action', () => {
    for (const action of ACTIONS) {
      expect(RESPONSE_META[action].label).toBeTruthy();
      expect(RESPONSE_META[action].description.length).toBeGreaterThan(10);
      expect(RESPONSE_META[action].hue).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('tells the reporter whatever the outcome', () => {
    // Silence is what makes people stop reporting. A reasoned "no" respects
    // the effort more than nothing at all.
    for (const action of ACTIONS) {
      expect(RESPONSE_META[action].notifiesReporter).toBe(true);
    }
  });

  it('marks exactly the endings as terminal', () => {
    const terminal = ACTIONS.filter((a) => RESPONSE_META[a].terminal).sort();
    expect(terminal).toEqual(['closed_no_action', 'referred', 'resolved']);
  });
});

describe('the response log', () => {
  it('is empty before anyone touches it', () => {
    expect(latestResponse([])).toBeNull();
    expect(isClosed([])).toBe(false);
  });

  it('reads the latest by time, not by array order', () => {
    const log = [
      entry('resolved', '2026-06-02T10:00:00Z'),
      entry('acknowledged', '2026-06-01T10:00:00Z'),
    ];
    expect(latestResponse(log)?.action).toBe('resolved');
  });

  it('closes on a terminal action', () => {
    expect(isClosed([entry('acknowledged', '2026-06-01T10:00:00Z')])).toBe(false);
    expect(isClosed([entry('referred', '2026-06-01T10:00:00Z')])).toBe(true);
  });

  it('refuses to record the same action twice in a row', () => {
    const log = [entry('acknowledged', '2026-06-01T10:00:00Z')];
    expect(canRecordResponse(log, 'acknowledged')).toBe(false);
    expect(canRecordResponse(log, 'inspecting')).toBe(true);
  });

  it('reopens a closed case only into active work', () => {
    // Things come back. But moving from resolved straight to closed-no-action
    // is not a workflow, it is a mistake.
    const closed = [entry('resolved', '2026-06-01T10:00:00Z')];
    expect(canRecordResponse(closed, 'inspecting')).toBe(true);
    expect(canRecordResponse(closed, 'closed_no_action')).toBe(false);
    expect(canRecordResponse(closed, 'referred')).toBe(false);
  });

  it('allows any first action', () => {
    for (const action of ACTIONS) {
      expect(canRecordResponse([], action)).toBe(true);
    }
  });
});

describe('acknowledgement targets', () => {
  it('covers every severity', () => {
    for (const s of SEVERITIES) {
      expect(ACK_TARGET_HOURS[s]).toBeGreaterThan(0);
    }
  });

  it('gives more urgent reports less time', () => {
    const ordered = [...SEVERITIES].sort(
      (a, b) => SEVERITY_META[b].weight - SEVERITY_META[a].weight,
    );
    const targets = ordered.map((s) => ACK_TARGET_HOURS[s]);
    // Strictly increasing as severity falls.
    for (let i = 1; i < targets.length; i += 1) {
      expect(targets[i]!).toBeGreaterThan(targets[i - 1]!);
    }
  });
});

describe('service level', () => {
  const submitted = '2026-06-01T10:00:00.000Z';

  it('counts down while unacknowledged', () => {
    const sla = slaState('concern', submitted, null, '2026-06-01T16:00:00.000Z');
    expect(sla.status).toBe('due');
    expect(sla.hoursRemaining).toBeCloseTo(18, 5);
  });

  it('flags the last quarter of the window as at risk', () => {
    // 4-hour target; 3.5 hours gone leaves 0.5, which is under a quarter.
    const sla = slaState('urgent', submitted, null, '2026-06-01T13:30:00.000Z');
    expect(sla.status).toBe('at_risk');
  });

  it('breaches once the window passes unacknowledged', () => {
    const sla = slaState('emergency', submitted, null, '2026-06-01T12:00:00.000Z');
    expect(sla.status).toBe('breached');
    expect(sla.hoursRemaining).toBeLessThan(0);
  });

  it('records a target met when acknowledged in time', () => {
    const sla = slaState('urgent', submitted, '2026-06-01T12:00:00.000Z', '2026-06-05T00:00:00Z');
    expect(sla.status).toBe('met');
  });

  it('stops the clock once acknowledged', () => {
    // Computed days later, the answer must not drift from met to breached.
    const acked = '2026-06-01T12:00:00.000Z';
    const soon = slaState('urgent', submitted, acked, '2026-06-01T12:01:00.000Z');
    const muchLater = slaState('urgent', submitted, acked, '2027-01-01T00:00:00.000Z');
    expect(soon.status).toBe('met');
    expect(muchLater.status).toBe('met');
  });

  it('records a breach when acknowledged late', () => {
    const sla = slaState(
      'emergency',
      submitted,
      '2026-06-01T14:00:00.000Z',
      '2026-06-02T00:00:00Z',
    );
    expect(sla.status).toBe('breached');
  });

  it('does not crash on unparseable dates', () => {
    const sla = slaState('concern', 'nonsense', null, '2026-06-01T10:00:00Z');
    expect(sla.status).toBe('due');
    expect(Number.isFinite(sla.hoursRemaining)).toBe(true);
  });
});

describe('escalation', () => {
  const submitted = '2026-06-01T10:00:00.000Z';

  it('escalates an unacknowledged breach', () => {
    const sla = slaState('emergency', submitted, null, '2026-06-01T13:00:00.000Z');
    expect(needsEscalation(sla, false)).toBe(true);
  });

  it('does not escalate once someone has it', () => {
    // Escalating an acknowledged case tells a supervisor to chase work that is
    // already being done.
    const sla = slaState(
      'emergency',
      submitted,
      '2026-06-01T14:00:00.000Z',
      '2026-06-02T00:00:00Z',
    );
    expect(sla.status).toBe('breached');
    expect(needsEscalation(sla, true)).toBe(false);
  });

  it('does not escalate inside the window', () => {
    const sla = slaState('concern', submitted, null, '2026-06-01T12:00:00.000Z');
    expect(needsEscalation(sla, false)).toBe(false);
  });
});
