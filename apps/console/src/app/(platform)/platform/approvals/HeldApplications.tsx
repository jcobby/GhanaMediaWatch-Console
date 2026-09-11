'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, FileText, Mail, Phone, ShieldAlert, X } from 'lucide-react';
import { DOCUMENT_REQUIREMENTS, formatRelativeTime, type DocumentId } from '@dawuro/core';
import { Button, Panel } from '@/components/ui';
import type { HeldApplication } from '@/lib/applications';

/**
 * Deciding on an organisation that applied through this console.
 *
 * The end of the flow: an organisation registers, fills in the onboarding
 * forms, submits them, and this is where the Dawuro owner answers. Only
 * submitted applications reach here — a draft is somebody still typing, and
 * reviewing one means rejecting them for not having attached a document yet.
 *
 * Approval is not a formality. What it grants is access to footage filed by
 * members of the public: real people, at real addresses, sometimes filmed by
 * reporters who stayed anonymous because being identified would put them at
 * risk. So the evidence is on the page above the buttons rather than below
 * them, and a rejection cannot be sent without a reason — an applicant told
 * only "declined" applies again with the same problem.
 *
 * **What a decision here does.** It is recorded against the application,
 * durably. It does not create the organisation on the platform, because no
 * endpoint does. That is stated on the screen rather than left for an operator
 * to discover when the organisation never appears.
 */
