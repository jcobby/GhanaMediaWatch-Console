import { NextResponse } from 'next/server';
import { authenticate, credentialsSchema } from '@/lib/auth';
import { createSession } from '@/lib/session';
import { homeForSession } from '@/lib/token';
import { applicationFor } from '@/lib/applications';

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

  /*
   * Restore an application this person already filed.
   *
   * Without it, registering and then signing out was a one-way door: the
   * organisation's details lived only in the session cookie, so the next sign-in
   * produced a bare reporter account and middleware sent them to `/no-console`
   * — "reporting happens on the phone" — with no trace of the newsroom they had
   * registered a day earlier. The onboarding screen went as far as warning them
   * not to sign out, which is not something a product should have to ask.
   *
   * The application is stored now, so it is read back and the session carries
   * what middleware needs to route them to `/onboarding` instead.
   */
  const user = { ...result.user };
  const application = await applicationFor(user.email);

  /*
   * The newsroom's name, from whichever side of the flow has it.
   *
   * `GET /me` carries `memberships`, and the entries the live service returns
   * have no `orgName` on them — so an organisation whose organisation now really
   * exists would sign in to a sidebar with no newsroom written on it, which
   * reads as a half-loaded page. The application this console holds has the
   * name they registered, and it is the same name the organisation was created
   * with. Only used as a fallback: if the server ever does name the
   * organisation, the server wins.
   */
  if (application && !user.businessName) {
    user.businessName = application.organisationName;
  }

  if (user.accountType === 'reporter') {
    /*
     * Any application at all, at any stage.
     *
     * A draft belongs in the wizard, a submitted one on its status page, and a
     * decided one on the page that carries the decision. All three live at
     * `/onboarding`; what none of them is, is a reporter who should be told
     * that reporting happens on the phone.
     */
    if (application) {
      user.businessName = application.organisationName;
      user.businessId = application.id;
      user.pendingApplication = {
        organisationName: application.organisationName,
        sector: application.sector,
        phone: application.phone,
        interests: application.interests,
        ...(application.tier ? { tier: application.tier } : {}),
      };

      /*
       * An approved organisation is an organisation.
       *
       * The backend still calls this account a plain `user` — it has no
       * organisations at all and no endpoint that creates one — so probing it
       * will always answer "reporter", and the console used to stop there. The
       * result was that an operator approved a newsroom and the newsroom then
       * signed in to a single Onboarding link and a page explaining why it
       * could do nothing. Approval decided nothing.
       *
       * The console is the system of record for approvals, because the API
       * holds none. It should therefore honour its own decision: an approved
       * application opens the organisation's console.
       *
       * This grants no data. The API remains the authority on every request,
       * and refuses the ones it refuses — pages that cannot be served say so.
       * What changes is only which shell is rendered, exactly as reading the
       * token's `kind` claim decides between the editorial and platform ones.
       */
      user.accountType = application.status === 'approved' ? 'organisation' : 'reporter';
      user.onboardingComplete = application.status === 'approved';
    }
  }

  await createSession(user);

  return NextResponse.json({
    // The role, when the account has one, is the more specific answer — an
    // admin signing in belongs on their own dashboard, not on the shared
    // platform console their coarse account type would send them to.
    /*
     * Computed from the restored session, and by the same function middleware
     * uses.
     *
     * This called `homeFor`, which answers from the account type alone — and by
     * the server's reckoning an applicant is a reporter, so it returned
     * `/no-console`. Somebody who registered a newsroom, completed onboarding
     * and was approved signed in and was told that reporting happens on the
     * phone. Middleware could not correct it either: `/no-console` is a public
     * path and returns before the applicant rules run.
     */
    redirectTo: homeForSession(user),
    accountType: user.accountType,
  });
}
