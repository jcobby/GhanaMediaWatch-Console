import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRole } from '@dawuro/core';
import {
  MAX_AGE_SECONDS,
  SESSION_COOKIE,
  hasApplication,
  homeFor,
  homeForSession,
  signSessionToken,
  verifySessionToken,
} from '@/lib/token';
import { needsRefresh, refreshSession } from '@/lib/refresh';

/**
 * Role gating, before any page renders.
 *
 * A client-side role check is a suggestion — the page has already been sent by
 * the time it runs. This rejects at the edge instead, so an organisation account
 * never receives platform console markup at all.
 *
 * Routes are gated by prefix rather than by route group, because Next.js route
 * groups are a filesystem convention and do not appear in the URL. The two must
 * be kept in step by hand; the test suite asserts they are.
 */

/** Reachable without a session. */
const PUBLIC_PATHS = [
  '/login',
  '/no-console',
  '/register',
  '/join',
  '/invite',
  // Anyone holding a clip must be able to check it without an account.
  '/verify',
  // The demo role switcher. Gated by DAWURO_DEMO_ROLES on the API route that
  // actually mints a session — the page itself reveals nothing.
  '/roles',
];

/** Prefixes only a platform operator may reach. */
const PLATFORM_PREFIXES = ['/platform'];

/**
 * The admin module.
 *
 * Gated on the module rather than the individual role: which of the nine
 * admin roles may reach a given page inside it is decided by capability, on
 * the page itself. Middleware runs on every request and should answer the
 * cheap question — is this person an administrator at all.
 */
const ADMIN_PREFIXES = ['/admin'];

/** Prefixes only the verification desk may reach. */
const EDITOR_PREFIXES = ['/editorial'];

