'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Building2, Check, Clock, Search } from 'lucide-react';
import type { Branch, OrganisationAccount } from '@dawuro/core';
import { Button, Field, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

type Step = 'stance' | 'organisation' | 'details' | 'sent';

/**
 * Joining an organisation that already uses Dawuro.
 *
 * This is not the same as registering an organisation, and conflating the two
 * is the mistake worth avoiding: an employee cannot create an account that
 * grants itself access to citizens' footage. They ask, and someone already
 * inside the organisation decides.
 *
 * Picking the employer comes first because everything after it — which branch,
 * who reviews the request — depends on that choice.
 */
export function JoinForm({
  organisations,
  branchesByBusiness,
}: {
  organisations: OrganisationAccount[];
  branchesByBusiness: Record<string, Branch[]>;
}) {
  const [step, setStep] = useState<Step>('stance');
  const [independent, setIndependent] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [statedRole, setStatedRole] = useState('');
  const [branchId, setBranchId] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const organisation = organisations.find((b) => b.id === businessId) ?? null;
  const branches = businessId ? (branchesByBusiness[businessId] ?? []) : [];

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return organisations;
    return organisations.filter(
      (b) => b.name.toLowerCase().includes(q) || b.sector.toLowerCase().includes(q),
    );
  }, [query, organisations]);

  const detailsValid =
    displayName.trim().length > 1 && /.+@.+\..+/.test(email) && statedRole.trim().length > 1;

  const submit = async () => {
    setSubmitting(true);
    // Simulated. A real submission creates a pending MembershipRequest that
    // appears on the organisation's Team screen.
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    setStep('sent');
  };

  if (step === 'sent') {
    return (
      <Panel className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-success-wash">
          <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Request sent</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
          {organisation?.name} has been asked to confirm that you work there. Someone with admin
          access will accept or decline it.
        </p>
        <p className="mx-auto mt-4 flex max-w-md items-start gap-2 rounded-sm bg-canvas-raise px-3 py-2.5 text-left text-xs leading-relaxed text-text-muted">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
          You will not receive any reports until they accept. Nothing is visible to you before then
          — that is deliberate.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Back to sign in
        </Link>
      </Panel>
    );
  }

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
                setStep('organisation');
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
    <div className="space-y-5">
      {step === 'organisation' ? (
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Who do you work for?</h2>
          <p className="mt-1 text-xs text-text-muted">
            Pick the organisation that already uses Dawuro. They will confirm you work there.
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
                  onClick={() => {
                    setBusinessId(b.id);
                    setBranchId('');
                  }}
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

          <div className="mt-5 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep('stance')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button disabled={!businessId} onClick={() => setStep('details')}>
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Panel>
      ) : null}

      {step === 'details' ? (
        <Panel className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Your details</h2>
            <p className="mt-1 text-xs text-text-muted">
              Joining <span className="font-medium text-text-primary">{organisation?.name}</span>
            </p>
          </div>

          <Field
            label="Full name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Work email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              hint="An address on your organisation's domain is accepted faster."
              required
            />
            <Field
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 20 000 0000"
            />
          </div>

          <Field
            label="What do you do there?"
            value={statedRole}
            onChange={(e) => setStatedRole(e.target.value)}
            placeholder="Sanitation inspector, Ablekuma"
            hint="Your duties and permissions are set by your organisation after they accept."
            required
          />

          {branches.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="branch" className="text-xs font-medium text-text-secondary">
                Which branch?
              </label>
              <select
                id="branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-10 rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-base"
              >
                <option value="">Not sure yet</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.areaLabel}
                  </option>
                ))}
              </select>
              {/* The branch is not cosmetic: it decides which incidents can
                  ever reach this person, so it is worth saying so here. */}
              <p className="text-xs text-text-faint">
                Your branch decides which areas&rsquo; incidents can reach you.
              </p>
            </div>
          ) : null}

          <Field
            label="Anything else? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Started last month on the drainage team"
          />

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" onClick={() => setStep('organisation')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button disabled={!detailsValid} loading={submitting} onClick={() => void submit()}>
              Send request
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
