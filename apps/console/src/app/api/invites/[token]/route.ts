import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiUnavailable } from '@/lib/apiError';
import { publicApi } from '@/lib/consoleApi';

/**
 * Redeeming an invitation.
 *
 * **The one route in this console with no session check, and deliberately so.**
 * Everywhere else, an unauthenticated endpoint would be a hole; here the whole
 * point is that the caller has no account — they are joining an organisation on
 * the strength of a link somebody inside it sent them. The token is the
 * credential, and it is the service that decides whether it is still good.
 *
 * This replaces a form that waited 700ms and said "Request sent". Nothing was
 * created, so the person waited to be let in to something nobody had been told
 * about — and the organisation never saw a request to accept.
 */

const schema = z.object({
  email: z.string().trim().email('Enter the email address you will sign in with.'),
  password: z.string().min(10, 'Use at least 10 characters.'),
  displayName: z.string().trim().min(2, 'Enter your name.').max(120),
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' },
      { status: 400 },
    );
  }

  try {
    await publicApi.acceptInvite(token, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    /*
     * The service's own sentence. An expired link, a revoked one, and an email
     * that already has an account are three different problems with three
     * different next steps, and only the service knows which one this is.
     */
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json(
        {
          error:
            cause.status === 0
              ? 'The service could not be reached. Nothing was sent.'
              : cause.message,
        },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    return NextResponse.json({ error: 'That invitation could not be accepted.' }, { status: 500 });
  }
}
