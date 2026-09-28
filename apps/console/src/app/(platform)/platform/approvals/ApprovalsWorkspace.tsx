'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Check,
  FileText,
  Mail,
  Phone,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import {
  formatCedis,
  formatRelativeTime,
  isUnlimited,
  planFor,
  type OrganisationApplication,
} from '@dawuro/core';
import { Badge, Button, Panel, useToast } from '@/components/ui';
import { ApplicationReview } from '@/components/ApplicationReview';
import type { ReviewableApplication } from '@/lib/onboarding';
import { cn } from '@/lib/cn';

/**
 * What each flag means, in the operator's terms.
 *
 * Written as observations rather than verdicts. None of these disqualify an
 * applicant on their own — a small NGO legitimately uses a free mail domain —
 * and phrasing them as accusations would push operators toward rejecting
 * organisations that are simply small.
 */
const FLAG_COPY: Record<string, { title: string; detail: string }> = {
  free_email_domain: {
    title: 'Contact uses a free email address',
    detail: 'Not a work domain. Common for small bodies, and also how impersonation starts.',
  },
  registration_unverified: {
    title: 'Registration number could not be matched',
    detail: 'It does not resolve against the public register. May be a typo, may not exist.',
  },
  duplicate_registration: {
    title: 'Registration number already in use',
    detail: 'Another approved organisation is using this number.',
  },
  sanctioned_entity: {
    title: 'Name appears on a watch list',
    detail: 'Escalate before deciding. Do not approve on your own.',
  },
};

/**
 * Approving organisations onto the platform.
 *
 * This is the only place where access to citizens' footage is granted, and
 * approval is not a formality. An approved organisation can license reports
 * filed by members of the public — footage of real people, taken at real
 * addresses, sometimes by reporters who chose to stay anonymous because being
 * identified would put them at risk.
 *
 * So the screen is built to slow the decision down where it should be slow.
 * What approval actually grants is stated on the page rather than assumed
 * known. Flags are surfaced before the buttons, not below them. And rejection
 * asks for a reason, because an applicant who is told nothing simply applies
 * again with the same problem.
 */
/**
 * Two lists, both from the server.
 *
 * `applications` are new requests awaiting a yes or no; `inOnboarding` are the
 * organisations already partway through, reviewed step by step. The second used
 * to be a seeded constant read directly here, so an operator worked through
 * onboarding steps for organisations that did not exist while the real ones
 * were invisible.
 */
