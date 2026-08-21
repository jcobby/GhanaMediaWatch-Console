import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';

/**
 * Sign out.
 *
 * POST rather than GET: a GET logout can be triggered by any image tag or
 * prefetch on a page, which makes signing users out a trivial nuisance attack.
 */
export async function POST() {
  await destroySession();
  return NextResponse.json({ redirectTo: '/login' });
}
