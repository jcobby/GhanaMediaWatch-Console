'use client';

import { useMemo, useState } from 'react';
import { Check, Phone, PhoneOff, Users } from 'lucide-react';
import {
  ASSURANCE_META,
  CORROBORATION_CHECKS,
  EMPTY_CORROBORATION,
  SEVERITY_META,
  VERIFICATION_META,
  corroborationStrength,
  decisionProblem,
  formatExactCapture,
  formatRelativeTime,
  hasIndependentCorroboration,
  hoursWaiting,
  nextStates,
  triageScore,
  type CorroborationCheckId,
  type DecisionProblem,
  type EditorialCase,
  type Incident,
  type VerificationState,
} from '@dawuro/core';
import { Button, Panel } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import {
  AssuranceBadge,
  HandlingNotice,
  SeverityBadge,
  VerificationBadge,
} from '@/components/TrustBadges';
import { cn } from '@/lib/cn';

const PROBLEM_COPY: Record<DecisionProblem, string> = {
  transition_not_allowed: 'That move is not permitted from the current state.',
  insufficient_corroboration: 'Not enough corroboration has been done for this decision.',
  needs_independent_corroboration:
    'This capture cannot stand alone. Establish something independent of the reporter first.',
  reason_required: 'Record why. The decision is kept permanently.',
};

/**
 * The verification desk.
 *
 * Triage on the left, one case on the right. The queue is ordered by what needs
 * attention rather than by arrival: a fresh emergency outranks a week-old
 * observation, which a first-in-first-out queue gets exactly backwards.
 *
 * The decision panel refuses rather than warns. An editor cannot mark something
 * verified without the corroboration to support it, and the reason is stated —
 * a disabled button with no explanation teaches people to distrust the tool.
 */
