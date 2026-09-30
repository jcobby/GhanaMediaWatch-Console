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
 * **Two ways in, and both of them now work.**
 *
 * Redeem an invite the organisation issued — `POST /invites/{token}/accept` —
 * or ask them directly, which is `POST /membership-requests`. Either way the
 * organisation decides: an employee never grants themselves access to
 * citizens' footage.
 *
 * **The asking half was missing for a long time and the page said so.** Three
 * versions of this flow have now existed. The first faked a submit and said
 * "Request sent", so people waited on a decision no screen could show. The
 * second was honest but left the explanation until step three, after six
 * fields it then discarded — a worse apology than the lie it replaced. The
 * third removed the form and stated plainly that the service had no endpoint
 * for it, which was true when it was written.
 *
 * It stopped being true. `POST /membership-requests` shipped, documented as
 * the *"Signed-in outsider path for the console /join page"* — this page — and
 * nothing came back to use it, so an organisation's Team screen carried a
 * Requests tab listing requests no client could create. The form is back, with
 * the two optional fields a reviewer actually needs, and it marks itself sent
 * only once the service has accepted.
 */
export function JoinForm({ organisations }: { organisations: OrganisationAccount[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('stance');
  const [independent, setIndependent] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [invite, setInvite] = useState('');
  const [statedRole, setStatedRole] = useState('');
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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

  /**
   * Send the request, and say what happened either way.
   *
   * Marked sent only once the service has accepted it. An optimistic "asked"
   * here would be the third version of this page to tell somebody a request
   * exists when none does, which is the whole reason the previous two were
   * rewritten.
   */
  const ask = async () => {
    if (!businessId) return;
    setAsking(true);
    setFailure(null);
    try {
      const res = await fetch('/api/membership-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: businessId,
          ...(statedRole.trim() ? { statedRole: statedRole.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const answer = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFailure(
          answer?.error ??
            (res.status === 401
              ? 'Sign in first, so they know who is asking.'
              : `That could not be sent — the service answered ${res.status}.`),
        );
        return;
      }
      setSent(true);
    } catch {
      setFailure('The console could not reach its own server. Nothing was sent.');
    } finally {
      setAsking(false);
    }
  };

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
        <h2 className="text-sm font-semibold">Two ways in, and the organisation decides both</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
          Someone already inside can send you an invite link, or you can ask them below and they
          approve it from their Team screen. Either way an employee never grants themselves access
          to citizens&rsquo; footage — that is always an act by somebody already in the team.
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

        {/*
          Asking, which this page said was impossible.

          **`POST /membership-requests` exists and is documented for this very
          screen** — "Signed-in outsider path for the console /join page". The
          copy above was written when it did not, and stayed after it landed, so
          an organisation's Team screen has carried a Requests tab listing
          requests that no client could create.

          Only the organisation is required; the rest is optional on the wire
          and offered here because a reviewer needs it. The name on a personal
          account is frequently not the name a colleague recognises, and a
          request with neither a role nor a note is one an admin has to chase
          before they can act on it.
        */}
        {organisation ? (
          sent ? (
            <div className="mt-3 rounded-sm border border-success/30 bg-success-wash/30 p-3.5">
              <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Check className="h-4 w-4 text-success" strokeWidth={2.5} />
                Asked {organisation.name}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                It is in their Team screen now. Somebody with admin access there decides it — you
                will be in their team once they approve, and nothing reaches you before that.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5 rounded-sm border border-hairline/[0.10] p-3.5">
              <p className="text-xs leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">{organisation.name}</span> is on
                Dawuro. Ask them to add you, or paste an invite link above if you already have one.
              </p>
              <input
                type="text"
                value={statedRole}
                onChange={(e) => setStatedRole(e.target.value)}
                placeholder="What you do there — reporter, editor, desk officer"
                aria-label="Your role there"
                className="h-10 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-base placeholder:text-text-faint focus:border-accent"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Anything that helps them place you (optional)"
                aria-label="Note for the organisation"
                className="w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 py-2 text-base leading-relaxed placeholder:text-text-faint focus:border-accent"
              />
              <div className="flex items-center justify-between gap-3">
                <Button disabled={asking} onClick={() => void ask()}>
                  {asking ? 'Sending…' : 'Ask to join'} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                {failure ? (
                  <p role="alert" className="min-w-0 flex-1 text-xs leading-relaxed text-danger">
                    {failure}
                  </p>
                ) : null}
              </div>
            </div>
          )
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
