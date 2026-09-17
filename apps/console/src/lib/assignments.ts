/**
 * Dispatch assignments, as `GET /org/assignments` sends them.
 *
 * An assignment is a person sent to a report: accepted, on the way, on scene,
 * closed. The service documents the four statuses it accepts as updates; the
 * status a fresh assignment starts in is not documented, so the common words for
 * it are read as "assigned" and anything else is shown as written and offered no
 * next step — a control that guesses the next state of a dispatch is worse than
 * none.
 */

export const ASSIGNMENT_FLOW = ['assigned', 'accepted', 'en_route', 'on_scene', 'closed'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_FLOW)[number];
export type AssignmentUpdate = Exclude<AssignmentStatus, 'assigned'>;

export const ASSIGNMENT_LABEL: Record<AssignmentStatus, string> = {
  assigned: 'Assigned',
  accepted: 'Accepted',
  en_route: 'On the way',
  on_scene: 'On scene',
  closed: 'Closed',
};

/** What the button that moves it along says. */
export const ADVANCE_LABEL: Record<AssignmentUpdate, string> = {
  accepted: 'Mark accepted',
  en_route: 'Mark on the way',
  on_scene: 'Mark on scene',
  closed: 'Close',
};

export interface Assignment {
  id: string;
  incidentId: string;
  assigneeName: string;
  status: AssignmentStatus | null;
  statusRaw: string;
  note: string | null;
  createdAtIso: string | null;
  updatedAtIso: string | null;
}

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

function statusOf(value: unknown): AssignmentStatus | null {
  if (typeof value !== 'string') return null;
  if ((ASSIGNMENT_FLOW as readonly string[]).includes(value)) return value as AssignmentStatus;
  if (['pending', 'open', 'created', 'new'].includes(value)) return 'assigned';
  return null;
}

export function normaliseAssignment(raw: unknown): Assignment | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    incidentId: text(raw.incidentId) ?? '',
    assigneeName: text(raw.employeeName) ?? text(raw.assigneeName) ?? text(raw.assigneeId) ?? 'Unassigned',
    status: statusOf(raw.status),
    statusRaw: text(raw.status) ?? 'unknown',
    note: text(raw.note),
    createdAtIso: text(raw.createdAt) ?? text(raw.createdAtIso),
    updatedAtIso: text(raw.updatedAt) ?? text(raw.updatedAtIso),
  };
}

export function normaliseAssignments(rows: unknown[]): Assignment[] {
  return rows.map(normaliseAssignment).filter((a): a is Assignment => a !== null);
}

/** The one step after this, or null when there is none to offer. */
export function nextStatus(status: AssignmentStatus | null): AssignmentUpdate | null {
  if (status === null || status === 'closed') return null;
  return ASSIGNMENT_FLOW[ASSIGNMENT_FLOW.indexOf(status) + 1] as AssignmentUpdate;
}
