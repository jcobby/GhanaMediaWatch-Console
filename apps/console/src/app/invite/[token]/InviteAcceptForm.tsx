'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { InviteKind } from '@dawuro/core';
import { Button, Field, Panel } from '@/components/ui';

/**
 * Accepting an invite.
 *
 * Deliberately short. The organisation is already known from the link, the
 * branch and role are already preset, and asking again for things the inviter
 * has answered is how a two-minute task becomes abandoned. Name, contact, and
 * what they do — that is all the reviewer needs to recognise them.
 */
export function InviteAcceptForm({
  organisationName,
  kind,
}: {
  organisationName: string;
  kind: InviteKind;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [statedRole, setStatedRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const valid = displayName.trim().length > 1 && /.+@.+\..+/.test(email);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    // Simulated. A real acceptance increments the invite's use count and
    // creates a pending membership request against the organisation.
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    setSent(true);
  };

  if (sent) {
    return (
      <Panel className="p-7 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-success-wash">
          <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Request sent</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">
          {organisationName} will confirm it. You will not receive any reports until they do.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block text-sm font-medium text-accent hover:underline"
        >
          Back to sign in
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          label={kind === 'agent' ? 'What do you do for them?' : 'What is your role?'}
          value={statedRole}
          onChange={(e) => setStatedRole(e.target.value)}
          placeholder={kind === 'agent' ? 'Loss assessor' : 'Sanitation inspector'}
          hint="Shown to whoever reviews your request."
        />

        <Button type="submit" size="lg" fullWidth disabled={!valid} loading={submitting}>
          Accept invitation
        </Button>
      </form>
    </Panel>
  );
}