export function Workbench({
  reports,
  cases,
  editorName,
}: {
  reports: Incident[];
  cases: EditorialCase[];
  editorName: string;
}) {
  const now = new Date().toISOString();

  const queue = useMemo(() => {
    return reports
      .map((incident) => ({
        incident,
        score: triageScore(
          incident.assurance,
          SEVERITY_META[incident.severity].weight,
          hoursWaiting(incident.capturedAtIso ?? now, now),
        ),
      }))
      .sort((a, b) => b.score - a.score);
  }, [reports, now]);

  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.incident.id ?? null);
  const selected = reports.find((r) => r.id === selectedId) ?? queue[0]?.incident ?? null;

  /** Live editorial state, keyed by incident, seeded from the fixtures. */
  const [live, setLive] = useState<Record<string, EditorialCase>>(() =>
    Object.fromEntries(cases.map((c) => [c.incidentId, c])),
  );
  const [states, setStates] = useState<Record<string, VerificationState>>(() =>
    Object.fromEntries(reports.map((r) => [r.id, r.verification])),
  );

  if (!selected) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-sm text-text-faint">The queue is clear.</p>
      </div>
    );
  }

  const activeCase: EditorialCase = live[selected.id] ?? {
    incidentId: selected.id,
    assignedToEditorName: null,
    corroboration: EMPTY_CORROBORATION,
    contacts: [],
    notes: [],
    decisions: [],
    redactionApplied: false,
  };
  const state = states[selected.id] ?? selected.verification;

  const toggleCheck = (id: CorroborationCheckId) =>
    setLive((prev) => {
      const current = prev[selected.id] ?? activeCase;
      const done = current.corroboration.completed.includes(id);
      return {
        ...prev,
        [selected.id]: {
          ...current,
          corroboration: {
            ...current.corroboration,
            completed: done
              ? current.corroboration.completed.filter((c) => c !== id)
              : [...current.corroboration.completed, id],
          },
        },
      };
    });

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Triage queue */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-hairline/[0.07]">
        <div className="shrink-0 border-b border-hairline/[0.07] px-4 py-2.5">
          <p className="text-xs text-text-muted">
            <span className="tabular font-semibold text-text-primary">{queue.length}</span> in the
            queue, most urgent first
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {queue.map(({ incident }) => {
            const active = selected.id === incident.id;
            const s = states[incident.id] ?? incident.verification;
            return (
              <li key={incident.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(incident.id)}
                  className={cn(
                    'relative w-full px-3 py-3 text-left transition',
                    active ? 'bg-accent-wash/45' : 'hover:bg-canvas-raise/50',
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-[3px] rounded-r-pill bg-accent"
                    />
                  ) : null}
                  <span className="flex items-center gap-1.5">
                    <SeverityBadge severity={incident.severity} />
                    <AssuranceBadge assurance={incident.assurance} showLabel={false} />
                    <span className="ml-auto shrink-0 font-mono text-2xs text-text-faint">
                      {incident.reportId}
                    </span>
                  </span>
                  <span className="mt-1.5 block line-clamp-2 text-xs leading-[1.45] text-text-secondary">
                    {incident.description}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <VerificationBadge state={s} />
                    <span className="text-2xs text-text-faint">
                      {formatRelativeTime(incident.capturedAtIso) ?? ''}
                    </span>
                  </span>
                </button>
                <span className="mx-3 block h-px bg-hairline/[0.05]" />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Case */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-7 py-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xs bg-canvas-raise px-1.5 py-0.5 font-mono text-2xs">
                {selected.reportId}
              </span>
              <SeverityBadge severity={selected.severity} />
              <AssuranceBadge assurance={selected.assurance} />
              <VerificationBadge state={state} />
            </div>
            <p className="mt-2.5 text-[15px] leading-relaxed">{selected.description}</p>
            <p className="mt-1 text-2xs italic text-text-faint">
              {VERIFICATION_META[state].permittedRepresentation}
            </p>
          </div>

          <MediaFrame
            posterUrl={selected.media.posterUrl}
            alt={selected.description}
            when={formatExactCapture(selected.capturedAtIso, selected.capturedAtPrecision)}
            where={selected.location.label}
            isVideo={selected.media.kind === 'video'}
          />

          <HandlingNotice handling={selected.handling} />

          {/* Why this class, in the reviewer's terms. */}
          <Panel className="p-4">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
              Capture assurance
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
              {ASSURANCE_META[selected.assurance].description}
            </p>
            {!ASSURANCE_META[selected.assurance].usableAlone ? (
              <p className="mt-2 rounded-sm bg-warning-wash/40 px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
                Cannot stand alone. Something independent of the reporter is required before this
                may be described as verified.
              </p>
            ) : null}
          </Panel>

          <CorroborationPanel
            completed={activeCase.corroboration.completed}
            onToggle={toggleCheck}
          />

          <ContactLog contacts={activeCase.contacts} />

          <DecisionPanel
            state={state}
            assurance={selected.assurance}
            corroboration={activeCase.corroboration}
            editorName={editorName}
            history={activeCase.decisions}
            onDecide={(to, reason) => {
              setStates((prev) => ({ ...prev, [selected.id]: to }));
              setLive((prev) => {
                const current = prev[selected.id] ?? activeCase;
                return {
                  ...prev,
                  [selected.id]: {
                    ...current,
                    decisions: [
                      ...current.decisions,
                      {
                        id: `dr_${Date.now()}`,
                        from: state,
                        to,
                        editorName,
                        reason,
                        decidedAtIso: new Date().toISOString(),
                      },
                    ],
                  },
                };
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CorroborationPanel({
  completed,
  onToggle,
}: {
  completed: CorroborationCheckId[];
  onToggle: (id: CorroborationCheckId) => void;
}) {
  const record = { completed, notes: null };
  const strength = corroborationStrength(record);
  const independent = hasIndependentCorroboration(record);

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          Corroboration
        </p>
        <span className="tabular text-2xs text-text-muted">{Math.round(strength * 100)}%</span>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-pill bg-canvas-raise">
        <div
          className={cn('h-full rounded-pill', strength >= 0.5 ? 'bg-success' : 'bg-accent')}
          style={{ width: `${Math.round(strength * 100)}%` }}
        />
      </div>

      {!independent && completed.length > 0 ? (
        <p className="mt-2 text-2xs text-warning">Nothing independent of the reporter yet.</p>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {CORROBORATION_CHECKS.map((check) => {
          const done = completed.includes(check.id);
          return (
            <li key={check.id}>
              <button
                type="button"
                onClick={() => onToggle(check.id)}
                aria-pressed={done}
                className="flex w-full items-start gap-2.5 rounded-sm px-2 py-1.5 text-left transition hover:bg-canvas-raise/50"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border',
                    done ? 'border-success bg-success' : 'border-hairline/25',
                  )}
                >
                  {done ? (
                    <Check className="h-2.5 w-2.5 text-text-on-dark" strokeWidth={3.5} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{check.label}</span>
                    {check.independent ? (
                      <span className="rounded-pill bg-info-wash px-1.5 text-2xs text-info">
                        independent
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-px block text-2xs text-text-muted">{check.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function ContactLog({ contacts }: { contacts: EditorialCase['contacts'] }) {
  return (
    <Panel className="p-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
        Source contact
      </p>
      {contacts.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">Nobody has tried to reach the reporter yet.</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              {c.outcome === 'reached' ? (
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.2} />
              ) : (
                <PhoneOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={2} />
              )}
              <div className="min-w-0 flex-1 text-xs">
                <p>
                  <span className="font-medium capitalize">{c.method}</span>{' '}
                  <span className="text-text-muted">— {c.outcome.replace('_', ' ')}</span>
                </p>
                {c.note ? <p className="mt-px text-text-muted">{c.note}</p> : null}
                <p className="mt-px text-2xs text-text-faint">
                  {c.byEditorName} · {formatRelativeTime(c.attemptedAtIso) ?? ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" size="sm" className="mt-3">
        <Phone className="h-3.5 w-3.5" /> Log an attempt
      </Button>
    </Panel>
  );
}

function DecisionPanel({
  state,
  assurance,
  corroboration,
  editorName,
  history,
  onDecide,
}: {
  state: VerificationState;
  assurance: Parameters<typeof decisionProblem>[3];
  corroboration: Parameters<typeof decisionProblem>[2];
  editorName: string;
  history: EditorialCase['decisions'];
  onDecide: (to: VerificationState, reason: string) => void;
}) {
  const [target, setTarget] = useState<VerificationState | null>(null);
  const [reason, setReason] = useState('');

  const options = nextStates(state);
  const problem = target ? decisionProblem(state, target, corroboration, assurance, reason) : null;

  return (
    <Panel className="p-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">Decision</p>

      {options.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">
          This report is closed. Nothing further can be decided about it.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTarget(target === option ? null : option)}
                aria-pressed={target === option}
                className={cn(
                  'rounded-pill border px-3 py-1.5 text-xs transition',
                  target === option
                    ? 'border-accent bg-accent-wash text-accent'
                    : 'border-hairline/12 text-text-muted hover:border-accent/30',
                )}
              >
                {VERIFICATION_META[option].label}
              </button>
            ))}
          </div>

          {target ? (
            <div className="mt-3.5">
              <label htmlFor="decision-reason" className="text-xs font-medium">
                Why?
              </label>
              <p className="mt-0.5 text-2xs text-text-muted">
                Kept permanently against this report and shown in its history.
              </p>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 py-2 text-sm"
                placeholder="Two independent witnesses and the police log agree."
              />

              {/* The refusal explains itself. A disabled button with no reason
                  teaches an editor to distrust the tool. */}
              {problem ? (
                <p className="mt-2 rounded-sm bg-warning-wash/45 px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
                  {PROBLEM_COPY[problem]}
                </p>
              ) : null}

              <Button
                className="mt-3"
                disabled={problem !== null}
                onClick={() => {
                  onDecide(target, reason.trim());
                  setTarget(null);
                  setReason('');
                }}
              >
                Record as {VERIFICATION_META[target].label.toLowerCase()}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {history.length > 0 ? (
        <div className="mt-4 border-t border-hairline/[0.07] pt-3.5">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
            History
          </p>
          <ul className="mt-2 space-y-2">
            {history.map((d) => (
              <li key={d.id} className="text-xs">
                <p>
                  <span className="text-text-muted">{VERIFICATION_META[d.from].label}</span>
                  <span className="mx-1.5 text-text-faint">→</span>
                  <span className="font-medium">{VERIFICATION_META[d.to].label}</span>
                </p>
                <p className="mt-px text-text-muted">{d.reason}</p>
                <p className="mt-px text-2xs text-text-faint">
                  {d.editorName} · {formatRelativeTime(d.decidedAtIso) ?? ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 flex items-center gap-1.5 border-t border-hairline/[0.07] pt-3 text-2xs text-text-faint">
        <Users className="h-3 w-3" /> Signed in as {editorName}
      </p>
    </Panel>
  );
}
