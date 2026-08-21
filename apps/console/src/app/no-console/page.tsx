import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { Panel } from '@/components/ui';

/**
 * Where reporters land.
 *
 * A reporter account is valid — it simply has nothing to do here. Saying so
 * plainly is better than a redirect loop or a bare 403, both of which read as
 * "your account is broken" when it is not.
 */
export default function NoConsole() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Panel glass className="max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-accent-wash">
          <Smartphone className="h-5 w-5 text-accent" strokeWidth={1.75} />
        </div>
        <h1 className="text-xl font-semibold">Reporting happens on the phone</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Filming an incident needs a camera and an accurate GPS fix, and reports have to queue
          safely when you are offline. The Dawuro app does all of that; this console cannot.
        </p>
        <p className="mt-4 text-sm text-text-muted">
          Install the app on your phone to send reports and track what you have earned.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Sign in with a different account
        </Link>
      </Panel>
    </main>
  );
}