export function ApprovalsWorkspace({
  applications,
  inOnboarding,
}: {
  applications: OrganisationApplication[];
  inOnboarding: ReviewableApplication[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [decided, setDecided] = useState<Record<string, 'approved' | 'rejected'>>({});
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Send the decision, then move the row.
   *
   * This used to be `setDecided` alone: the row left the list, the platform was
   * told nothing, and a reload brought the application back. An operator could
   * believe they had approved a newsroom that had never left the browser.
   *
   * Both answers reach the service now. Declining had no endpoint until 16
   * September, so this button used to come back with a 501 explaining that the
   * offending step had to be sent back instead; the reason now travels with the
   * rejection and the applicant is shown it.
   */
  const decide = async (id: string, outcome: 'approved' | 'rejected', note?: string) => {
    setFailure(null);
    try {
      const res = await fetch(`/api/platform/applications/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          outcome === 'rejected' ? { decision: outcome, note } : { decision: outcome },
        ),
      });
      const answer = (await res.json()) as { error?: string };
      if (!res.ok) {
        const why = answer.error ?? 'That decision could not be sent.';
        setFailure(why);
        toast.error('Nothing was recorded', why);
        return;
      }
      setDecided((prev) => ({ ...prev, [id]: outcome }));
      /*
       * Say so, because the only other evidence is a card that vanishes.
       *
       * An approved application leaves this list the moment the decision lands,
       * so a reviewer who was not watching that exact row sees a page that is
       * one card shorter and has to guess whether the click worked or whether
       * the list simply refreshed under them.
       */
      const name = applications.find((a) => a.id === id)?.organisationName ?? 'The organisation';
      if (outcome === 'approved') {
        toast.success(`${name} approved`, 'They can sign in and license reports.');
      } else {
        toast.success(`${name} declined`, 'They have been told why, and can apply again.');
      }
      router.refresh();
    } catch {
      const why = 'The console could not reach its own server. Check that it is still running.';
      setFailure(why);
      toast.error('Nothing was recorded', why);
    }
  };
  const pending = applications.filter((a) => !(a.id in decided));

  // Both lists, or applications in onboarding were hidden behind "Nothing waiting".
  if (pending.length === 0 && inOnboarding.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-7 py-6">
          <Panel className="p-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-success-wash">
              <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
            </div>
            <p className="mt-4 text-sm font-medium">Nothing waiting</p>
            <p className="mt-1 text-xs text-text-muted">
              New organisations appear here when they register.
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-3 px-7 py-6">
        {/* The server's own answer, rather than a row that quietly stays put. */}
        {failure ? (
          <p className="rounded-md border border-danger/25 bg-danger-wash px-4 py-2.5 text-sm text-danger">
            {failure}
          </p>
        ) : null}

        <Panel className="flex items-start gap-3 border-info/20 bg-info-wash/30 p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={2} />
          <p className="text-xs leading-relaxed text-text-secondary">
            Approving an organisation lets it license footage filed by the public — including
            reports from people who stayed anonymous. Check the registration before you approve.
          </p>
        </Panel>

        {/* Organisations already in onboarding. Reviewed step by step rather
            than accepted or declined as one blob. */}
        {inOnboarding.map((app) => (
          <Panel key={app.id || app.reference} className="p-5">
            <ApplicationReview application={app} />
          </Panel>
        ))}

        {pending.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            onDecide={(outcome, note) => void decide(application.id, outcome, note)}
          />
        ))}
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  onDecide,
}: {
  application: OrganisationApplication;
  /**
   * The reason travels with a rejection.
   *
   * It was typed into a field on this card and never passed anywhere — the
   * applicant would have been declined with the reviewer's explanation left
   * behind in a React state variable.
   */
  onDecide: (outcome: 'approved' | 'rejected', note?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const plan = planFor(application.requestedTier);
  const flagged = application.flags.length > 0;

  return (
    <Panel className={cn('p-5', flagged && 'border-warning/30')}>
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-sm',
            flagged ? 'bg-warning-wash' : 'bg-canvas-raise',
          )}
        >
          <Building2
            className={cn('h-4.5 w-4.5', flagged ? 'text-warning' : 'text-text-muted')}
            strokeWidth={1.8}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.01em]">
              {application.organisationName}
            </h2>
            <Badge tone="neutral">{application.sector}</Badge>
            {flagged ? <Badge tone="warning">{application.flags.length} to check</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-text-faint">
            Applied {formatRelativeTime(application.submittedAtIso) ?? 'recently'}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-2xs uppercase tracking-wider text-text-faint">Requested</p>
          <p className="mt-px text-sm font-semibold capitalize">{application.requestedTier}</p>
          {/* An application naming a tier this console does not price shows the
              tier and no figure. A reviewer deciding on a subscription must not
              be shown a fee belonging to a different one. */}
          {plan ? (
            <p className="tabular text-2xs text-text-muted">
              {formatCedis(plan.feePesewas)}/{plan.billingPeriod === 'annual' ? 'yr' : 'mo'}
            </p>
          ) : (
            <p className="text-2xs text-text-faint">Unrecognised tier</p>
          )}
        </div>
      </div>

      {/* Flags before the buttons. An operator who scrolls past a warning to
          reach Approve has been designed into a mistake. */}
      {flagged ? (
        <ul className="mt-4 space-y-2 rounded-md border border-warning/25 bg-warning-wash/35 p-3.5">
          {application.flags.map((flag) => {
            const copy = FLAG_COPY[flag];
            return (
              <li key={flag} className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning"
                  strokeWidth={2.2}
                />
                <div className="text-xs leading-relaxed">
                  <p className="font-medium text-text-primary">{copy?.title ?? flag}</p>
                  {copy?.detail ? <p className="text-text-muted">{copy.detail}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Fact icon={<User className="h-3.5 w-3.5" />} label="Contact">
          {application.contactName}
        </Fact>
        <Fact icon={<Mail className="h-3.5 w-3.5" />} label="Email">
          {application.email}
        </Fact>
        <Fact icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
          {application.phone}
        </Fact>
        <Fact
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Registration"
          tone={application.flags.includes('registration_unverified') ? 'warning' : undefined}
        >
          {application.registrationNumber}
        </Fact>
      </dl>

      <div className="mt-4">
        <p className="text-2xs uppercase tracking-wider text-text-faint">
          Footage they would receive
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {application.interests.map((c) => (
            <span
              key={c}
              className="rounded-pill bg-canvas-raise px-2.5 py-1 text-2xs capitalize text-text-secondary"
            >
              {c}
            </span>
          ))}
        </div>
        {plan ? (
          <p className="mt-2 text-2xs leading-relaxed text-text-muted">
            {isUnlimited(plan)
              ? 'Unlimited downloads on an annual plan.'
              : `${formatCedis(plan.perDownloadPesewas ?? 0)} per download, ${plan.seats} seats.`}
          </p>
        ) : null}
      </div>

      {rejecting ? (
        <div className="mt-5 border-t border-hairline/[0.07] pt-4">
          <label htmlFor={`reason-${application.id}`} className="text-xs font-medium">
            Why are you declining?
          </label>
          <p className="mt-0.5 text-2xs text-text-muted">
            Sent to the applicant. Without it they reapply with the same problem.
          </p>
          <input
            id={`reason-${application.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Registration number does not match the public register"
            className="mt-2 h-9 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-sm"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={reason.trim().length < 4}
              onClick={() => onDecide('rejected', reason.trim())}
            >
              Decline application
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-hairline/[0.07] pt-4">
          <Button variant="ghost" size="sm" onClick={() => setRejecting(true)}>
            <X className="h-3.5 w-3.5" /> Decline
          </Button>
          <Button size="sm" onClick={() => onDecide('approved')}>
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Fact({
  icon,
  label,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'warning';
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-text-faint">{icon}</span>
      <div className="min-w-0">
        <dt className="text-2xs uppercase tracking-wider text-text-faint">{label}</dt>
        <dd
          className={cn(
            'mt-px truncate text-xs font-medium',
            tone === 'warning' ? 'text-warning' : 'text-text-primary',
          )}
        >
          {children}
        </dd>
      </div>
    </div>
  );
}
