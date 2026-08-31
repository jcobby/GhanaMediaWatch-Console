import { NextResponse } from 'next/server';
import { authenticate, credentialsSchema } from '@/lib/auth';
import { createSession, homeFor } from '@/lib/session';

/**
 * Sign in.
 *
 * The credential check and the session write both happen here on the server;
 * the browser receives only a redirect target and an httpOnly cookie it cannot
 * read. No token ever reaches client JavaScript.
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

  await createSession(result.user);

  return NextResponse.json({
    // The role, when the account has one, is the more specific answer — an
    // admin signing in belongs on their own dashboard, not on the shared
    // platform console their coarse account type would send them to.
    redirectTo: homeFor(
      result.user.accountType,
      result.user.onboardingComplete ?? true,
      result.user.role,
    ),
    accountType: result.user.accountType,
  });
}
