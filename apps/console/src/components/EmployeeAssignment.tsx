'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Check, Clock, MapPin, Users } from 'lucide-react';
import {
  assignToEmployee,
  formatDistance,
  type AssignableIncident,
  type AssignmentBlock,
  type AssignmentReason,
  type Branch,
  type BusinessAccount,
  type Employee,
} from '@dawuro/core';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

const REASON_LABEL: Record<AssignmentReason, string> = {
  specialisation_match: 'Handles this category',
  field_duty: 'Field duty',
  nearby: 'Nearby',
  in_branch_area: 'Their area',
  has_capacity: 'Free capacity',
  reliable: 'Reliable',
  language_match: 'Speaks the reporter’s language',
  senior_for_urgent: 'Senior',
};

const BLOCK_LABEL: Record<AssignmentBlock, string> = {
  off_duty: 'Off shift',
  on_leave: 'On leave',
  inactive: 'Account inactive',
  at_capacity: 'At capacity',
  outside_jurisdiction: 'Outside their area',
  not_qualified: 'Different speciality',
};

/**
 * Plain-English summary of why nobody is eligible.
 *
 * Ordered by count so the dominant reason is read first, which is usually the
 * one an operator can do something about.
 */
function summariseBlocks(blocks: AssignmentBlock[]): string {
  if (blocks.length === 0) return '';

  const counts = new Map<AssignmentBlock, number>();
  for (const b of blocks) counts.set(b, (counts.get(b) ?? 0) + 1);

  const phrase: Record<AssignmentBlock, string> = {
    off_duty: 'off shift',
    on_leave: 'on leave',
    inactive: 'deactivated',
    at_capacity: 'at capacity',
    outside_jurisdiction: 'outside their area',
    not_qualified: 'a different speciality',
  };

  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([block, n]) => `${n} ${phrase[block]}`);

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return `Of ${blocks.length}: ${list}.`;
}

/**
 * Choosing a person inside an organisation, not just the organisation.
 *
 * An incident that reaches a body but nobody in particular sits in a shared
 * inbox until someone happens to look. Naming a person is what turns a report
 * into an assignment.
 *
 * Two things are shown that a ranked list alone would hide. Each candidate
 * carries *why* they rank where they do, because an operator overruling the
 * order needs to know what they are overruling. And staff who cannot take it
 * are listed with the reason — an empty list that just says "nobody" is
 * indistinguishable from a broken screen, and "everyone is off shift at 3am" is
 * something the operator must be able to see and act on.
 */
export function EmployeeAssignment({
  business,
  employees,
  branches,
  incident,
  onAssign,
  assignedTo,
}: {
  business: BusinessAccount;
  employees: Employee[];
  branches: Branch[];
  incident: AssignableIncident;
  onAssign: (employeeId: string | null) => void;
  assignedTo: string | null;
}) {
  const [showBlocked, setShowBlocked] = useState(false);

  const result = useMemo(
    () => assignToEmployee(incident, employees, branches),
    [incident, employees, branches],
  );

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  return (
    <section className="mt-6 border-t border-hairline/[0.08] pt-4">
      {/*
       * These repeat once per recipient, so they are the spine of the screen
       * rather than a label. The organisation name is what an operator scans
       * for, so it carries the weight and the colour; "assign inside" is the
       * quiet part. Rendered faint and uniform, the sections ran together.
       */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-accent-wash">
            <Users className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} />
          </span>
          <span className="min-w-0">
            <span className="block text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
              Assign inside
            </span>
            <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-text-primary">
              {business.name}
            </span>
          </span>
        </h2>
        {result.blocked.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowBlocked((v) => !v)}
            className="shrink-0 rounded-pill border border-hairline/12 px-2.5 py-1 text-2xs text-text-muted transition hover:border-accent/30 hover:text-text-primary"
          >
            {showBlocked ? 'Hide' : 'Show'} {result.blocked.length} unavailable
          </button>
        ) : null}
      </div>

      {result.candidates.length === 0 ? (
        <div className="mt-2 flex items-start gap-2.5 rounded-md border border-warning/25 bg-warning-wash/40 p-3.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
          <div className="text-xs leading-relaxed">
            <p className="font-medium text-text-primary">
              {employees.length === 0
                ? 'Nobody from here uses Dawuro yet.'
                : 'Nobody here can take this right now.'}
            </p>
            {/*
             * The reason is the actionable part. "Everyone is off shift" and
             * "everyone is outside their area" call for completely different
             * responses, and a generic sentence hides which one it is.
             */}
            <p className="mt-0.5 text-text-muted">
              {employees.length === 0
                ? 'They will still receive it in their inbox. Ask them to add staff so it can be assigned to a person.'
                : `${summariseBlocks(result.blocked.map((b) => b.blockedBy))} It will sit in their inbox until someone picks it up.`}
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {result.candidates.map((candidate, index) => {
            const employee = byId.get(candidate.employeeId);
            if (!employee) return null;
            const chosen = assignedTo === employee.id;
            const branch = employee.branchId ? branchById.get(employee.branchId) : undefined;

            return (
              <li key={candidate.employeeId}>
                <button
                  type="button"
                  onClick={() => onAssign(chosen ? null : employee.id)}
                  aria-pressed={chosen}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md border p-3 text-left transition',
                    chosen
                      ? 'border-accent bg-accent-wash/45'
                      : 'border-hairline/[0.09] hover:border-accent/30 hover:bg-canvas-raise/40',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border',
                      chosen ? 'border-accent bg-accent' : 'border-hairline/25',
                    )}
                  >
                    {chosen ? (
                      <Check className="h-3 w-3 text-text-on-dark" strokeWidth={3.5} />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{employee.displayName}</span>
                      {/* Rank is stated rather than implied by order alone —
                          an operator scanning quickly reads the badge. */}
                      {index === 0 ? <Badge tone="accent">Best match</Badge> : null}
                      <span className="tabular ml-auto text-2xs text-text-faint">
                        {candidate.score.toFixed(0)} pts
                      </span>
                    </span>

                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
                      {candidate.distanceM !== null ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {formatDistance(candidate.distanceM)}
                        </span>
                      ) : (
                        <span className="text-text-faint">Position not shared</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {employee.openAssignments}/{employee.maxConcurrentAssignments} open
                      </span>
                      {branch ? <span>{branch.name}</span> : null}
                    </span>

                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {candidate.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-pill bg-canvas-raise px-1.5 py-px text-2xs text-text-muted"
                        >
                          {REASON_LABEL[reason]}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showBlocked && result.blocked.length > 0 ? (
        <ul className="mt-2 space-y-1 rounded-md bg-canvas-raise/50 p-2.5">
          {result.blocked.map((b) => {
            const employee = byId.get(b.employeeId);
            if (!employee) return null;
            return (
              <li
                key={b.employeeId}
                className="flex items-center justify-between gap-3 px-1 py-0.5 text-2xs"
              >
                <span className="truncate text-text-muted">{employee.displayName}</span>
                <span className="shrink-0 text-text-faint">{BLOCK_LABEL[b.blockedBy]}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
