import Link from 'next/link';
import { ScanEye } from 'lucide-react';
import { Panel } from '@/components/ui';
import { VerifyLookup } from './VerifyLookup';

/**
 * The public verification page.
 *
 * Anyone who sees a Dawuro clip anywhere — forwarded on WhatsApp, embedded in a
 * bulletin, screenshotted — can type the code stamped on it and find out what
 * the platform actually established. Without this, the overlay is a claim the
 * viewer has to take on trust, which is precisely what the product exists to
 * stop being necessary.
 *
 * Public and unauthenticated by design.
 */
export default function VerifyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-accent-wash">
          <ScanEye className="h-5 w-5 text-accent" strokeWidth={2} />
        </div>
        <p className="mt-4 text-2xs font-semibold uppercase tracking-[0.18em] text-accent">
          Dawuro Platform
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em]">Check a report</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
          Every report carries a code stamped on the footage. Enter it to see what was established
          about it, and what was not.
        </p>
      </div>

      <VerifyLookup />

      <Panel className="mt-5 p-4">
        {/* The honest limit, stated up front rather than buried. */}
        <p className="text-xs leading-relaxed text-text-muted">
          This tells you whether the file is unchanged since capture and how far it has been
          checked. It cannot tell you that a scene was not staged — no technology can. That is what
          the verification state is for.
        </p>
      </Panel>

      <p className="mt-6 text-center text-xs text-text-faint">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
