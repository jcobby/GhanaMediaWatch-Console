import { NextResponse } from 'next/server';
import { authenticate, credentialsSchema } from '@/lib/auth';
import { createSession } from '@/lib/session';
import { homeForSession } from '@/lib/token';

/**
 * Sign in.
 *
 * The credential check and the session write both happen here on the server;
 * the browser receives only a redirect target and an httpOnly cookie it cannot
 * read. No token ever reaches client JavaScript.
 *
 * An applicant needs nothing special any more. `/me` names their pending
 * organisation, so `authenticate` returns an organisation session with
 * onboarding incomplete, and they land back in the wizard. This used to restore
 * the application from a file the console kept on its own disk.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? 'Check your details.' }, { status: 400 });
  }

  const result = await authenticate(parsed.data);
  if (!result.ok) {
    // 401 for every credential failure, so response codes cannot be used to
    // enumerate which emails exist.
    return NextResponse.json(
      { error: result.error, needsAccessCode: result.needsAccessCode ?? false },
      { status: 401 },
    );
  }

  const user = result.user;
  await createSession(user);

  return NextResponse.json({
    /*
     * Computed by the same function middleware uses, so sign-in and the next
     * navigation cannot disagree about where this person belongs.
     */
    redirectTo: homeForSession(user),
    accountType: user.accountType,
  });
}
