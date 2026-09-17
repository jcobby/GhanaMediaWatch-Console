'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import type { ReviewableApplication } from '@/lib/onboarding';

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
 *
 * **Every decision goes to the service.** This panel used to change React state
 * only: a step showed "Approved", screening showed "Clear" without anything
 * having been run, and "Approve organisation" granted nothing. A reload put
 * every application back exactly as it was.
 */
export function ApplicationReview({ application }: { application: ReviewableApplication }) {
  const router = useRouter();
  const [live, setLive] = useState<OnboardingApplication>(application);
  const [tab, setTab] = useState<OnboardingStepId | 'screening'>(ONBOARDING_STEPS[0]!.id);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // A refreshed page brings the service's copy; show that rather than stale state.
  useEffect(() => setLive(application), [application]);

  /** Send one decision. True only once the service has accepted it. */
  const post = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setFailure(null);
    try {
      const res = await fetch(`/api/platform/applications/${encodeURIComponent(application.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let answer: { error?: string } | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as { error?: string }) : null;
      } catch {
        answer = null;
      }
      if (!res.ok) {
        setFailure(answer?.error ?? `That could not be sent — the service answered ${res.status}.`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setFailure('The console could not reach its own server. Nothing was sent.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const decide = async (id: OnboardingStepId, status: 'approved' | 'rejected', why: string | null) => {
    const sent = await post(`step:${id}`, {
      decision: 'step',
      stepId: id,
      status,
      ...(why ? { note: why } : {}),
    });
    if (!sent) return;
    // Shown at once; the refresh that follows replaces it with the service's copy.
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
  };

  const problem = approvalProblem(live);
  const outstanding = outstandingForApproval(live);
  // Without an id there is no route to send a decision to.
  const decidable = Boolean(application.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold tracking-wider">{live.reference}</p>
          {live.organisationName ? (
            <p className="truncate text-xs text-text-muted">{live.organisationName}</p>
          ) : null}
        </div>
        <Badge tone={live.submittedAtIso ? 'info' : 'neutral'}>
          {live.approvedAtIso ? 'Approved' : live.submittedAtIso ? 'Under review' : 'Draft'}
        </Badge>
      </div>

      {failure ? (
        <p role="alert" className="rounded-sm border border-danger/25 bg-danger-wash px-3 py-2 text-xs text-danger">
          {failure}
        </p>
      ) : null}

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
          onClick={() => {
            setTab('screening');
            /*
             * The reject form is shared between sending one step back and
             * declining the whole application — two very different acts. Leaving
             * it open across the switch would present a half-typed step reason
             * under "decline the whole application".
             */
            setRejecting(false);
            setReason('');
          }}
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
          applicationId={application.id}
          id={tab}
          rejecting={rejecting}
          reason={reason}
          busy={busy === `step:${tab}` || !decidable}
          onReason={setReason}
          onStartReject={() => setRejecting(true)}
          onCancel={() => {
            setRejecting(false);
            setReason('');
          }}
          onApprove={() => void decide(tab, 'approved', null)}
          onReject={() => {
            void decide(tab, 'rejected', reason.trim()).then(() => {
              setRejecting(false);
              setReason('');
            });
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
              loading={busy === 'screening'}
              disabled={!decidable}
              // The result comes from the service on refresh; nothing is assumed clear here.
              onClick={() => void post('screening', { decision: 'screening' })}
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
              loading={busy === 'approve'}
              disabled={problem !== null || !decidable}
              onClick={() => void post('approve', { decision: 'approved' })}
            >
              <Check className="h-3.5 w-3.5" /> Approve organisation
            </Button>

            {/*
              Declining the whole application.

              Separated from approval by a rule rather than by spacing: the
              reason is required, because an applicant told only "declined"
              applies again with the same problem. Sending one step back is still
              the better answer for a fixable mistake, and it is named here so a
              reviewer reaches for it first.
            */}
            <div className="mt-5 border-t border-hairline/[0.07] pt-4">
              {rejecting ? (
                <>
                  <label htmlFor="decline-application" className="text-xs font-medium">
                    Why are you declining the whole application?
                  </label>
                  <p className="mt-0.5 text-2xs text-text-muted">
                    Shown to the applicant. If one step is wrong, send that step back instead —
                    the rest of their work stands.
                  </p>
                  <input
                    id="decline-application"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="The registered entity does not exist on the public register."
                    className="mt-2 h-9 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-sm"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRejecting(false);
                        setReason('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busy === 'reject'}
                      disabled={reason.trim().length < 4 || !decidable}
                      onClick={() => {
                        void post('reject', {
                          decision: 'rejected',
                          note: reason.trim(),
                        }).then((sent) => {
                          if (sent) {
                            setRejecting(false);
                            setReason('');
                          }
                        });
                      }}
                    >
                      Decline application
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!decidable || Boolean(live.approvedAtIso)}
                  onClick={() => setRejecting(true)}
                >
                  <X className="h-3.5 w-3.5" /> Decline application
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function StepReview({
  application,
  applicationId,
  id,
  rejecting,
  reason,
  busy,
  onReason,
  onStartReject,
  onCancel,
  onApprove,
  onReject,
}: {
  application: OnboardingApplication;
  /** Needed to fetch the attached files, which hang off the application. */
  applicationId: string;
  id: OnboardingStepId;
  rejecting: boolean;
  reason: string;
  busy: boolean;
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
            /*
              The file itself, not its name.

              A reviewer approving an organisation on the strength of a filename
              is the failure this whole step exists to prevent, and for a long
              time it was all this list could offer — the service kept no bytes.
              It does now, so every row opens the document.
            */
            <ul className="mt-1.5 space-y-1.5">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-2xs">
                  <FileText className="h-3 w-3 shrink-0 text-text-faint" />
                  <a
                    href={`/api/platform/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(d.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate font-medium text-accent hover:underline"
                  >
                    {DOCUMENT_REQUIREMENTS[d.id as DocumentId].label}
                  </a>
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
            <label htmlFor={`reject-reason-${id}`} className="text-xs font-medium">
              What needs changing?
            </label>
            <p className="mt-0.5 text-2xs text-text-muted">
              {/* Only this step goes back. The rest of the application stands. */}
              Sent to the applicant. Only this step reopens — everything else stays approved.
            </p>
            <input
              id={`reject-reason-${id}`}
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
                disabled={reason.trim().length < 4 || busy}
                onClick={onReject}
              >
                Send this step back
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex justify-end gap-2 border-t border-hairline/[0.07] pt-4">
            <Button variant="ghost" size="sm" disabled={busy} onClick={onStartReject}>
              <X className="h-3.5 w-3.5" /> Send back
            </Button>
            <Button size="sm" disabled={busy} onClick={onApprove}>
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
