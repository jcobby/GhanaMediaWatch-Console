'use client';

import { useState } from 'react';
import { AlertCircle, Check, FileText, ShieldCheck, X } from 'lucide-react';
import {
  DOCUMENT_REQUIREMENTS,
  ONBOARDING_STEPS,
  approvalProblem,
  formatRelativeTime,
  outstandingForApproval,
  stepState,
  type DocumentId,
  type OnboardingApplication,
  type OnboardingStepId,
} from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Reviewing one application, a step at a time.
 *
 * Approving the whole thing at once means a reviewer either accepts everything
 * or rejects everything — and the applicant is told "declined" with no idea
 * which document was wrong. Per-step review lets one step go back while the
 * rest stand, which is the difference between a fortnight of email and a
 * same-day fix.
 *
 * The final approval is gated on every step being approved *and* screening
 * being run and clear. It is the decision that grants an organisation access to
 * footage of the public, so no single click reaches it.
 */
export function ApplicationReview({ application }: { application: OnboardingApplication }) {
  const [live, setLive] = useState(application);
  const [tab, setTab] = useState<OnboardingStepId | 'screening'>(ONBOARDING_STEPS[0]!.id);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const decide = (id: OnboardingStepId, status: 'approved' | 'rejected', why: string | null) =>
    setLive((prev) => ({
      ...prev,
      steps: [
        ...prev.steps.filter((s) => s.id !== id),
        {
          id,
          status,
          rejectionReason: why,
          submittedAtIso: stepState(prev, id).submittedAtIso,
          reviewedAtIso: new Date().toISOString(),
          reviewedBy: 'You',
        },
      ],
    }));

  const problem = approvalProblem(live);
  const outstanding = outstandingForApproval(live);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-sm font-semibold tracking-wider">{live.reference}</p>
        <Badge tone={live.submittedAtIso ? 'info' : 'neutral'}>
          {live.approvedAtIso ? 'Approved' : live.submittedAtIso ? 'Under review' : 'Draft'}
        </Badge>
      </div>

      {/* Step tabs, mirroring what the applicant filled in. */}
      <div className="flex flex-wrap gap-1">
        {ONBOARDING_STEPS.map((meta) => {
          const state = stepState(live, meta.id);
          const active = tab === meta.id;
          return (
            <button
              key={meta.id}
              type="button"
              onClick={() => {
                setTab(meta.id);
                setRejecting(false);
              }}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs transition',
                active
                  ? 'bg-accent text-text-on-dark'
                  : 'bg-canvas-raise/60 text-text-muted hover:text-text-primary',
              )}
            >
              <StatusDot status={state.status} active={active} />
              {meta.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setTab('screening')}
          aria-pressed={tab === 'screening'}
          className={cn(
            'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs transition',
            tab === 'screening'
              ? 'bg-accent text-text-on-dark'
              : 'bg-canvas-raise/60 text-text-muted hover:text-text-primary',
          )}
        >
          <ShieldCheck className="h-3 w-3" />
          Screening &amp; approval
        </button>
      </div>

      {tab !== 'screening' ? (
        <StepReview
          application={live}
          id={tab}
          rejecting={rejecting}
          reason={reason}
          onReason={setReason}
          onStartReject={() => setRejecting(true)}
          onCancel={() => {
            setRejecting(false);
            setReason('');
          }}
          onApprove={() => decide(tab, 'approved', null)}
          onReject={() => {
            decide(tab, 'rejected', reason.trim());
            setRejecting(false);
            setReason('');
          }}
        />
      ) : (
        <Panel className="p-5">
          <h3 className="text-sm font-semibold">Sanctions and adverse-media screening</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Run against the organisation and its authorised officer.
          </p>

          <p className="mt-3 text-xs">
            {live.screeningRunAtIso ? (
              live.screeningClear ? (
                <span className="font-medium text-success">
                  Clear — run {formatRelativeTime(live.screeningRunAtIso) ?? 'just now'}.
                </span>
              ) : (
                <span className="font-medium text-danger">
                  Returned a hit. Escalate before deciding.
                </span>
              )
            ) : (
              <span className="text-text-muted">Not run yet.</span>
            )}
          </p>

          {!live.screeningRunAtIso ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() =>
                setLive((prev) => ({
                  ...prev,
                  screeningRunAtIso: new Date().toISOString(),
                  screeningClear: true,
                }))
              }
            >
              Run screening
            </Button>
          ) : null}

          <div className="mt-5 border-t border-hairline/[0.07] pt-4">
            {outstanding.length > 0 ? (
              <>
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <AlertCircle className="h-3.5 w-3.5 text-warning" />
                  Before this can be approved
                </p>
                <ul className="mt-2 space-y-1">
                  {outstanding.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-2xs text-text-muted">
                      <span
                        aria-hidden
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-pill bg-text-faint"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-xs text-success">Everything is in order.</p>
            )}

            <Button
              size="lg"
              className="mt-4"
              disabled={problem !== null}
              onClick={() =>
                setLive((prev) => ({
                  ...prev,
                  approvedAtIso: new Date().toISOString(),
                }))
              }
            >
              <Check className="h-3.5 w-3.5" /> Approve organisation
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function StepReview({
  application,
  id,
  rejecting,
  reason,
  onReason,
  onStartReject,
  onCancel,
  onApprove,
  onReject,
}: {
  application: OnboardingApplication;
  id: OnboardingStepId;
  rejecting: boolean;
  reason: string;
  onReason: (v: string) => void;
  onStartReject: () => void;
  onCancel: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const meta = ONBOARDING_STEPS.find((m) => m.id === id)!;
  const state = stepState(application, id);
  const docs = application.documents.filter((d) => meta.documents.includes(d.id));

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{meta.label}</h3>
          <p className="mt-0.5 text-xs text-text-muted">{meta.description}</p>
        </div>
        <StepBadge status={state.status} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-hairline/[0.08] p-3.5">
          <p className="text-2xs uppercase tracking-wider text-text-faint">What they submitted</p>
          {state.status === 'not_started' || state.status === 'in_progress' ? (
            <p className="mt-1.5 text-xs text-text-muted">Not completed yet.</p>
          ) : (
            <p className="mt-1.5 text-xs text-text-secondary">
              Sent {formatRelativeTime(state.submittedAtIso ?? '') ?? 'recently'}
              {state.reviewedBy ? ` · reviewed by ${state.reviewedBy}` : ''}
            </p>
          )}
          {state.rejectionReason ? (
            <p className="mt-2 rounded-xs bg-danger-wash/40 px-2.5 py-2 text-2xs text-text-secondary">
              Sent back: {state.rejectionReason}
            </p>
          ) : null}
        </div>

        <div className="rounded-sm border border-hairline/[0.08] p-3.5">
          <p className="text-2xs uppercase tracking-wider text-text-faint">Documents</p>
          {meta.documents.length === 0 ? (
            <p className="mt-1.5 text-xs text-text-muted">This step needs no documents.</p>
          ) : docs.length === 0 ? (
            <p className="mt-1.5 text-xs text-text-muted">Nothing attached.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-2xs">
                  <FileText className="h-3 w-3 shrink-0 text-text-faint" />
                  <span className="min-w-0 flex-1 truncate">
                    {DOCUMENT_REQUIREMENTS[d.id as DocumentId].label}
                  </span>
                  <span className="shrink-0 truncate text-text-faint">{d.fileName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {state.status === 'submitted' ? (
        rejecting ? (
          <div className="mt-4 border-t border-hairline/[0.07] pt-4">
            <label htmlFor="reject-reason" className="text-xs font-medium">
              What needs changing?
            </label>
            <p className="mt-0.5 text-2xs text-text-muted">
              {/* Only this step goes back. The rest of the application stands. */}
              Sent to the applicant. Only this step reopens — everything else stays approved.
            </p>
            <input
              id="reject-reason"
              value={reason}
              onChange={(e) => onReason(e.target.value)}
              placeholder="The registration number does not match the public register."
              className="mt-2 h-9 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-sm"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={reason.trim().length < 4}
                onClick={onReject}
              >
                Send this step back
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex justify-end gap-2 border-t border-hairline/[0.07] pt-4">
            <Button variant="ghost" size="sm" onClick={onStartReject}>
              <X className="h-3.5 w-3.5" /> Send back
            </Button>
            <Button size="sm" onClick={onApprove}>
              <Check className="h-3.5 w-3.5" /> Approve step
            </Button>
          </div>
        )
      ) : null}
    </Panel>
  );
}

function StatusDot({ status, active }: { status: string; active: boolean }) {
  const colour =
    status === 'approved'
      ? 'bg-success'
      : status === 'rejected'
        ? 'bg-danger'
        : status === 'submitted'
          ? 'bg-info'
          : active
            ? 'bg-text-on-dark/50'
            : 'bg-text-faint/40';
  return <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-pill', colour)} />;
}

function StepBadge({ status }: { status: string }) {
  if (status === 'approved') return <Badge tone="success">Approved</Badge>;
  if (status === 'rejected') return <Badge tone="danger">Sent back</Badge>;
  if (status === 'submitted') return <Badge tone="info">Awaiting review</Badge>;
  return <Badge tone="neutral">Not submitted</Badge>;
}
