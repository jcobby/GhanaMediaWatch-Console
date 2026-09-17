import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roleCan } from '@dawuro/core';
import { readSession } from '@/lib/session';
import { ApiUnavailable } from '@/lib/apiError';
import { platform } from '@/lib/consoleApi';
import { LIVE_ADMIN_ROLES, normaliseAdmin } from '@/lib/admins';

/**
 * Adding, changing and removing platform administrators.
 *
 * The administrators screen used to hold nine invented people in React state and
 * lose every change on reload, under a note saying so. These go to
 * `/platform/admins`, which writes every change to the platform audit log.
 *
 * The service enforces the rules that matter — a platform owner cannot demote,
 * suspend or remove themselves — and its refusal is shown as it is worded.
 */

const ROLE = z.enum(LIVE_ADMIN_ROLES);

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    email: z.string().trim().email('Enter a valid work email.'),
    displayName: z.string().trim().min(1, 'Enter their name.').max(80),
    role: ROLE,
  }),
  z.object({
    action: z.literal('update'),
    id: z.string().min(1),
    role: ROLE.optional(),
    suspended: z.boolean().optional(),
  }),
  z.object({ action: z.literal('remove'), id: z.string().min(1) }),
]);

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  }

  // Granting platform access is checked here too, not only by the page redirect.
  const allowed =
    session.accountType === 'platform_owner' ||
    Boolean(session.role && roleCan(session.role, 'manage_admins'));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Only a platform owner can manage administrators.' },
      { status: 403 },
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'That could not be saved.' },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    if (input.action === 'create') {
      const raw = await platform.createAdmin({
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        role: input.role,
      });
      return NextResponse.json({ admin: normaliseAdmin(raw) });
    }

    if (input.action === 'update') {
      if (input.role === undefined && input.suspended === undefined) {
        return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
      }
      const raw = await platform.updateAdmin(input.id, {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.suspended !== undefined ? { suspended: input.suspended } : {}),
      });
      return NextResponse.json({ admin: normaliseAdmin(raw) });
    }

    await platform.removeAdmin(input.id);
    return NextResponse.json({ removed: true });
  } catch (cause) {
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json(
        { error: cause.status === 0 ? 'The service could not be reached. Nothing was changed.' : cause.message },
        { status: cause.status >= 400 ? cause.status : 503 },
      );
    }
    return NextResponse.json({ error: 'That could not be saved.' }, { status: 500 });
  }
}
