import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSession } from '@/lib/session';
import { ApiUnavailable } from '@/lib/apiError';
import { publicApi } from '@/lib/consoleApi';

/**
 * Asking an organisation to add you to their team.
 *
 * **The half of joining that existed on the service and on no client.** The
 * `/join` page stated that nothing could raise a membership request — true when
 * it was written, and since overtaken: `POST /membership-requests` is live, and
 * its own summary names the caller, *"Signed-in outsider path for the console
 * /join page"*. Meanwhile an organisation's Team screen has carried a Requests
 * tab that lists and decides requests nobody could create.
 *
 * Not org-scoped, and that is the point of it: the caller is by definition not
 * in the organisation yet, so this carries no `X-Dawuro-Org` header. It does
 * require a session — the service attaches the request to the signed-in user,
 * which is what makes "who is asking" answerable at all.
 */

const schema = z.object({
  orgId: z.string().trim().min(1),
  /*
   * Everything but the organisation is optional, exactly as the service
   * declares it. The account already carries a name and an address; these
   * override them for the people reviewing, because the name on a personal
   * account is frequently not the name a colleague would recognise.
   */
  displayName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().optional(),
  statedRole: z.string().trim().max(64).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Sign in first, so the organisation knows who is asking.' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? 'That request could not be sent.' },
      { status: 400 },
    );
  }

  try {
    const created = await publicApi.requestMembership(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (cause) {
    if (cause instanceof ApiUnavailable) {
      /*
       * 409 is the one refusal worth its own words. The service answers it when
       * there is already a request or already a membership, and "that could not
       * be sent" would send somebody to ask a colleague about a request that is
       * sitting in their queue.
       */
      if (cause.status === 409) {
        return NextResponse.json(
          {
            error:
              'You have already asked to join this organisation, or you are already in their team.',
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: cause.message },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    throw cause;
  }
}
