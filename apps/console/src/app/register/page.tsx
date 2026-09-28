import Link from 'next/link';
import { ArrowRight, Building2, UserPlus } from 'lucide-react';
import { GnaSymbol } from '@/components/Brand';

export const metadata = {
  title: 'Register — Dawuro',
};

/**
 * The fork before registration.
 *
 * Two entirely different journeys hide behind the word "register", and picking
 * the wrong one wastes real effort: an organisation signs up, chooses a plan
 * and works through onboarding with documents; a member of staff simply asks
 * their employer to confirm they work there.
 *
 * Someone who starts the company flow when they meant to join gets several
 * screens in before anything feels wrong. So the choice is made first, at a
 * size that cannot be misread, with enough text under each to be sure.
 */
export default function RegisterChoice() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12">
      <header className="mb-8 text-center">
        <GnaSymbol className="mx-auto mb-6 h-20 w-auto" />
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          How are you joining Dawuro?
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
          Two different things share the word &ldquo;register&rdquo;. Pick the one that describes
          you and the rest of the form will make sense.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Choice
          href="/register/company"
          icon={<Building2 className="h-7 w-7" strokeWidth={1.75} />}
          title="Register an organisation"
          lead="You are signing your organisation up."
          points={[
            'Government agency, media house, utility, NGO or company',
            'You choose the categories that reach your inbox and a plan',
            'Then onboarding — registration documents, an authorised officer, the areas you cover',
            'A platform administrator verifies you before any footage arrives',
          ]}
          accent="#0B5FD1"
        />

        <Choice
          href="/join"
          icon={<UserPlus className="h-7 w-7" strokeWidth={1.75} />}
          title="Join an organisation"
          lead="Your employer is already on Dawuro."
          points={[
            'You work for an organisation that already has an account',
            'You pick your employer and, if you know it, your branch',
            'They confirm you work there before anything reaches you',
            'No documents and no plan to choose — that is already done',
          ]}
          accent="#0B7A4B"
        />
      </div>

      <p className="mt-8 text-center text-xs text-text-faint">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

function Choice({
  href,
  icon,
  title,
  lead,
  points,
  accent,
}: {
  href: '/register/company' | '/join';
  icon: React.ReactNode;
  title: string;
  lead: string;
  points: string[];
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-hairline/12 bg-canvas-soft p-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accent }}
      />

      <span
        className="mb-4 mt-2 flex h-14 w-14 items-center justify-center rounded-md"
        style={{ backgroundColor: `${accent}18`, color: accent }}
      >
        {icon}
      </span>

      <span className="text-lg font-semibold tracking-tight text-text-primary">{title}</span>
      <span className="mt-1 text-sm font-medium text-text-secondary">{lead}</span>

      <ul className="mt-4 flex-1 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-xs leading-relaxed text-text-muted">
            <span
              aria-hidden
              className="mt-[6px] h-1 w-1 shrink-0 rounded-pill"
              style={{ backgroundColor: accent }}
            />
            {p}
          </li>
        ))}
      </ul>

      <span
        className="mt-5 flex items-center gap-1.5 text-sm font-medium transition group-hover:gap-2.5"
        style={{ color: accent }}
      >
        Continue
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </span>
    </Link>
  );
}