/** Prefixes only an organisation account may reach. */
const ORGANISATION_PREFIXES = [
  '/inbox',
  '/onboarding',
  '/map',
  '/published',
  '/surveys',
  '/team',
  '/account',
  '/assignments',
  '/affiliations',
  '/support',
  '/earnings',
  '/agent',
  '/invoices',
  '/checkout',
];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Put a renewed session back in the cookie without changing where we were going. */
function withSession(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let session = token ? await verifySessionToken(token) : null;

  /*
   * Renew the backend credential before anything reads it.
   *
   * The console session cookie lasts eight hours; the backend access token
   * inside it lasts far less. Once the inner token expired every page answered
   * 401 and rendered "Signed out — your session ended" while the sidebar still
   * showed the operator signed in — on a session that was perfectly valid.
   * Reloading changed nothing, because nothing renewed it.
   *
   * This is the only place it can happen: a Server Component may not write
   * cookies, so a page that discovers the problem cannot fix it.
   */
  let renewed: string | null = null;
  if (session && needsRefresh(session)) {
    const next = await refreshSession(session);
    if (next) {
      session = next;
      renewed = await signSessionToken(next);
    } else {
      /*
       * The refresh token is spent too. That is a real sign-out, and it has to
       * look like one rather than leaving somebody on a session whose
       * credential is dead — which is the exact state this replaces.
       */
      const url = new URL('/login', request.url);
      if (pathname !== '/') url.searchParams.set('next', pathname);
      url.searchParams.set('reason', 'expired');
      const response = NextResponse.redirect(url);
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
  }

  /** Every exit from here carries the renewed cookie, if there is one. */
  const finish = (response: NextResponse) => (renewed ? withSession(response, renewed) : response);

  /*
   * Where a signed-in caller belongs.
   *
   * An applicant mid-registration is a reporter account by the server's
   * reckoning, so `homeFor` sends them to `/no-console` — "reporting happens on
   * the phone" — while the rest of this console has them pinned to
   * `/onboarding`. Two screens disagreeing about the same person, reached by
   * two routes a minute apart, reads as the app having lost track of them.
   */
  // Signed in and heading for the login page — send them to their console.
  if (session && pathname === '/login') {
    return finish(NextResponse.redirect(new URL(homeForSession(session), request.url)));
  }

  if (matches(pathname, PUBLIC_PATHS)) {
    /*
     * With one exception: an applicant must never be shown `/no-console`.
     *
     * That page says reporting happens on the phone, and it is addressed to a
     * member of the public. Somebody who registered a newsroom, filled in the
     * onboarding forms and was approved is not that person, and telling them so
     * on sign-in reads as the application having been thrown away.
     *
     * It has to be handled here rather than with the applicant rules further
     * down, because `/no-console` is a public path and returns before they run
     * — which is exactly how this survived.
     */
    if (session && pathname === '/no-console' && hasApplication(session)) {
      return finish(NextResponse.redirect(new URL('/onboarding', request.url)));
    }
    return finish(NextResponse.next());
  }

  if (!session) {
    const url = new URL('/login', request.url);
    // Preserved so a deep link survives the detour through sign-in.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    // No session means nothing to renew, but the rule stays uniform: every exit
    // goes through `finish`, so a new one cannot be forgotten on some branch.
    return finish(NextResponse.redirect(url));
  }

  /*
   * Somebody who has just registered an organisation.
   *
   * The backend has no endpoint that creates an organisation, so registration
   * can only create the person's own account — which the server issues as a
   * reporter. They are not a reporter in any sense they would recognise: they
   * filled in an organisation's details a moment ago, and sending them to
   * "reporters use the phone" would be the app contradicting what they just
   * did. The pending application is what tells them apart.
   */
  if (hasApplication(session)) {
    return pathname.startsWith('/onboarding')
      ? finish(NextResponse.next())
      : finish(NextResponse.redirect(new URL('/onboarding', request.url)));
  }

  // Reporters have an account but no console. Say so plainly rather than
  // bouncing them around a login loop they cannot win.
  if (session.accountType === 'reporter') {
    return finish(NextResponse.redirect(new URL('/no-console', request.url)));
  }

  if (matches(pathname, ADMIN_PREFIXES) && !(session.role && isAdminRole(session.role))) {
    return finish(NextResponse.redirect(new URL('/', request.url)));
  }

  if (matches(pathname, PLATFORM_PREFIXES) && session.accountType !== 'platform_owner') {
    return finish(NextResponse.redirect(new URL(homeFor(session.accountType), request.url)));
  }

  if (matches(pathname, EDITOR_PREFIXES) && session.accountType !== 'editor') {
    return finish(NextResponse.redirect(new URL(homeFor(session.accountType), request.url)));
  }

  if (matches(pathname, ORGANISATION_PREFIXES) && session.accountType !== 'organisation') {
    return finish(NextResponse.redirect(new URL(homeFor(session.accountType), request.url)));
  }

  /*
   * An organisation part-way through onboarding is held there.
   *
   * Not a nag — the rest of the console genuinely does not work yet. Nothing is
   * routed to an unapproved organisation, so every other screen would be empty
   * and the product would look broken rather than incomplete.
   */
  if (
    session.accountType === 'organisation' &&
    session.onboardingComplete === false &&
    !pathname.startsWith('/onboarding')
  ) {
    return finish(NextResponse.redirect(new URL('/onboarding', request.url)));
  }

  return finish(NextResponse.next());
}

export const config = {
  /**
   * Pages only. Never API routes, Next internals or static files.
   *
   * This excluded `api/auth` alone, so every *other* route handler was being
   * put through the page rules above — and those rules answer with redirects.
   * An applicant uploading a certificate got `307 → /onboarding` instead of
   * reaching the handler: `hasPendingApplication` is true for them, and the
   * rule that keeps them on the onboarding page cannot tell a navigation from a
   * `fetch`. The browser followed the redirect, the client got HTML where it
   * expected JSON, `res.json()` threw, and the screen said "The upload did not
   * complete. Try again." — a message about the network, for a request the
   * server never saw. Saving a step failed the same way and just as silently.
   *
   * It only looked like it worked for platform owners, whose sessions fall
   * through these rules to `next()`.
   *
   * Excluding all of `/api` is safe because every handler checks the session
   * itself: `readSession` plus an explicit `accountType` test, because an
   * endpoint is reachable directly and a redirect rule on a URL prefix was
   * never an authorisation boundary.
   */
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
