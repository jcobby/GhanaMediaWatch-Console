'use client';

import { useState } from 'react';
import { AlertOctagon, ArrowUpRight, Clock, Paperclip } from 'lucide-react';
import {
  RESPONSE_META,
  canRecordResponse,
  formatRelativeTime,
  isClosed,
  latestResponse,
  needsEscalation,
  slaState,
  type ResponseAction,
  type ResponseEntry,
  type Severity,
} from '@dawuro/core';
import { Button, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

const ORDER: ResponseAction[] = [
  'acknowledged',
  'more_info_requested',
  'inspecting',
  'referred',
  'resolved',
  'closed_no_action',
];

/**
 * What this organisation did about a report.
 *
 * The service-level clock is the first thing shown, and it measures time to
 * *acknowledge* rather than to resolve. How long a repair takes depends on the
 * repair; how long it takes to look at something and say "we have this" depends
 * only on whether anyone is watching the inbox — and that is the thing a
 * subscriber can fairly be held to.
 *
 * The log is append-only. "Closed without action" is a decision someone made
 * and should stand behind, not something that can be quietly rewritten once
 * the report turns out to have mattered.
 */
export function ResponsePanel({
  entries,
  severity,
  submittedAtIso,
  onRecord,
}: {
  entries: ResponseEntry[];
  severity: Severity;
  submittedAtIso: string;
  onRecord: (action: ResponseAction, note: string) => void;
}) {
  const [pending, setPending] = useState<ResponseAction | null>(null);
  const [note, setNote] = useState('');

  const now = new Date().toISOString();
  const ack = entries.find((e) => e.action === 'acknowledged') ?? null;
  const sla = slaState(severity, submittedAtIso, ack?.atIso ?? null, now);
  const escalate = needsEscalation(sla, ack !== null);
  const closed = isClosed(entries);
  const latest = latestResponse(entries);

  const hours = Math.abs(Math.round(sla.hoursRemaining * 10) / 10);

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          Your response
        </p>
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-2xs font-medium',
            sla.status === 'met' && 'bg-success-wash text-success',
            sla.status === 'due' && 'bg-canvas-raise text-text-muted',
            sla.status === 'at_risk' && 'bg-warning-wash text-warning',
            sla.status === 'breached' && 'bg-danger-wash text-danger',
          )}
        >
          <Clock className="h-3 w-3" />
          {sla.status === 'met'
            ? 'Acknowledged in time'
            : sla.status === 'breached'
              ? `${hours}h over target`
              : `${hours}h left to acknowledge`}
        </span>
      </div>

      {/* Escalation only for an unacknowledged breach — chasing a case someone
          already has just annoys the person doing the work. */}
      {escalate ? (
        <div className="mt-2.5 flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-wash/40 p-3">
          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={2.2} />
          <p className="text-xs leading-relaxed">
            <span className="font-medium">Past the {sla.targetHours}-hour target.</span>{' '}
            <span className="text-text-muted">
              Nobody has acknowledged this. It escalates to a supervisor.
            </span>
          </p>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {[...entries]
            .sort((a, b) => Date.parse(a.atIso) - Date.parse(b.atIso))
            .map((e) => {
              const meta = RESPONSE_META[e.action];
              return (
                <li key={e.id} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-1 h-2 w-2 shrink-0 rounded-pill"
                    style={{ backgroundColor: meta.hue }}
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-medium">{meta.label}</p>
                    {e.note ? <p className="mt-px text-text-muted">{e.note}</p> : null}
                    {e.evidenceUrl ? (
                      <p className="mt-1 flex items-center gap-1.5 text-2xs text-accent">
                        <Paperclip className="h-3 w-3" /> Evidence attached
                      </p>
                    ) : null}
                    <p className="mt-px text-2xs text-text-faint">
                      {e.byEmployeeName} · {formatRelativeTime(e.atIso) ?? ''}
                    </p>
                  </div>
                </li>
              );
            })}
        </ul>
      ) : (
        <p className="mt-2.5 text-xs text-text-muted">
          Nobody has recorded anything yet. The reporter is told at every step.
        </p>
      )}

      <div className="mt-3.5 border-t border-hairline/[0.07] pt-3.5">
        {closed && !pending ? (
          <p className="mb-2.5 flex items-center gap-1.5 text-2xs text-text-muted">
            <ArrowUpRight className="h-3 w-3" />
            Closed after &ldquo;{RESPONSE_META[latest!.action].label}&rdquo;. Recording anything
            further reopens it.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((action) => {
            const allowed = canRecordResponse(entries, action);
            const active = pending === action;
            return (
              <button
                key={action}
                type="button"
                disabled={!allowed}
                title={RESPONSE_META[action].description}
                onClick={() => setPending(active ? null : action)}
                className={cn(
                  'rounded-pill border px-2.5 py-1 text-2xs transition',
                  active
                    ? 'border-accent bg-accent-wash text-accent'
                    : allowed
                      ? 'border-hairline/12 text-text-muted hover:border-accent/30'
                      : 'cursor-not-allowed border-hairline/[0.06] text-text-faint opacity-50',
                )}
              >
                {RESPONSE_META[action].label}
              </button>
            );
          })}
        </div>

        {pending ? (
          <div className="mt-3">
            <p className="text-2xs text-text-muted">{RESPONSE_META[pending].description}</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What was done, and by whom."
              aria-label="Response note"
              className="mt-1.5 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 py-2 text-sm"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onRecord(pending, note.trim());
                  setPending(null);
                  setNote('');
                }}
              >
                Record
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <span className="ml-auto text-2xs text-text-faint">
                The reporter is notified either way.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
