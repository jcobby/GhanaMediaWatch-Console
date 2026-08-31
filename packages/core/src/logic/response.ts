import type { Severity } from '../types/context';

/**
 * What an institution did about a report.
 *
 * Until now a subscriber could license footage and nothing more — the platform
 * had no idea whether anyone acted on it. That gap matters in both directions:
 * a reporter who never learns anything happened stops filing, and an agency
 * that cannot show it responded has no evidence of its own work.
 *
 * The response log is that record, and it is append-only. "We closed this with
 * no action" is a decision someone made and should have to stand behind, not
 * something that can be quietly rewritten later.
 */

export type ResponseAction =
  /** Seen by a human. Nothing has been done yet. */
  | 'acknowledged'
  /** Cannot act without something more from the reporter. */
  | 'more_info_requested'
  /** Someone has gone to look. */
  | 'inspecting'
  /** Passed to a different body, because it is not ours. */
  | 'referred'
  /** Dealt with. */
  | 'resolved'
  /** Considered and deliberately not acted on. */
  | 'closed_no_action';

export interface ResponseActionMeta {
  label: string;
  description: string;
  /** Whether the case is finished after this. */
  terminal: boolean;
  /** Whether the reporter is told. */
  notifiesReporter: boolean;
  hue: string;
}

export const RESPONSE_META: Record<ResponseAction, ResponseActionMeta> = {
  acknowledged: {
    label: 'Acknowledged',
    description: 'A person has seen it. No action taken yet.',
    terminal: false,
    notifiesReporter: true,
    hue: '#1D4ED8',
  },
  more_info_requested: {
    label: 'More information needed',
    description: 'Cannot act without something further from the reporter.',
    terminal: false,
    notifiesReporter: true,
    hue: '#A25C00',
  },
  inspecting: {
    label: 'Inspecting',
    description: 'Someone has been sent to look at it.',
    terminal: false,
    notifiesReporter: true,
    hue: '#0E7490',
  },
  referred: {
    label: 'Referred elsewhere',
    description: 'Passed to the body whose responsibility it is.',
    terminal: true,
    notifiesReporter: true,
    hue: '#7C3AED',
  },
  resolved: {
    label: 'Resolved',
    description: 'Dealt with. Evidence of the work attached where there is any.',
    terminal: true,
    notifiesReporter: true,
    hue: '#0B7A4B',
  },
  closed_no_action: {
    label: 'Closed without action',
    description: 'Considered and deliberately not acted on.',
    terminal: true,
    // Told anyway. Silence is what makes people stop reporting, and a reasoned
    // "no" respects the effort more than nothing at all.
    notifiesReporter: true,
    hue: '#475569',
  },
};

export interface ResponseEntry {
  id: string;
  incidentId: string;
  businessId: string;
  action: ResponseAction;
  byEmployeeName: string;
  note: string | null;
  /** A photo of the repair, the inspection sheet, the referral letter. */
  evidenceUrl: string | null;
  atIso: string;
}

/** The most recent action, or null if nobody has touched it. */
export function latestResponse(entries: ResponseEntry[]): ResponseEntry | null {
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => Date.parse(b.atIso) - Date.parse(a.atIso))[0]!;
}

/** Whether this case is finished. */
export function isClosed(entries: ResponseEntry[]): boolean {
  const latest = latestResponse(entries);
  return latest ? RESPONSE_META[latest.action].terminal : false;
}

/**
 * Whether an action may follow the current state.
 *
 * A closed case can be reopened — things come back — but only by an action
 * that genuinely reopens it. Recording "resolved" twice is not a workflow.
 */
export function canRecordResponse(entries: ResponseEntry[], action: ResponseAction): boolean {
  const latest = latestResponse(entries);
  if (!latest) return true;
  if (latest.action === action) return false;
  if (RESPONSE_META[latest.action].terminal) {
    // Reopening means going back to active work, not to another ending.
    return !RESPONSE_META[action].terminal;
  }
  return true;
}

// ─── service levels ────────────────────────────────────────────────────────

/**
 * How long an institution has to acknowledge, by severity, in hours.
 *
 * Acknowledgement rather than resolution. How long a repair takes depends on
 * the repair; how long it takes to look at something and say "we have this"
 * depends only on whether anyone is watching the inbox — which is the thing a
 * service level can fairly hold someone to.
 */
export const ACK_TARGET_HOURS: Record<Severity, number> = {
  emergency: 1,
  urgent: 4,
  concern: 24,
  observation: 72,
};

export type SlaStatus = 'met' | 'due' | 'at_risk' | 'breached';

export interface SlaState {
  status: SlaStatus;
  targetHours: number;
  /** Hours until the target, negative once it has passed. */
  hoursRemaining: number;
}

/**
 * Where this report stands against its acknowledgement target.
 *
 * Once acknowledged the clock stops — late or not, the answer is fixed and
 * recomputing it against the current time would make met cases silently drift
 * into breached ones.
 */
export function slaState(
  severity: Severity,
  submittedAtIso: string,
  acknowledgedAtIso: string | null,
  nowIso: string,
): SlaState {
  const targetHours = ACK_TARGET_HOURS[severity];
  const submitted = Date.parse(submittedAtIso);
  const reference = Date.parse(acknowledgedAtIso ?? nowIso);

  if (!Number.isFinite(submitted) || !Number.isFinite(reference)) {
    return { status: 'due', targetHours, hoursRemaining: targetHours };
  }

  const elapsed = Math.max(0, (reference - submitted) / 3_600_000);
  const hoursRemaining = targetHours - elapsed;

  if (acknowledgedAtIso) {
    return {
      status: elapsed <= targetHours ? 'met' : 'breached',
      targetHours,
      hoursRemaining,
    };
  }

  if (hoursRemaining <= 0) return { status: 'breached', targetHours, hoursRemaining };
  // The last quarter of the window is where a nudge still changes the outcome.
  if (hoursRemaining <= targetHours * 0.25) {
    return { status: 'at_risk', targetHours, hoursRemaining };
  }
  return { status: 'due', targetHours, hoursRemaining };
}

/**
 * Whether this should be escalated to someone more senior.
 *
 * Only unacknowledged breaches escalate. A case acknowledged late is already
 * with a person, and escalating it would tell a supervisor to chase work that
 * is already being done.
 */
export function needsEscalation(sla: SlaState, acknowledged: boolean): boolean {
  return sla.status === 'breached' && !acknowledged;
}
