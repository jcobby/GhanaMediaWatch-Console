'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Check, Link2, Search } from 'lucide-react';
import type { OrganisationAccount } from '@dawuro/core';
import { Button, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

type Step = 'stance' | 'how';

/**
 * How somebody joins an organisation that already uses Dawuro.
 *
 * **Nothing here creates anything, and the page now says so first.**
 *
 * The service has no endpoint that raises a membership request: it can list them
 * and decide them, but nothing creates one. Joining happens by redeeming an
 * invite — `POST /invites/{token}/accept` — which the organisation issues from
 * its Team screen.
 *
 * Two versions of this flow were wrong before. The first faked a submit and said
 * "Request sent", so people waited on a decision no screen could ever show. The
 * second was honest but left the explanation until step three: it collected a
 * full name, work email, phone, stated role, branch and a free-text note, and
 * *then* said nothing had been sent. Six fields typed into a form that discards
 * them is a worse apology than the lie it replaced.
 *
 * So the truth is on the first screen that can carry it, the details step is
 * gone entirely, and the page has one action that actually works: redeem an
 * invite. The employer picker stays only to answer "who do I ask".
 */
export function JoinForm({ organisations }: { organisations: OrganisationAccount[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('stance');
  const [independent, setIndependent] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [invite, setInvite] = useState('');

  const organisation = organisations.find((b) => b.id === businessId) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return organisations;
    return organisations.filter(
      (b) => b.name.toLowerCase().includes(q) || b.sector.toLowerCase().includes(q),
    );
  }, [query, organisations]);

  /*
   * A pasted link or a bare token, both accepted.
   *
   * People paste the whole URL out of an email far more often than they pick the
   * token out of it, and refusing that would be the form failing at the one
   * thing it can actually do.
   */
  const token = useMemo(() => {
    const raw = invite.trim();
    if (!raw) return null;
    const fromUrl = /\/invite\/([^/?#\s]+)/.exec(raw);
    const value = fromUrl?.[1] ?? raw;
    return /^[A-Za-z0-9._~-]{6,}$/.test(value) ? value : null;
  }, [invite]);

  if (step === 'stance') {
    return (
      <div className="space-y-3">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Who do you film for?</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Everyone answers this. Being independent is a normal answer and most reporters give it —
            stating it explicitly is what stops an unanswered question being read as an unverified
            claim to work somewhere.
          </p>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                setIndependent(false);
                setStep('how');
              }}
              className="w-full rounded-sm border border-hairline/[0.10] p-3.5 text-left transition hover:border-accent/30 hover:bg-canvas-raise/40"
            >
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-text-muted" />
                <span className="text-sm font-medium">I work for an institution</span>
              </span>
              <span className="mt-1 block text-2xs leading-relaxed text-text-muted">
                They confirm it before anything reaches you, and your reports can be attributed to
                them.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIndependent(true)}
              aria-pressed={independent === true}
              className={cn(
                'w-full rounded-sm border p-3.5 text-left transition',
                independent === true
                  ? 'border-accent bg-accent-wash/40'
                  : 'border-hairline/[0.10] hover:border-accent/30 hover:bg-canvas-raise/40',
              )}
            >
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-text-muted" />
                <span className="text-sm font-medium">I am independent</span>
              </span>
              <span className="mt-1 block text-2xs leading-relaxed text-text-muted">
                You film for yourself, earn commission personally, and may report anonymously.
              </span>
            </button>
          </div>
        </Panel>

        {independent === true ? (
          <Panel className="p-5 text-center">
            <p className="text-sm">Independent reporters use the phone app.</p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-text-muted">
              Capture needs a camera and an accurate GPS fix, so there is nothing for you to sign
              into here. Install Dawuro on your phone and register there.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
            >
              Back to sign in
            </Link>
          </Panel>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/*
        The whole truth, before anything is typed.

        This used to be the third screen, reached after six fields that were then
        thrown away. It is the first thing now because it is the only thing that
        decides what somebody should do next.
      */}
      <Panel className="p-5">
        <h2 className="text-sm font-semibold">Joining starts with an invite</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
          There is no application to fill in here, and that is deliberate — an employee cannot
          create an account that grants itself access to citizens&rsquo; footage. Someone already
          inside the organisation creates an invite link from their Team screen and sends it to
          you. Opening it puts you in their team, with the role they chose.
        </p>
        <p className="mt-3 flex items-start gap-2 rounded-sm bg-canvas-raise px-3 py-2.5 text-xs leading-relaxed text-text-muted">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
          Nothing reaches you until you are in their team, and what you can see is decided by the
          role they give you.
        </p>
      </Panel>

      {/* The one action on this page that does something. */}
      <Panel className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-accent" />
          I already have an invite link
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          Paste the link you were sent, or just the code at the end of it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="https://…/invite/abc123"
            aria-label="Invite link"
            className="h-10 min-w-0 flex-1 rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-base placeholder:text-text-faint focus:border-accent"
          />
          <Button disabled={!token} onClick={() => token && router.push(`/invite/${token}`)}>
            Open invite <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {invite.trim() && !token ? (
          <p role="alert" className="mt-2 text-xs text-danger">
            That does not look like an invite link. It ends in a code of at least six characters.
          </p>
        ) : null}
      </Panel>

      {/* Who to ask — a directory, not the first step of an application. */}
      <Panel className="p-5">
        <h2 className="text-sm font-semibold">Who should I ask?</h2>
        <p className="mt-1 text-xs text-text-muted">
          Find your employer to see whether they are on Dawuro yet. Anyone with admin access there
          can send you a link.
        </p>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organisations"
            aria-label="Search organisations"
            className="h-10 w-full rounded-sm border border-hairline/15 bg-canvas-soft pl-9 pr-3 text-base placeholder:text-text-faint focus:border-accent"
          />
        </div>

        <div className="mt-3 space-y-1.5">
          {matches.length === 0 ? (
            <p className="rounded-sm bg-canvas-raise px-3 py-3 text-xs text-text-muted">
              No organisation matches that. If yours does not use Dawuro yet, they need to{' '}
              <Link href="/register" className="font-medium text-accent hover:underline">
                apply for an account
              </Link>{' '}
              first.
            </p>
          ) : (
            matches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBusinessId(businessId === b.id ? null : b.id)}
                aria-pressed={businessId === b.id}
                className={cn(
                  'flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition',
                  businessId === b.id
                    ? 'border-accent bg-accent-wash/45'
                    : 'border-hairline/[0.10] hover:border-accent/30 hover:bg-canvas-raise/40',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xs bg-canvas-raise">
                  <Building2 className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{b.name}</span>
                  <span className="block truncate text-xs capitalize text-text-faint">
                    {b.sector}
                  </span>
                </span>
                {businessId === b.id ? (
                  <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                ) : null}
              </button>
            ))
          )}
        </div>

        {organisation ? (
          <p className="mt-3 rounded-sm bg-accent-wash/40 px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
            <span className="font-semibold text-text-primary">{organisation.name}</span> is on
            Dawuro. Ask whoever manages their account to send you an invite link from their Team
            screen.
          </p>
        ) : null}
      </Panel>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep('stance')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Link href="/login" className="text-sm font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
