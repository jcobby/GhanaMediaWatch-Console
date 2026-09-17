'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button, Field, Panel } from '@/components/ui';

/**
 * Accepting an invite, for real.
 *
 * **This used to be a timer.** It collected a name, an email, a phone number and
 * a job title, waited 700ms, and said "Request sent" — nothing was created, so
 * the person waited to be admitted to something nobody had been told about, and
 * the organisation never saw a request to accept.
 *
 * What it asks for now is what the service actually takes: a name, and the
 * credentials they will sign in with. The phone number and job title are gone —
 * the invitation already carries the organisation and the role its author chose,
 * and asking for things nobody reads is how a two-minute task gets abandoned.
 */
export function InviteAcceptForm({
  token,
  organisationName,
}: {
  token: string;
  organisationName: string;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const valid =
    displayName.trim().length > 1 && /.+@.+\..+/.test(email) && password.length >= 10;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFailure(null);
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim(), email: email.trim(), password }),
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
        return;
      }
      setDone(true);
    } catch {
      setFailure('The console could not reach its own server. Nothing was sent.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Panel className="p-7 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-success-wash">
          <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold">You have joined {organisationName}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">
          Sign in with the email and password you just set. What you can see is decided by the role
          they gave you — an admin can change it.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
        >
          Sign in
        </Link>
      </Panel>
    );
  }

  return (
    <Panel className="p-5">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="Full name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="You will sign in with this."
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 10 characters."
          required
        />

        {/* The service's own words: an expired link and an email that already
            has an account need different things from the person reading it. */}
        {failure ? (
          <p role="alert" className="text-xs leading-relaxed text-danger">
            {failure}
          </p>
        ) : null}

        <Button type="submit" size="lg" fullWidth disabled={!valid} loading={submitting}>
          Join {organisationName}
        </Button>
      </form>
    </Panel>
  );
}
