import { Suspense } from 'react';
import { DEMO_LOGINS, DEMO_PASSWORD, PLATFORM_OWNERS } from '@dawuro/core';
import { LoginForm } from './LoginForm';

/**
 * Sign-in.
 *
 * Two panels: what this console is on the left, the form on the right. The
 * left panel exists because business users arrive here from an email link with
 * no idea what Dawuro is — a bare form on a violet field tells them nothing.
 *
 * Seeded accounts are listed while the backend is simulated. They disappear
 * with the fixtures.
 */
export default function LoginPage() {
  /*
   * Operators appear in both seed lists — DEMO_LOGINS carries one for
   * completeness, PLATFORM_OWNERS is the authoritative set with access codes.
   * Listing both showed "Platform Operations" twice, so operators are taken
   * only from PLATFORM_OWNERS.
   */
  const operatorEmails = new Set(PLATFORM_OWNERS.map((o) => o.email.toLowerCase()));
  const demo = [
    ...DEMO_LOGINS.filter(
      (l) => l.accountType !== 'reporter' && !operatorEmails.has(l.email.toLowerCase()),
    ),
    ...PLATFORM_OWNERS.map((o) => ({
      email: o.email,
      displayName: o.displayName,
      accountType: 'platform_owner' as const,
      showcases: o.title,
    })),
  ];

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Left — what this is */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-accent to-accent-alt p-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-pill bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-pill bg-black/10 blur-3xl"
        />

        <div className="relative">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-white/70">
            Dawuro Platform
          </p>
          <h1 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-white">
            Information from the ground, routed to the people who can act on it.
          </h1>
        </div>

        <div className="relative max-w-md space-y-5 text-sm leading-relaxed text-white/85">
          <p>
            Members of the public film what is happening around them. Reports are matched to the
            organisations whose work they touch, and licensed by those organisations.
          </p>
          <p>
            This console is where that work happens — reviewing what arrived, licensing what
            matters, and deciding what the public gets to see.
          </p>
        </div>

        <p className="relative text-2xs text-white/60">
          Reporting itself happens in the mobile app, where the camera and GPS live.
        </p>
      </section>

      {/* Right — the form */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-accent">
              Dawuro Platform
            </p>
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Sign in</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            For organisations and platform operators.
          </p>

          <div className="mt-8">
            {/* The form reads `?next=` to resume a deep link, which opts it out
                of prerendering unless it sits behind a boundary. The fallback
                matches the form's height so the panel does not jump. */}
            <Suspense fallback={<div className="h-[26rem]" aria-hidden />}>
              <LoginForm demoAccounts={demo} demoPassword={DEMO_PASSWORD} />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
