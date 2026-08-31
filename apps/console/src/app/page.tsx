import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { homeFor, readSession } from '@/lib/session';

/**
 * The root is a router, not a page.
 *
 * Middleware has already established there is a session by the time this runs;
 * this only decides which console the account belongs in.
 */
export default async function Index() {
  const session = await readSession();
  if (!session) redirect('/login');
  redirect(homeFor(session.accountType, session.onboardingComplete ?? true, session.role) as Route);
}
