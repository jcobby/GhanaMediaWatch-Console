import Link from 'next/link';
import type { OrganisationAccount } from '@dawuro/core';
import { publicApi } from '@/lib/consoleApi';
import { Outage, load } from '@/components/ui';
import { GoogleButton } from '@/components/GoogleButton';
import { JoinForm } from './JoinForm';

/**
 * Public route for staff joining an organisation that already uses Dawuro.
 *
 * Separate from /register, which is for an organisation signing itself up.
 */
export default async function JoinPage() {
  /*
   * The public directory of organisations already on Dawuro.
   *
   * Read from `/organisations`, which is the only list a person who has not
   * signed in is entitled to see. It used to offer the seeded set, so somebody
   * joining picked their employer from a list of organisations that had never
   * registered — and the request went nowhere.
   *
   * Branches are not public: which depots an institution runs is its own
   * organisation, and the API exposes them only to its members. The picker offers
   * organisations, and the employer assigns the branch when it confirms the
   * person works there — which is where that decision belonged anyway.
   */
  const result = await load(() => publicApi.organisations<OrganisationAccount>());
  if (!result.ok) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-12">
        <Outage error={result.error} retryHref="/join" />
      </main>
    );
  }

  const active = result.data.filter((b) => b.subscriptionStatus !== 'cancelled');

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-12">
      <div className="mb-7">
        <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-accent">
          Dawuro Platform
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Join your organisation</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          For staff of an organisation that already uses Dawuro. Your employer confirms you work
          there before anything reaches you.
        </p>
      </div>

      <div className="mb-5">
        <GoogleButton label="Continue with Google" />
        <div className="mt-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline/10" />
          <span className="text-2xs uppercase tracking-wider text-text-faint">or</span>
          <span className="h-px flex-1 bg-hairline/10" />
        </div>
      </div>

      <JoinForm organisations={active} />

      <p className="mt-8 text-xs text-text-faint">
        Signing your whole organisation up instead?{' '}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Register an organisation
        </Link>
        {' · '}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
