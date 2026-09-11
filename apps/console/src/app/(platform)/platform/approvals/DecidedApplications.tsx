import { Building2, Check, ClipboardList, X } from 'lucide-react';
import { formatRelativeTime } from '@dawuro/core';
import { Panel } from '@/components/ui';
import { FinishSetup } from './FinishSetup';
import type { HeldApplication } from '@/lib/applications';

/**
 * What happened to the applications already answered.
 *
 * A decision that vanishes is its own bug. Approving an organisation took it
 * out of the queue and put it nowhere — the operator was left asking "I
 * approved one, where is it?", unable to confirm the decision had registered,
 * unable to see what they had chosen, and with no sight of the fact that
 * approving does not by itself create the organisation.
 *
 * That last point is why this leads with what is outstanding rather than with a
 * tick, and it is now a much smaller list. `POST /platform/organisations`
 * exists, so approving creates the organisation — an approved row is finished
 * work, and a green tick finally means what it says.
 *
 * What is left is the backlog: everything approved while that endpoint did not
 * exist. Those newsrooms were told yes and have never had an organisation, so
 * they sign in to a working account and find an outage. They are called out
 * separately, with the button that finishes the job, because the number of them
 * is the number of customers currently stuck.
 */
export function DecidedApplications({ applications }: { applications: HeldApplication[] }) {
  if (applications.length === 0) return null;

  // Approved, and the organisation was never created. Approving now does this
  // in the same breath, so anything in here predates that endpoint.
  const stranded = applications.filter((a) => a.status === 'approved' && !a.organisationId);

  return (
    <Panel className="p-5">
      <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
        Already decided
      </p>

      {stranded.length > 0 ? (
        <p className="mt-2 flex items-start gap-2 rounded-sm bg-warning-wash/40 px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
          <ClipboardList className="mt-px h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={2} />
          <span>
            {stranded.length === 1
              ? 'One organisation was approved before the platform could create it.'
              : `${stranded.length} organisations were approved before the platform could create them.`}{' '}
            They were told yes and have no organisation behind their account, so signing in shows
            them an outage and nothing routes to them. Finish setup on each and they are live.
          </span>
        </p>
      ) : null}

      <ul className="mt-4 space-y-2.5">
        {applications.map((application) => {
          const decided = formatRelativeTime(application.decidedAtIso ?? null);
          const isApproved = application.status === 'approved';

          return (
            <li key={application.id}>
              <div className="rounded-md border border-hairline/[0.08] bg-canvas-raise p-3.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    className={
                      isApproved
                        ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-success-wash text-success'
                        : 'flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-danger-wash text-danger'
                    }
                  >
                    {isApproved ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : (
                      <X className="h-3 w-3" strokeWidth={3} />
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                    <Building2 className="h-3.5 w-3.5 text-text-faint" strokeWidth={2} />
                    {application.organisationName}
                  </span>
                  <span className="text-2xs text-text-faint">
                    {isApproved ? 'Approved' : 'Rejected'}
                    {/*
                      `formatRelativeTime` returns null for a date it cannot
                      read, and interpolating that prints the word "null" —
                      which is how "Oldest null" reached the platform console.
                    */}
                    {decided ? ` ${decided}` : ''}
                    {application.decidedByEmail ? ` by ${application.decidedByEmail}` : ''}
                  </span>
                </div>

                {/*
                  The details of the decision, on the row. An operator should
                  not have to go looking for what they just approved — and on a
                  stranded row these are the fields the organisation is created
                  from, so they are worth checking before pressing.
                */}
                {isApproved ? (
                  <dl className="mt-2.5 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1 text-2xs">
                    <dt className="text-text-faint">Contact</dt>
                    <dd className="text-text-muted">
                      {application.contactName} &middot; {application.email} &middot;{' '}
                      {application.phone}
                    </dd>
                    <dt className="text-text-faint">Sector</dt>
                    <dd className="text-text-muted">{application.sector}</dd>
                    <dt className="text-text-faint">Reports wanted</dt>
                    <dd className="text-text-muted">
                      {application.interests.length > 0
                        ? application.interests.join(', ')
                        : 'None chosen — nothing would route to them.'}
                    </dd>
                  </dl>
                ) : null}

                {/*
                  Only where it is missing. A button offering to create
                  something that already exists is an invitation to create a
                  second one, and two organisations for one newsroom would split
                  its reports, licences and payouts with no way to merge them.
                */}
                {isApproved && !application.organisationId ? (
                  <FinishSetup
                    applicationId={application.id}
                    organisationName={application.organisationName}
                  />
                ) : null}

                {application.organisationId ? (
                  <p className="mt-2 font-mono text-2xs text-text-faint">
                    {application.organisationId}
                  </p>
                ) : null}

                {application.decisionNote ? (
                  <p className="mt-2 text-2xs leading-relaxed text-text-muted">
                    <span className="text-text-faint">Reason given:</span>{' '}
                    {application.decisionNote}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
