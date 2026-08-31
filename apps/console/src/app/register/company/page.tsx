import Link from 'next/link';
import { RegisterForm } from './RegisterForm';

/**
 * Public application form for organisations.
 *
 * Reachable without a session — an agency that has never heard of Dawuro has
 * to be able to reach this from a link in an email.
 */
export default function RegisterPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
      <div className="mb-8">
        <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-accent">
          Dawuro Platform
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Register your organisation</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-text-muted">
          For government agencies, media houses, utilities and companies. Dawuro routes incident
          footage filmed by the public to the organisations whose work it touches.
        </p>
      </div>

      <RegisterForm />

      <div className="mt-8 space-y-1.5 text-xs text-text-faint">
        <p>
          {/* The commonest wrong turn: an employee filling in a company form. */}
          Not registering a whole organisation? If your employer already uses Dawuro,{' '}
          <Link href="/join" className="font-medium text-accent hover:underline">
            ask to join them instead
          </Link>
          .
        </p>
        <p>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
