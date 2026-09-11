import { Check, Clock, X } from 'lucide-react';
import { formatRelativeTime } from '@dawuro/core';
import { Panel } from '@/components/ui';
import type { HeldApplication } from '@/lib/applications';

/**
 * Where an application stands, once it is out of the applicant's hands.
 *
 * Three answers, and each one has to say what happens next, because "submitted"
 * with no follow-up is how somebody ends up refreshing a page for a week.
 *
 * A rejection carries its reason. That is the only part of a rejection with any
 * use in it — without it an applicant re-applies with the same problem, and
 * nobody involved learns anything.
 */
export function ApplicationOutcome({ application }: { application: HeldApplication }) {
  const submitted = formatRelativeTime(application.submittedAtIso ?? null);
  const decided = formatRelativeTime(application.decidedAtIso ?? null);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-7 py-8">
        <Panel className="p-8">
          {application.status === 'submitted' ? (
            <>
              <Badge tone="waiting" icon={<Clock className="h-5 w-5" strokeWidth={2} />} />
              <h2 className="mt-5 text-xl font-semibold">With the Dawuro team</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {submitted
                  ? `Sent ${submitted}. Nothing further is needed from you.`
                  : 'Nothing further is needed from you.'}{' '}
                We will be in touch at{' '}
                <span className="font-medium text-text-secondary">{application.email}</span> once it
                has been reviewed.
              </p>
            </>
          ) : null}

          {application.status === 'approved' ? (
            <>
              <Badge tone="good" icon={<Check className="h-5 w-5" strokeWidth={2.5} />} />
              <h2 className="mt-5 text-xl font-semibold">Approved</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {decided ? `Approved ${decided}. ` : ''}
                {application.organisationName} has been accepted. There is nothing further for you
                to do.
              </p>

              {/*
                Approval is the end of setup, not the first of two steps.

                This told an approved organisation their account still had to be
                "switched on", and described that as a separate step on our
                side. There is no such step: in this product approving a company
                completes it — they become visible in the app, receive the
                reports routed to them, and can release those reports to the
                public feed.

                The reason the console could show them nothing was a missing
                endpoint, and dressing that up as a workflow made a defect sound
                like a process — which is the surest way for it never to get
                fixed. What belongs here is what approval actually grants.
              */}
              <div className="mt-5 rounded-md border border-hairline/[0.08] bg-canvas-raise p-4">
                <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                  What you can do now
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {application.organisationName} is live. Sign in with{' '}
                  <span className="font-medium text-text-primary">{application.email}</span> and
                  reports matching the categories you chose arrive in your inbox, where you can
                  license them, assign them to your staff and release them to the public feed.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  Nothing further is needed from you, and there is nothing else to apply for.
                </p>
              </div>
            </>
          ) : null}

          {application.status === 'rejected' ? (
            <>
              <Badge tone="bad" icon={<X className="h-5 w-5" strokeWidth={2.5} />} />
              <h2 className="mt-5 text-xl font-semibold">Not accepted</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {decided ? `Reviewed ${decided}. ` : ''}
                {application.organisationName} was not accepted this time.
              </p>
              {application.decisionNote ? (
                <div className="mt-5 rounded-md border border-hairline/[0.08] bg-canvas-raise p-4">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                    Reason given
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {application.decisionNote}
                  </p>
                </div>
              ) : null}
              <p className="mt-4 text-sm leading-relaxed text-text-muted">
                Get in touch once that is resolved and we will reopen the application.
              </p>
            </>
          ) : null}

          <div className="mt-6 border-t border-hairline/[0.07] pt-5">
            <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
              What you sent
            </p>
            <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-text-faint">Organisation</dt>
              <dd className="text-text-secondary">{application.organisationName}</dd>
              <dt className="text-text-faint">Sector</dt>
              <dd className="text-text-secondary">{application.sector}</dd>
              <dt className="text-text-faint">Documents</dt>
              <dd className="text-text-secondary">
                {application.onboarding?.documents.length
                  ? `${application.onboarding.documents.length} attached`
                  : 'None attached'}
              </dd>
            </dl>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Badge({ tone, icon }: { tone: 'waiting' | 'good' | 'bad'; icon: React.ReactNode }) {
  const skin =
    tone === 'good'
      ? 'bg-success-wash text-success'
      : tone === 'bad'
        ? 'bg-danger-wash text-danger'
        : 'bg-canvas-raise text-text-muted';

  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-md ${skin}`}>{icon}</div>
  );
}
