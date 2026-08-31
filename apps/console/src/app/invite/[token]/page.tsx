import Link from 'next/link';
import { AlertCircle, Building2, Clock, ShieldCheck } from 'lucide-react';
import { BUSINESSES, INVITES, inviteProblem, remainingUses } from '@dawuro/core';
import { Panel } from '@/components/ui';
import { GoogleButton } from '@/components/GoogleButton';
import { InviteAcceptForm } from './InviteAcceptForm';

const KIND_COPY = {
  employee: 'join their team',
  agent: 'act on their behalf',
  affiliate_org: 'link your organisation to theirs',
} as const;

const PROBLEM_COPY = {
  revoked: 'This link was withdrawn by the organisation.',
  expired: 'This link has expired.',
  exhausted: 'This link has already been used the maximum number of times.',
} as const;

/**
 * Redeeming an invite link.
 *
 * A dead link gets a plain explanation and a route onward, never a blank page
 * or a login redirect. Someone arriving here was sent by a colleague and has no
 * idea what Dawuro is; telling them "unauthorised" would be useless.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = INVITES.find((i) => i.token === token) ?? null;
  const business = invite ? BUSINESSES.find((b) => b.id === invite.businessId) : null;
  const problem = invite ? inviteProblem(invite, new Date().toISOString()) : null;

  if (!invite || !business) {
    return (
      <Dead
        title="This link is not valid"
        body="Check that you copied the whole address, or ask whoever sent it for a new one."
      />
    );
  }

  if (problem) {
    return <Dead title="This link no longer works" body={PROBLEM_COPY[problem]} />;
  }

  const left = remainingUses(invite);

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-12">
      <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-accent">
        Dawuro Platform
      </p>

      <Panel className="mt-5 p-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-wash">
            <Building2 className="h-5 w-5 text-accent" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-[-0.01em]">{business.name}</h1>
            <p className="mt-1 text-sm text-text-muted">
              has invited you to {KIND_COPY[invite.kind]}.
            </p>
            {invite.note ? (
              <p className="mt-2 rounded-sm bg-canvas-raise px-3 py-2 text-xs italic text-text-secondary">
                &ldquo;{invite.note}&rdquo;
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline/[0.07] pt-3.5 text-2xs text-text-faint">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Link expires soon
          </span>
          {left !== null ? <span>{left} uses left</span> : <span>Unlimited uses</span>}
        </p>
      </Panel>

      <div className="mt-5">
        <GoogleButton label="Continue with Google" />
        <div className="mt-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline/10" />
          <span className="text-2xs uppercase tracking-wider text-text-faint">or</span>
          <span className="h-px flex-1 bg-hairline/10" />
        </div>
      </div>

      <div className="mt-5">
        <InviteAcceptForm organisationName={business.name} kind={invite.kind} />
      </div>

      <Panel className="mt-5 flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={2} />
        <p className="text-xs leading-relaxed text-text-muted">
          {/* Said plainly, because a link that looked like instant access and
              then granted nothing would read as broken. */}
          Accepting sends a request. {business.name} confirms it before anything reaches you, and
          you start with the lowest permissions until they set otherwise.
        </p>
      </Panel>
    </main>
  );
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Panel className="p-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-warning-wash">
          <AlertCircle className="h-5 w-5 text-warning" strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{body}</p>
        <Link
          href="/join"
          className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
        >
          Ask to join an organisation instead
        </Link>
      </Panel>
    </main>
  );
}
