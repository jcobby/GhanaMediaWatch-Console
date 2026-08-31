import { Suspense } from 'react';
import {
  DEMO_LOGINS,
  DEMO_PASSWORD,
  MODULE_META,
  PLATFORM_OWNERS,
  ROLE_LOGINS,
  ROLE_META,
  VISIBLE_MODULES,
} from '@dawuro/core';
import { LoginForm } from './LoginForm';
import { LoginShell } from './LoginShell';

export const metadata = { title: 'Sign in — Dawuro' };

/**
 * Sign-in.
 *
 * The frame lives in LoginShell; this file's job is deciding which seeded
 * accounts to offer while the backend is simulated. They disappear with the
 * fixtures.
 */
export default function LoginPage() {
  /*
   * Operators appear in both seed lists — DEMO_LOGINS carries one for
   * completeness, PLATFORM_OWNERS is the authoritative set with access codes.
   * Listing both showed "Platform Operations" twice, so operators are taken
   * only from PLATFORM_OWNERS.
   */
  const operatorEmails = new Set(PLATFORM_OWNERS.map((o) => o.email.toLowerCase()));

  /*
   * Three groups, because they answer different questions.
   *
   * The first is "show me the product working" — narrative accounts chosen for
   * what their data demonstrates. The others are "show me this job", one
   * account per role. Listing all of them flat would bury the form they sit
   * under, so the role sets collapse.
   */
  const groups = [
    {
      title: 'Demo accounts',
      accounts: [
        ...DEMO_LOGINS.filter(
          (l) => l.accountType !== 'reporter' && !operatorEmails.has(l.email.toLowerCase()),
        ),
        ...PLATFORM_OWNERS.map((o) => ({
          email: o.email,
          displayName: o.displayName,
          accountType: 'platform_owner' as const,
          showcases: o.title,
        })),
      ],
    },
    ...VISIBLE_MODULES.map((module) => ({
      title: MODULE_META[module].label,
      blurb: MODULE_META[module].blurb,
      collapsible: true,
      accounts: ROLE_LOGINS.filter((l) => l.role && ROLE_META[l.role].module === module).map(
        (l) => ({
          email: l.email,
          displayName: l.displayName,
          accountType: l.accountType,
          showcases: l.showcases,
          roleLabel: l.role ? ROLE_META[l.role].label : undefined,
        }),
      ),
    })),
  ];

  return (
    <LoginShell>
      <div>
        <h2 className="text-[1.7rem] font-semibold leading-tight tracking-tight text-text-primary">
          Sign in
        </h2>
        <p className="mt-1.5 text-sm text-text-muted">For organisations and platform operators.</p>
      </div>

      <div className="mt-7">
        {/* The form reads `?next=` to resume a deep link, which opts it out of
            prerendering unless it sits behind a boundary. The fallback matches
            the form's height so the panel does not jump. */}
        <Suspense fallback={<div className="h-[26rem]" aria-hidden />}>
          <LoginForm groups={groups} demoPassword={DEMO_PASSWORD} />
        </Suspense>
      </div>
    </LoginShell>
  );
}