export function HeldApplications({ applications }: { applications: HeldApplication[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (applications.length === 0) return null;

  const decide = async (
    application: HeldApplication,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => {
    setBusy(application.id);
    setFailure(null);
    try {
      const res = await fetch(`/api/platform/applications/${encodeURIComponent(application.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision === 'rejected' ? { decision, note } : { decision }),
      });
      const answer = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFailure(answer.error ?? 'That decision could not be recorded.');
        return;
      }
      setRejecting(null);
      setReason('');
      // Re-read from the server rather than removing the row locally. A row
      // that vanishes on a decision the server never took is the failure this
      // whole screen exists to avoid.
      router.refresh();
    } catch {
      setFailure('The console could not reach its own server. Check that it is still running.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {failure ? (
        <p className="rounded-md border border-danger/25 bg-danger-wash px-4 py-2.5 text-sm text-danger">
          {failure}
        </p>
      ) : null}

      {applications.map((application) => {
        const documents = application.onboarding?.documents ?? [];
        const working = busy === application.id;

        return (
          <Panel key={application.id} className="p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                <Building2 className="h-3.5 w-3.5 text-text-faint" strokeWidth={2} />
                {application.organisationName}
              </span>
              <span className="text-2xs uppercase tracking-wide text-text-faint">
                {application.sector}
              </span>
              {/*
                `formatRelativeTime` returns null for a date it cannot read, and
                interpolating that renders the word "null" on screen — which is
                how "Oldest null" reached the platform console. Checked before
                it is used, here and everywhere.
              */}
              {formatRelativeTime(application.submittedAtIso ?? null) ? (
                <span className="ml-auto text-2xs text-text-faint">
                  Submitted {formatRelativeTime(application.submittedAtIso ?? null)}
                </span>
              ) : null}
            </div>

            <dl className="mt-4 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-text-faint">Contact</dt>
              <dd className="text-text-secondary">{application.contactName}</dd>

              <dt className="flex items-center gap-1.5 text-text-faint">
                <Mail className="h-3 w-3" strokeWidth={2} />
                Email
              </dt>
              <dd className="text-text-secondary">{application.email}</dd>

              <dt className="flex items-center gap-1.5 text-text-faint">
                <Phone className="h-3 w-3" strokeWidth={2} />
                Phone
              </dt>
              <dd className="text-text-secondary">{application.phone}</dd>

              {application.onboarding ? (
                <>
                  <dt className="text-text-faint">Legal name</dt>
                  <dd className="text-text-secondary">
                    {application.onboarding.organisation.legalName || '—'}
                  </dd>
                  <dt className="text-text-faint">Registration no.</dt>
                  <dd className="text-text-secondary">
                    {application.onboarding.organisation.registrationNumber || '—'}
                  </dd>
                  <dt className="text-text-faint">Tax ID</dt>
                  <dd className="text-text-secondary">
                    {application.onboarding.organisation.tin || '—'}
                  </dd>
                  <dt className="text-text-faint">Authorised officer</dt>
                  <dd className="text-text-secondary">
                    {[application.onboarding.officer.name, application.onboarding.officer.role]
                      .filter(Boolean)
                      .join(' — ') || '—'}
                  </dd>
                  <dt className="text-text-faint">Coverage</dt>
                  <dd className="text-text-secondary">
                    {[application.onboarding.coverage.address, application.onboarding.coverage.city]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </dd>
                </>
              ) : null}

              {/*
                What decides whether this organisation ever receives anything.
                Routing matches a report's category against these.
              */}
              <dt className="text-text-faint">Reports wanted</dt>
              <dd className="text-text-secondary">
                {application.interests.length > 0
                  ? application.interests.join(', ')
                  : 'None chosen — this organisation would receive nothing until set.'}
              </dd>
            </dl>

            {/*
              The evidence, opened rather than described.

              A reviewer approving on the strength of a filename is approving a
              filename. Each of these is a real file the applicant uploaded, and
              the link fetches it through a handler that checks the caller is a
              platform owner before reading it off disk.
            */}
            <div className="mt-4">
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                Documents
              </p>
              {documents.length === 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  Nothing attached. There is no evidence to check.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {documents.map((document) => (
                    <li key={document.id}>
                      <a
                        href={`/api/platform/applications/${encodeURIComponent(
                          application.id,
                        )}/documents/${encodeURIComponent(document.id)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-sm border border-hairline/[0.1] bg-canvas-raise px-2.5 py-1.5 text-xs text-text-secondary transition hover:border-accent/30 hover:text-accent"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                        {DOCUMENT_REQUIREMENTS[document.id as DocumentId]?.label ?? document.id}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {rejecting === application.id ? (
              <div className="mt-4 rounded-md border border-hairline/[0.08] bg-canvas-raise p-3">
                <label
                  htmlFor={`reason-${application.id}`}
                  className="text-2xs font-semibold uppercase tracking-wider text-text-faint"
                >
                  Why is this being rejected?
                </label>
                <p className="mt-1 text-xs text-text-muted">
                  Sent to the applicant. Without it they apply again with the same problem.
                </p>
                <textarea
                  id={`reason-${application.id}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-sm border border-hairline/[0.12] bg-canvas px-3 py-2 text-sm outline-none focus:border-accent/40"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="danger"
                    disabled={working || reason.trim().length === 0}
                    onClick={() => void decide(application, 'rejected', reason.trim())}
                  >
                    {working ? 'Sending…' : 'Send rejection'}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={working}
                    onClick={() => {
                      setRejecting(null);
                      setReason('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline/[0.07] pt-4">
                <Button disabled={working} onClick={() => void decide(application, 'approved')}>
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {working ? 'Setting up…' : 'Approve'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={working}
                  onClick={() => setRejecting(application.id)}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Reject
                </Button>
                {/*
                  Said where the decision is made, not in a footnote.

                  This used to warn that approving did *not* create the
                  organisation, because nothing in the API could. It does now —
                  `POST /platform/organisations` — so approving creates it and
                  adds the applicant as its owner in the same action, and the
                  old warning would send an operator off to do by hand a job
                  that is already done. Doing it twice is how one newsroom ends
                  up with two organisations.

                  It takes a moment longer than it used to for the same reason,
                  which is why the button says "Setting up" rather than
                  "Recording" — an operator watching a spinner should know the
                  work is real and not that a video is being recorded.
                */}
                <p className="ml-auto max-w-sm text-right text-2xs leading-relaxed text-text-faint">
                  Approving creates the organisation and makes {application.accountEmail} its owner.
                  That is the end of their setup.
                </p>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
