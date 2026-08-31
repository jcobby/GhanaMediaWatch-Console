import Link from 'next/link';
import { VISIBLE_MODULES, visibleRoles } from '@dawuro/core';
import { RolePicker } from './RolePicker';

export const metadata = {
  title: 'Sign in as — Dawuro',
};

/**
 * The demo entry point.
 *
 * Twenty roles, one person looking at the product. Rather than seeding twenty
 * accounts and asking whoever is driving to remember which password goes with
 * which job, this signs the session straight into a chosen role.
 *
 * It is deliberately not disguised as a real feature — the banner says what it
 * is. A demo affordance that looks like production is how a demo affordance
 * ends up in production.
 */
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-6">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
          Dawuro Console
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary">
          Sign in as
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-muted">
          {visibleRoles().length} roles
          {VISIBLE_MODULES.length > 1 ? ' across two modules' : ''}, each with its own interface.
          Pick one to see what that person sees.
        </p>
      </header>

      <div className="mb-5 rounded-md border border-warning/25 bg-warning-wash/40 px-4 py-3">
        <p className="text-xs leading-relaxed text-text-secondary">
          <span className="font-semibold">This screen is a simulation.</span> In production a role
          comes from the account and nobody chooses their own — it exists so the whole product can
          be walked through without twenty sets of credentials. It disappears when the backend
          lands.
        </p>
      </div>

      <RolePicker />

      <p className="mt-6 text-xs text-text-faint">
        Prefer the real thing?{' '}
        <Link href="/login" className="text-accent underline underline-offset-2">
          Sign in with credentials
        </Link>
        .
      </p>
    </main>
  );
}
