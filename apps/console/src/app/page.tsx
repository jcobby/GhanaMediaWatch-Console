import { redirect } from 'next/navigation';
import { homeFor, readSession } from '@/lib/session';

/**
 * The root is a router, not a page.
 *
 * Middleware has already established there is a session by the time this runs;
 * this only decides which console the account belongs in.
 */
export default async function Index() {
  const session = await readSession();
  redirect(session ? homeFor(session.accountType) : '/login');
}
