'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, FileText, ShieldCheck, X } from 'lucide-react';
import {
  DOCUMENT_REQUIREMENTS,
  ONBOARDING_STEPS,
  REVIEWABLE_STEPS,
  approvalProblem,
  formatRelativeTime,
  outstandingForApproval,
  stepState,
  type DocumentId,
  type OnboardingApplication,
  type OnboardingStepId,
} from '@dawuro/core';
import { Badge, Button, Panel, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fieldOf, type ReviewableApplication } from '@/lib/onboarding';

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
  const toast = useToast();
  const [live, setLive] = useState<OnboardingApplication>(application);
  const [tab, setTab] = useState<OnboardingStepId | 'screening'>(REVIEWABLE_STEPS[0]!.id);
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
        const why = answer?.error ?? `That could not be sent — the service answered ${res.status}.`;
        setFailure(why);
        /*
         * Said twice, on purpose. The inline message is next to the button and
         * survives; the toast is where the reviewer's eye already is, and it is
         * the same place a success appears — so the two outcomes are told in
         * the same voice rather than one shouting and the other silent.
         */
        toast.error('Nothing was recorded', why);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      const why = 'The console could not reach its own server. Nothing was sent.';
      setFailure(why);
      toast.error('Nothing was recorded', why);
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** The organisation, for a message that says which one. */
  const who =
    live.organisationName || fieldOf(application.payloads?.organisation, 'legalName') || live.reference;

  const decide = async (id: OnboardingStepId, status: 'approved' | 'rejected', why: string | null) => {
    const sent = await post(`step:${id}`, {
      decision: 'step',
      stepId: id,
      status,
      ...(why ? { note: why } : {}),
    });
    if (!sent) return;

    const label = REVIEWABLE_STEPS.find((meta) => meta.id === id)?.label ?? id;
    if (status === 'approved') {
      toast.success(`${label} approved`, `${who} — one step closer to a decision.`);
    } else {
      toast.success(`${label} sent back`, `${who} can correct it and resubmit that step.`);
    }

    /*
     * Approving moves on; sending back does not.
     *
     * A reviewer working down an application had to approve a step and then
     * reach for the tab strip to find the next one, every time, and the panel
     * they were left looking at was the one they had just finished with. The
     * next unreviewed step is where they were going.
     *
     * Only on approval: a step sent back is a conversation with the applicant,
     * and jumping away from it hides the reason that was just typed.
     */
    if (status === 'approved') {
      const next = REVIEWABLE_STEPS.find(
        (meta) => meta.id !== id && stepState(live, meta.id).status !== 'approved',
      );
      // Everything reviewed: the only thing left is screening and the decision.
      setTab(next ? next.id : 'screening');
    }
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

  /**
   * Approve every step still waiting, in one action.
   *
   * An application whose three steps a reviewer has read through in the panels
   * above still needed three separate clicks and two tab changes to record
   * that. The evidence is on one screen; the decision should be too.
   *
   * Sequential rather than parallel, and it stops on the first refusal: these
   * are decisions about who may license the public's footage, and a partial
   * result the reviewer cannot see is worse than a clear stop with the
   * service's own reason on screen.
   *
   * It does not approve the organisation — that still needs screening and its
   * own deliberate button. This clears the paperwork, not the decision.
   */
  const approveOutstanding = async () => {
    const count = outstandingSteps.length;
    for (const meta of outstandingSteps) {
      const sent = await post(`step:${meta.id}`, {
        decision: 'step',
        stepId: meta.id,
        status: 'approved',
      });
      if (!sent) return;
    }
    toast.success(
      `${count} step${count === 1 ? '' : 's'} approved`,
      `${who} — screening is the last thing before a decision.`,
    );
    setTab('screening');
  };

  /** Steps a reviewer has yet to approve. Drives both the button and the loop. */
  const outstandingSteps = REVIEWABLE_STEPS.filter(
    (meta) => stepState(live, meta.id).status !== 'approved',
  );

  const problem = approvalProblem(live);
  const outstanding = outstandingForApproval(live);
  // Without an id there is no route to send a decision to.
  const decidable = Boolean(application.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {/*
            The name leads; the reference is the filing number under it.

            It was the other way round and the name was usually absent, so a
            reviewer saw `ONB-ORG-000001` and nothing else — deciding whether an
            organisation may license footage of the public without being told
            which organisation. The service sends no name at the top level, so
            the legal name from the organisation step is the answer: it is what
            the applicant actually submitted, and it is the name being checked.
          */}
          <h2 className="truncate text-base font-semibold tracking-[-0.01em]">
            {live.organisationName ||
              fieldOf(application.payloads?.organisation, 'legalName') ||
              'Unnamed organisation'}
          </h2>
          <p className="font-mono text-2xs tracking-wider text-text-faint">{live.reference}</p>
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
        {REVIEWABLE_STEPS.map((meta) => {
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

        {/*
          Offered only while there is more than one step left to approve.

          On the last one it would be a second button doing exactly what the
          "Approve step" button below already does, sitting in the tab strip
          where it reads as navigation.
        */}
        {outstandingSteps.length > 1 ? (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            loading={busy?.startsWith('step:') ?? false}
            disabled={!decidable}
            onClick={() => void approveOutstanding()}
          >
            <Check className="h-3.5 w-3.5" />
            Approve all {outstandingSteps.length}
          </Button>
        ) : null}
      </div>

      {tab !== 'screening' ? (
        <StepReview
          application={live}
          applicationId={application.id}
          payload={application.payloads?.[tab]}
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

          {/*
            The finding is recorded here; the screening itself happens elsewhere.

            This was one "Run screening" button sending an empty body, on the
            assumption that the service performed the check. It does not — it
            requires `clear`, and answered "Request validation failed. (issues:
            clear: Required)" every time, so the screening step could never be
            completed and no application could ever be approved.
            
            Two buttons rather than one, because the administrator is reporting
            what they found against the sanctions and adverse-media lists. A
            single button would have to assume an answer, and the answer it
            would assume is the one that lets an organisation through.
          */}
          {!live.screeningRunAtIso ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={busy === 'screening'}
                disabled={!decidable}
                onClick={() => {
                  void post('screening', { decision: 'screening', clear: true }).then((sent) => {
                    if (sent) toast.success('Screening recorded as clear', `${who} — nothing matched.`);
                  });
                }}
              >
                No matches — record as clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={busy === 'screening'}
                disabled={!decidable}
                onClick={() => {
                  void post('screening', { decision: 'screening', clear: false }).then((sent) => {
                    if (sent)
                      toast.success('Screening recorded as a hit', `${who} cannot be approved until this is escalated.`);
                  });
                }}
              >
                Matches found
              </Button>
            </div>
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
              onClick={() => {
                void post('approve', { decision: 'approved' }).then((sent) => {
                  if (sent)
                    toast.success(
                      `${who} approved`,
                      'They can sign in to the organisation console and license reports.',
                    );
                });
              }}
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
                            toast.success(
                              `${who} declined`,
                              'They have been told why, and can apply again.',
                            );
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
  payload,
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
  /** What the applicant typed into this step. The thing being reviewed. */
  payload: Record<string, unknown> | undefined;
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
            <>
              {/*
                The answers themselves.

                This panel showed only "Sent 9m" — the fact that a step had been
                submitted, and not one word of what it said. A platform owner
                was being asked to approve a legal name, a registration number
                and an authorised officer's ID while looking at a timestamp.
                Approving an organisation's access to citizens' footage on that
                basis is the failure this whole screen exists to prevent.

                A field the applicant left blank is named and marked rather than
                omitted, because "they did not answer" is itself a reason to
                send a step back.
              */}
              <dl className="mt-2 space-y-1.5">
                {meta.fields.map(({ key, label }) => {
                  const said = fieldOf(payload, key);
                  return (
                    <div key={key} className="flex gap-2 text-xs">
                      <dt className="w-32 shrink-0 text-text-faint">{label}</dt>
                      <dd className={cn('min-w-0 flex-1 break-words', !said && 'text-text-faint')}>
                        {said || 'Not given'}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <p className="mt-2.5 border-t border-hairline/[0.07] pt-2 text-2xs text-text-faint">
                Sent {formatRelativeTime(state.submittedAtIso ?? '') ?? 'recently'}
                {state.reviewedBy ? ` · reviewed by ${state.reviewedBy}` : ''}
              </p>
            </>
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
