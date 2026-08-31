import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PLATFORM_ROLES, ROLE_META, isAdminRole, type PlatformRole } from '@dawuro/core';
import { createSession } from '@/lib/session';

/**
 * Signing in as a chosen role.
 *
 * **A simulation, and only ever a simulation.** In production a role comes
 * from the account and this endpoint does not exist — which is why it is
 * fenced off behind a single environment check rather than left to the
 * discipline of not linking to it. An endpoint that mints an arbitrary session
 * is the most dangerous thing in this codebase if it ever ships enabled.
 */

const schema = z.object({
  role: z.enum(PLATFORM_ROLES as [PlatformRole, ...PlatformRole[]], {
    errorMap: () => ({ message: 'Unknown role.' }),
  }),
});

/**
 * The one guard that matters.
 *
 * `NODE_ENV === 'production'` is true for `next build`, so a preview deploy of
 * the demo would lose this route. `DAWURO_DEMO_ROLES` is therefore an explicit
 * opt-in: the demo sets it, production never does, and the default is closed.
 */
function demoEnabled(): boolean {
  return process.env.DAWURO_DEMO_ROLES === 'on';
}

export async function POST(request: Request) {
  if (!demoEnabled()) {
    return NextResponse.json({ error: 'Role switching is not available.' }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Unknown role.' },
      { status: 400 },
    );
  }

  const role = parsed.data.role;
  const meta = ROLE_META[role];

  await createSession({
    id: `demo_${role}`,
    email: `${role.replace(/_/g, '.')}@dawuro.gh`,
    displayName: DEMO_NAMES[role],
    // The coarse axis the original route groups gate on, derived from the
    // role rather than stored twice.
    accountType: isAdminRole(role)
      ? 'platform_owner'
      : role === 'verification_editor' || role === 'editorial_lead'
        ? 'editor'
        : role === 'reporter'
          ? 'reporter'
          : 'business',
    role,
    title: meta.label,
    businessId: isAdminRole(role) ? undefined : 'biz_ama',
    businessName: isAdminRole(role) ? undefined : 'Accra Metropolitan Assembly',
    onboardingComplete: true,
  });

  return NextResponse.json({ redirectTo: meta.home });
}

/**
 * Names rather than "Demo User" twenty times.
 *
 * A console full of the same placeholder name makes it impossible to tell at a
 * glance whether the interface actually changed when you switched role.
 */
const DEMO_NAMES: Record<PlatformRole, string> = {
  super_admin: 'Ama Serwaa',
  dawuro_admin: 'Kofi Mensah',
  system_admin: 'Yaw Boateng',
  hr_admin: 'Akosua Danso',
  operations: 'Kwabena Owusu',
  branch_manager: 'Efua Asante',
  compliance_officer: 'Nana Adjei',
  finance_officer: 'Abena Frimpong',
  auditor: 'Kwame Antwi',
  institution_admin: 'Adwoa Nyarko',
  editorial_lead: 'Kojo Amankwah',
  verification_editor: 'Esi Bediako',
  dispatcher: 'Yaa Agyeman',
  field_officer: 'Kwesi Appiah',
  analyst: 'Afia Baffour',
  survey_manager: 'Kwaku Ansah',
  agent: 'Adjoa Tetteh',
  affiliate_partner: 'Fiifi Quartey',
  reporter: 'Araba Nkrumah',
  support_desk: 'Kobina Sarpong',
};
